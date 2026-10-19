// The standalone page (cloc-fusion.html): its browser engine, run here on Node's web streams, and
// the committed page itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync, deflateRawSync } from 'node:zlib';
import { readTarGzWeb, readZipBytes, measureRepo, estimateFromLanguages, BYTES_PER_LINE } from '../src/browser/engine.js';
import { analyzeRepoApi } from '../src/apiengine.js';
import { startMockGitHub, tar } from '../bench/mock-github.js';
import { providerOf } from '../src/providers/index.js';
import { HttpError } from '../src/http.js';
import { VERSION } from '../src/version.js';

const bodyOf = (bytes) => new Blob([bytes]).stream();

test('browser engine: .tar.gz read on web streams, with the decompression limit', async () => {
  const archive = gzipSync(tar([{ path: 'top/src/a.js', content: 'const a = 1;\n' }, { path: 'top/README.md', content: '# x\n' }]));
  const got = [];
  await readTarGzWeb(bodyOf(archive), { onEntry: () => true, onFile: (e, c) => got.push([e.path, new TextDecoder().decode(c)]), maxFileBytes: 1e6, maxArchiveBytes: 1e9 });
  assert.deepEqual(got, [['top/src/a.js', 'const a = 1;\n'], ['top/README.md', '# x\n']]);
  const bomb = gzipSync(tar([{ path: 'top/big.js', content: 'a'.repeat(8 * 1024 * 1024) }]));
  await assert.rejects(readTarGzWeb(bodyOf(bomb), { onEntry: () => true, onFile: () => {}, maxFileBytes: 1e6, maxArchiveBytes: 1024 * 1024 }), /larger than/);
});

/** A minimal zip writer (stored and deflated entries), for the reader under test. */
function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [i, f] of files.entries()) {
    const name = Buffer.from(f.path);
    const raw = Buffer.from(f.content);
    const deflate = i % 2 === 1;
    const data = deflate ? deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

test('browser engine: .zip read in memory (Azure DevOps), stored and deflated entries', async () => {
  const bytes = zip([{ path: 'src/a.js', content: 'let a;\nlet b;\n' }, { path: 'src/b.py', content: 'x = 1\n'.repeat(50) }, { path: 'docs/', content: '' }]);
  const got = {};
  const { entries } = await readZipBytes(bytes, { onEntry: () => true, onFile: (e, c) => (got[e.path] = new TextDecoder().decode(c)), maxFileBytes: 1e6, maxArchiveBytes: 1e9 });
  assert.equal(entries, 2);
  assert.equal(got['src/a.js'], 'let a;\nlet b;\n');
  assert.equal(got['src/b.py'], 'x = 1\n'.repeat(50));
  await assert.rejects(readZipBytes(new Uint8Array(100), { onEntry: () => true, onFile: () => {}, maxFileBytes: 1e6, maxArchiveBytes: 1e9 }), /not a zip/);
});

test('browser engine measures like the API engine (same lines and commits)', async () => {
  const mock = await startMockGitHub({ orgs: 1, reposPerOrg: 3 });
  try {
    const conn = { name: 'gh', provider: 'github', apiUrl: mock.url, auth: { method: 'pat' } };
    const provider = providerOf('github');
    const api = provider.client(conn, { token: 'test-token' });
    const repos = await provider.listRepos(api, 'org0');
    for (const repo of repos) {
      const web = await measureRepo(repo, { session: { provider, api }, conn });
      const cli = await analyzeRepoApi(repo, { session: { provider, api }, conn, workDir: '/tmp' });
      assert.equal(web.loc, cli.loc, repo.fullName);
      assert.equal(web.commits, cli.commits, repo.fullName);
      assert.deepEqual(web.weekly, cli.weekly);
      assert.equal(web.locEstimated, false);
    }
    assert.equal(mock.stats.tokenLeaks, 0);
  } finally {
    await mock.close();
  }
});

test('browser engine: when GitHub refuses the archive, lines are estimated and marked so', async () => {
  const provider = providerOf('github');
  const calls = [];
  const api = {
    download: async () => {
      throw new HttpError('GitHub: could not reach codeload.github.com (Failed to fetch)');
    },
    get: async (path) => (calls.push(path), path.endsWith('/languages') ? { JavaScript: 45000, HTML: 4500, JSON: 90000, Unknown: 999 } : null),
    paginate: async () => [],
  };
  const session = { provider, api };
  const repo = { fullName: 'acme/web', defaultBranch: 'main' };
  const m = await measureRepo(repo, { session, conn: { provider: 'github' } });
  assert.equal(m.locEstimated, true);
  assert.equal(m.engine, 'estimate');
  assert.equal(m.loc, Math.round(45000 / BYTES_PER_LINE) + Math.round(4500 / BYTES_PER_LINE)); // code + markup; JSON is data
  assert.equal(session.archiveBlocked, true);
  // Later repositories skip the refused download.
  await measureRepo({ ...repo, fullName: 'acme/api' }, { session, conn: { provider: 'github' } });
  assert.ok(calls.includes('/repos/acme/api/languages'));
  const est = await estimateFromLanguages(api, repo, { countCategories: ['code'] });
  assert.equal(est.loc, 1000);
  assert.equal(est.mainLanguage, 'JavaScript');
  // Other platforms allow their archives: a failure there is an error, not an estimate.
  await assert.rejects(measureRepo(repo, { session: { provider: providerOf('gitlab'), api }, conn: { provider: 'gitlab' } }), /could not reach/);
});

test('cloc-fusion.html is built from this version and its script parses', () => {
  const html = readFileSync(new URL('../cloc-fusion.html', import.meta.url), 'utf8');
  assert.match(html, new RegExp(`<meta name="generator" content="cloc-fusion ${VERSION.replace(/\./g, '\\.')}">`), 'rebuild it: node scripts/build-standalone.mjs');
  assert.match(html, /Content-Security-Policy/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0][1]));
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1)[^"' )]*\.(js|css)["' )]/.test(html.replace(/<script>[\s\S]*<\/script>/, '')), 'no external scripts or styles');
});

test('the page and the report carry the Checkmarx logo and use the system font', async () => {
  const { toHtml } = await import('../src/report/html.js');
  const { buildReport } = await import('../src/report/build.js');
  const { normalizeConfig } = await import('../src/config.js');
  const report = toHtml(buildReport(normalizeConfig({}), []));
  const page = readFileSync(new URL('../cloc-fusion.html', import.meta.url), 'utf8');
  for (const html of [report, page]) {
    assert.match(html, /<svg class="cx-logo"[^>]*aria-label="Checkmarx"/);
    assert.match(html, /--font:-apple-system,BlinkMacSystemFont/);
    assert.ok(!/@font-face/.test(html), 'no embedded fonts');
    assert.ok(!html.includes('cloc·<b>fusion</b>'));
  }
});

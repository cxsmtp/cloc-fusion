// The git-free engine end to end against the mock GitHub API, including failures and the rule
// that credentials never follow a redirect to another host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { startMockGitHub, tar } from '../bench/mock-github.js';
import { normalizeConfig } from '../src/config.js';
import { scan } from '../src/scan.js';
import { readTarGz } from '../src/archive.js';
import { ApiClient } from '../src/http.js';

const config = (mock, extra = {}) =>
  normalizeConfig({
    engine: 'api',
    connections: [{ name: 'gh', provider: 'github', apiUrl: mock.url, auth: { method: 'pat', token: { value: mock.token } }, orgs: 'all' }],
    fusion: { models: [{ id: 'm', name: 'Fusion', creditsPer10k: 1 }] },
    ...extra,
  });

test('API engine: LOC from the tarball, commits from the API, no token leak', async (t) => {
  const mock = await startMockGitHub({ orgs: 2, reposPerOrg: 3 });
  const work = await mkdtemp(join(tmpdir(), 'cf-api-'));
  t.after(async () => {
    await mock.close();
    await rm(work, { recursive: true, force: true });
  });
  const report = await scan(config(mock), { workDir: work });
  assert.equal(report.counts.discovered, 6);
  assert.equal(report.counts.measured, 6);
  assert.equal(report.counts.failed, 0);
  const by = (fullName) => report.repos.find((r) => r.fullName === fullName);
  const busy = by('org0/repo0'); // profile 0: 5 files × 100 lines, 7 commits a week
  assert.equal(busy.engine, 'api');
  assert.equal(busy.loc, 500);
  assert.equal(busy.languages.JavaScript.comment, 5);
  assert.equal(busy.byCategory.docs.code, 1, 'README counted as docs; node_modules skipped');
  assert.equal(busy.commits, 7 * 52 + 1); // and one dependabot commit
  assert.equal(busy.authors, 4);
  assert.equal(busy.devs90, 3, 'three people in the last 90 days');
  assert.equal(busy.bots90, 1, 'dependabot, listed as a bot');
  assert.deepEqual(busy.contributors90.map((c) => [c.name, c.bot]), [['Developer 0', false], ['Developer 1', false], ['Developer 2', false], ['dependabot[bot]', true]]);
  assert.equal(busy.frequency, 'more-5-week');
  assert.equal(busy.scans, 52);
  const mid = by('org0/repo1'); // profile 1: 12,000 lines, 2 a week
  assert.equal(mid.units, 2);
  assert.equal(mid.frequency, '1-5-week');
  assert.equal(mid.credits, 2 * 26);
  const dormant = by('org0/repo2');
  assert.equal(dormant.commits, 0);
  assert.equal(dormant.frequency, 'rare');
  assert.equal(mock.stats.tokenLeaks, 0, 'the download host never saw the token');
});

test('API engine survives rate limits and server errors', async (t) => {
  const mock = await startMockGitHub({ orgs: 3, reposPerOrg: 10, faultRate: 0.25 });
  const work = await mkdtemp(join(tmpdir(), 'cf-api-'));
  t.after(async () => {
    await mock.close();
    await rm(work, { recursive: true, force: true });
  });
  const cfg = config(mock);
  const report = await scan(cfg, { workDir: work });
  assert.equal(report.counts.measured, 30);
  assert.equal(report.counts.failed, 0);
  assert.ok(mock.stats.faults > 0);
});

test('credentials are never sent to a host other than the API', async () => {
  const seen = [];
  const api = new ApiClient({
    name: 'X',
    baseUrl: 'https://api.example.test',
    headers: { Authorization: 'Bearer secret' },
    retries: 0,
    fetchImpl: async (url, init) => {
      seen.push({ url, auth: init.headers.Authorization });
      if (url.startsWith('https://api.example.test/start')) return new Response(null, { status: 302, headers: { location: 'https://evil.test/collect' } });
      return new Response('[1]', { status: 200, headers: { link: '<https://evil.test/page2>; rel="next"' } });
    },
  });
  await api.get('/start');
  assert.equal(seen[1].url, 'https://evil.test/collect');
  assert.equal(seen[1].auth, undefined, 'redirect followed without the token');
  await assert.rejects(api.paginate('/list'), /refusing to send credentials/);
  await assert.rejects(api.get('https://evil.test/x'), /refusing to send credentials/);
});

test('tar reader: long names, pax paths, and a decompression bomb guard', async () => {
  const long = `top/${'d/'.repeat(80)}file.js`;
  const pax = (path) => {
    const rec = (k, v) => {
      const body = ` ${k}=${v}\n`;
      let len = body.length + 1;
      while (String(len).length + body.length !== len) len = String(len).length + body.length;
      return `${len}${body}`;
    };
    return rec('path', path);
  };
  const raw = tar([{ path: 'top/a.js', content: 'a();\n' }]);
  // Build a pax entry by hand: type 'x' header then the file it names.
  const paxBody = Buffer.from(pax(long));
  const h = Buffer.alloc(512);
  h.write('PaxHeader', 0);
  h.write(paxBody.length.toString(8).padStart(11, '0') + '\0', 124);
  h.write('x', 156);
  h.write('ustar\0', 257);
  const file = tar([{ path: 'top/short.js', content: 'b();\nc();\n' }]).subarray(0, -1024);
  const archive = Buffer.concat([h, paxBody, Buffer.alloc((512 - (paxBody.length % 512)) % 512), file, raw]);
  const got = [];
  await readTarGz(Readable.from([gzipSync(archive)]), { onEntry: () => true, onFile: (e, c) => got.push([e.path, c.toString()]) });
  assert.deepEqual(got.map((g) => g[0]), [long, 'top/a.js']);
  assert.equal(got[0][1], 'b();\nc();\n');

  const bomb = gzipSync(Buffer.alloc(20 * 1024 * 1024));
  await assert.rejects(readTarGz(Readable.from([bomb]), { onEntry: () => true, onFile: () => {}, maxArchiveBytes: 1024 * 1024 }), /larger than/);
});

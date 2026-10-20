// End to end on local repositories: a git server is not needed, file:// remotes behave the same
// for shallow, blob-less clones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { git, analyzeRepo, commitStats, parseLsTree } from '../src/git.js';
import { normalizeConfig, resolveSecret } from '../src/config.js';
import { scan, reprice } from '../src/scan.js';
import { writeReports } from '../src/report/index.js';
import { toCsv } from '../src/report/csv.js';

const DAY = 86400000;

async function makeRepo(dir, commits) {
  await mkdir(dir, { recursive: true });
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_COMMITTER_NAME: 't', GIT_CONFIG_NOSYSTEM: '1', HOME: dir };
  await git(['init', '-q', '-b', 'main', dir], { env });
  await git(['config', 'uploadpack.allowFilter', 'true'], { cwd: dir, env });
  await git(['config', 'uploadpack.allowAnySHA1InWant', 'true'], { cwd: dir, env });
  for (const c of commits) {
    for (const [path, text] of Object.entries(c.files)) {
      await mkdir(join(dir, path, '..'), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    const date = new Date(c.at).toISOString();
    await git(['add', '-A'], { cwd: dir, env });
    await git(['commit', '-q', '-m', 'c'], { cwd: dir, env: { ...env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_EMAIL: c.email || 'a@x', GIT_COMMITTER_EMAIL: c.email || 'a@x' } });
  }
  return pathToFileURL(dir).href;
}

test('commit stats and ls-tree parsing', () => {
  const now = Date.UTC(2026, 0, 1);
  const s = commitStats(`${(now - DAY) / 1000}\tA@x\n${(now - 8 * DAY) / 1000}\ta@x\n${(now - 9 * DAY) / 1000}\tb@x\n`, { now, weeks: 4 });
  assert.deepEqual(s.weekly, [0, 0, 2, 1]);
  assert.equal(s.commits, 3);
  assert.equal(s.authors, 2);
  const t = parseLsTree(Buffer.from(['100644 blob abc\tsrc/a b.js', '120000 blob def\tlink', '160000 commit fff\tsub', ''].join('\x00')));
  assert.deepEqual(t, [{ path: 'src/a b.js', oid: 'abc', size: 0 }]);
});

test('secrets resolve from env, command and value', async () => {
  assert.equal(await resolveSecret({ env: 'X_TOKEN' }, { X_TOKEN: 'abc' }), 'abc');
  assert.equal(await resolveSecret({ value: 'v' }), 'v');
  assert.equal(await resolveSecret({ command: 'node -e "console.log(42)"' }), '42');
  assert.equal(await resolveSecret('$Y', { Y: 'y' }), 'y');
});

test('scan measures local repositories and prices Fusion', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cloc-fusion-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const now = Date.now();
  // busy: 6 commits a week for 4 weeks in a 28-day-old repository
  const busy = [];
  for (let i = 0; i < 24; i++) busy.push({ at: now - (27 - i) * DAY - 3600000, files: { [`src/f${i % 3}.js`]: `const a${i} = ${i};\n`.repeat(i + 1) + '// note\n' }, email: `dev${i % 4}@x` });
  busy.push({ at: now - 3600000, files: { 'node_modules/dep/index.js': 'x();\n'.repeat(1000), 'README.md': '# Readme\n' }, email: 'dev0@x' });
  const busyUrl = await makeRepo(join(root, 'busy'), busy);
  // dormant: last change two years ago
  const dormantUrl = await makeRepo(join(root, 'dormant'), [
    { at: now - 900 * DAY, files: { 'main.py': '# c\n' + 'print(1)\n'.repeat(15000) } },
    { at: now - 800 * DAY, files: { 'util.py': 'x = 1\n' } },
  ]);

  const direct = await analyzeRepo({ name: 'busy', connection: 'local', cloneUrl: busyUrl }, { workDir: join(root, 'work'), windowDays: 365 });
  assert.equal(direct.commits, 25);
  assert.equal(direct.authors, 4);
  assert.ok(direct.windowDays < 30, `young repository window: ${direct.windowDays}`);
  assert.equal(direct.languages.JavaScript.files, 3);
  assert.equal(direct.languages.JavaScript.comment, 3);
  assert.equal(direct.byCategory.docs.code, 1);
  assert.equal(direct.loc, direct.languages.JavaScript.code);

  const cfg = normalizeConfig({
    connections: [{ name: 'local', provider: 'generic', repos: [busyUrl, dormantUrl, pathToFileURL(join(root, 'missing')).href] }],
    fusion: { models: [{ id: 'm', name: 'Fusion', creditsPer10k: 2 }] },
    totals: { extraPercent: 10, bundleCredits: 100 },
  });
  const report = await scan(cfg, { workDir: join(root, 'work') });
  const by = Object.fromEntries(report.repos.map((r) => [r.name, r]));
  assert.equal(by.busy.frequency, 'more-5-week');
  assert.equal(by.busy.scans, 52);
  assert.equal(by.busy.credits, 1 * 52 * 2);
  assert.equal(by.dormant.commits, 0);
  assert.equal(by.dormant.frequency, 'rare');
  assert.equal(by.dormant.loc, 15001);
  assert.equal(by.dormant.units, 2);
  assert.equal(by.dormant.credits, 2 * 1 * 2);
  assert.ok(by.missing.error);
  assert.equal(report.counts.failed, 1);
  assert.equal(report.totals.credits, 104 + 4);
  assert.ok(Math.abs(report.credits.total - 118.8) < 1e-9);
  assert.equal(report.credits.bundles, 2);

  // Re-pricing changes credits without measuring again.
  const again = reprice(report, { fusion: { periodMonths: 6, models: [{ id: 'm', creditsPer10k: 1 }] }, totals: {} });
  assert.equal(again.repos.find((r) => r.name === 'busy').scans, 26);
  assert.equal(again.totals.credits, 26 + 2);

  // Resume reuses what was measured.
  const resumed = await scan(cfg, { workDir: join(root, 'work'), resume: report });
  assert.equal(resumed.repos.find((r) => r.name === 'busy').analyzedAt, by.busy.analyzedAt);

  const out = join(root, 'out');
  const written = await writeReports(report, out);
  assert.equal(written.length, 5);
  assert.ok(written.some((p) => p.endsWith('cloc-fusion-contributors.csv')));
  const html = await readFile(join(out, 'cloc-fusion-report.html'), 'utf8');
  assert.match(html, /Fusion Readiness Report/);
  assert.match(html, /sized and ready for Fusion/);
  assert.ok(!html.includes('</script><'), 'embedded data cannot close the script tag');
  assert.match(toCsv(report), /Suggested Fusion scans/);
});

test('CSV defuses formulas', () => {
  const csv = toCsv({ settings: { fusion: { models: [] } }, repos: [{ fullName: '=HYPERLINK("x")', provider: 'generic' }] });
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
});

#!/usr/bin/env node
// Benchmarks at scale. No network: a mock GitHub API and local git repositories stand in for
// real platforms, so the numbers measure cloc-fusion itself.
//
//   node bench/bench.js                 all scenarios at 10,000 repositories
//   node bench/bench.js api --repos 2000 one scenario, smaller
//
// Scenarios
//   api      API engine: discovery + commits + tarballs for N repos through the mock, with 2% of
//            requests failing (429/502) to prove retries hold up
//   git      git engine: N repositories cloned from local file:// remotes
//   report   building the report and writing HTML/CSV/JSON/Markdown for N repositories
//   loc      line-counting throughput (MB/s)
import { mkdtemp, rm, mkdir, writeFile, symlink, stat } from 'node:fs/promises';
import { tmpdir, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startMockGitHub } from './mock-github.js';
import { normalizeConfig } from '../src/config.js';
import { scan, buildReport } from '../src/scan.js';
import { writeReports } from '../src/report/index.js';
import { git } from '../src/git.js';
import { countText } from '../src/loc.js';
import { languageOf } from '../src/languages.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const which = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const N = opt('repos', 10000);
const CONC = opt('concurrency', 32);
const results = [];

function sampler() {
  let peak = process.memoryUsage().rss;
  const t = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 100);
  return () => {
    clearInterval(t);
    return Math.round(Math.max(peak, process.memoryUsage().rss) / 1048576);
  };
}

async function timed(name, fn) {
  global.gc?.();
  const stop = sampler();
  const t0 = performance.now();
  const extra = await fn();
  const seconds = (performance.now() - t0) / 1000;
  const r = { scenario: name, seconds: Math.round(seconds * 10) / 10, peakRssMB: stop(), ...extra };
  results.push(r);
  console.log(JSON.stringify(r));
  return r;
}

async function apiScenario() {
  const orgs = Math.max(1, Math.ceil(N / 100));
  const mock = await startMockGitHub({ orgs, reposPerOrg: Math.ceil(N / orgs), faultRate: 0.02 });
  const work = await mkdtemp(join(tmpdir(), 'cf-bench-'));
  try {
    const cfg = normalizeConfig({
      engine: 'api',
      concurrency: CONC,
      connections: [{ name: 'mock', provider: 'github', apiUrl: mock.url, auth: { method: 'pat', token: { value: mock.token } }, orgs: 'all' }],
      fusion: { models: [{ id: 'm', name: 'Fusion', creditsPer10k: 1 }] },
    });
    return await timed(`api engine, ${N.toLocaleString()} repos`, async () => {
      const t0 = performance.now();
      const report = await scan(cfg, { workDir: work });
      const s = (performance.now() - t0) / 1000;
      if (mock.stats.tokenLeaks) throw new Error('token leaked to the download host');
      return {
        repos: report.counts.discovered,
        measured: report.counts.measured,
        failed: report.counts.failed,
        requests: mock.stats.requests,
        injectedFaults: mock.stats.faults,
        reposPerSecond: Math.round(report.counts.measured / s),
        requestsPerSecond: Math.round(mock.stats.requests / s),
        concurrency: CONC,
      };
    });
  } finally {
    await mock.close();
    await rm(work, { recursive: true, force: true });
  }
}

async function gitScenario() {
  const root = await mkdtemp(join(tmpdir(), 'cf-bench-git-'));
  try {
    // Three base repositories (busy, medium, dormant); N remotes are links to them.
    const env = { ...process.env, GIT_AUTHOR_NAME: 'b', GIT_COMMITTER_NAME: 'b', GIT_AUTHOR_EMAIL: 'b@x', GIT_COMMITTER_EMAIL: 'b@x' };
    const now = Date.now();
    const bases = [];
    for (const [name, files, lines, commits] of [['busy', 30, 200, 300], ['medium', 100, 300, 60], ['dormant', 10, 100, 0]]) {
      const dir = join(root, 'base', name);
      await mkdir(join(dir, 'src'), { recursive: true });
      await git(['init', '-q', '-b', 'main', dir], { env });
      await git(['config', 'uploadpack.allowFilter', 'true'], { cwd: dir, env });
      await git(['config', 'uploadpack.allowAnySHA1InWant', 'true'], { cwd: dir, env });
      for (let f = 0; f < files; f++) await writeFile(join(dir, 'src', `m${f}.js`), '// m\n' + 'let a = 1;\n'.repeat(lines));
      const old = new Date(now - 800 * 86400000).toISOString();
      await git(['add', '-A'], { cwd: dir, env });
      await git(['commit', '-q', '-m', 'init'], { cwd: dir, env: { ...env, GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old } });
      for (let c = 0; c < commits; c++) {
        const d = new Date(now - (c + 1) * (300 / Math.max(1, commits)) * 86400000).toISOString();
        await git(['commit', '-q', '--allow-empty', '-m', `c${c}`], { cwd: dir, env: { ...env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d } });
      }
      bases.push(dir);
    }
    const links = join(root, 'links');
    await mkdir(links);
    const urls = [];
    for (let i = 0; i < N; i++) {
      const link = join(links, `r${i}`);
      await symlink(bases[i % 3], link, 'junction');
      urls.push(pathToFileURL(link).href);
    }
    const cfg = normalizeConfig({
      engine: 'git',
      concurrency: Math.min(CONC, cpus().length * 2),
      connections: [{ name: 'local', provider: 'generic', repos: urls }],
      fusion: { models: [{ id: 'm', name: 'Fusion', creditsPer10k: 1 }] },
    });
    return await timed(`git engine, ${N.toLocaleString()} repos`, async () => {
      const report = await scan(cfg, { workDir: join(root, 'work') });
      return { repos: report.counts.discovered, measured: report.counts.measured, failed: report.counts.failed, concurrency: cfg.concurrency, credits: report.totals.credits };
    }).then((r) => ({ ...r, reposPerSecond: Math.round((r.measured / r.seconds) * 10) / 10 }));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  }
}

async function reportScenario() {
  const out = await mkdtemp(join(tmpdir(), 'cf-bench-report-'));
  try {
    const repos = Array.from({ length: N }, (_, i) => ({
      provider: 'github', connection: 'c', org: `org${i % 100}`, name: `repo${i}`, fullName: `org${i % 100}/repo${i}`,
      webUrl: `https://github.com/org${i % 100}/repo${i}`, analyzedAt: new Date().toISOString(), engine: 'git',
      loc: (i * 7919) % 400000, files: 50, code: 1, comment: 0, blank: 0, commits: (i * 31) % 900, authors: 5, windowDays: 365,
      weekly: Array.from({ length: 52 }, (_, w) => (i + w) % 9), lastCommitAt: new Date().toISOString(), mainLanguage: 'Java',
      languages: { Java: { category: 'code', files: 50, code: 1, comment: 0, blank: 0 } },
    }));
    const cfg = normalizeConfig({ fusion: { models: [{ id: 'm', name: 'Fusion', creditsPer10k: 1 }] } });
    return await timed(`report, ${N.toLocaleString()} repos`, async () => {
      const t0 = performance.now();
      const report = buildReport(cfg, repos);
      const build = performance.now() - t0;
      const paths = await writeReports(report, out);
      const sizes = {};
      for (const p of paths) sizes[p.split('.').pop()] = `${((await stat(p)).size / 1048576).toFixed(1)} MB`;
      return { buildMs: Math.round(build), sizes };
    });
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

async function locScenario() {
  const js = languageOf('a.js');
  const text = ('// comment\nconst value = compute("a/*b", 42); // trailing\n\n/* block\n comment */\nfunction f(x) { return x * 2; }\n').repeat(200000);
  return timed('line counting', async () => {
    const t0 = performance.now();
    const c = countText(text, js);
    const s = (performance.now() - t0) / 1000;
    return { megabytes: Math.round(text.length / 1048576), mbPerSecond: Math.round(text.length / 1048576 / s), lines: c.code + c.comment + c.blank };
  });
}

const all = { loc: locScenario, report: reportScenario, api: apiScenario, git: gitScenario };
console.log(`cloc-fusion benchmark · ${N.toLocaleString()} repos · node ${process.versions.node} · ${cpus().length} CPUs · ${Math.round(totalmem() / 1073741824)} GB RAM`);
for (const name of which.length ? which : Object.keys(all)) {
  if (!all[name]) throw new Error(`unknown scenario ${name}`);
  await all[name]();
}
console.log('\n| Scenario | Time | Peak memory | Result |\n|---|--:|--:|---|');
for (const r of results) {
  const { scenario, seconds, peakRssMB, ...rest } = r;
  console.log(`| ${scenario} | ${seconds} s | ${peakRssMB} MB | ${Object.entries(rest).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' ? v.toLocaleString() : v}`).join(', ')} |`);
}

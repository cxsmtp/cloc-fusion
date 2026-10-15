// The scan: for every connection, its organizations, their repositories, and per repository the
// lines of code and commit history; then the Fusion suggestion and credits for all of them.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { providerOf } from './providers/index.js';
import { resolveCredentials, redactConfig } from './config.js';
import { analyzeRepo } from './git.js';
import { frequencyOf, frequencyLabel, fusionEstimate, creditSummary } from './fusion.js';
import { globToRegExp } from './languages.js';

export const VERSION = '1.0.0';

const keyOf = (r) => `${r.connection}|${r.fullName}`;

/** Sign in to one connection: { provider, api, secret, who }. */
export async function connect(conn) {
  const provider = providerOf(conn.provider);
  const secret = await resolveCredentials(conn);
  const api = provider.client(conn, secret);
  const who = api ? await provider.whoami(api, conn) : 'git';
  return { provider, api, secret, who };
}

/** The organizations a connection covers: its list, or all it can see when "all". */
export async function orgsOf(conn, session) {
  if (Array.isArray(conn.orgs) && conn.orgs.length) return conn.orgs;
  if (conn.provider === 'generic') return [conn.name];
  const all = await session.provider.listOrgs(session.api, conn);
  return all.map((o) => o.id).filter((id) => id !== '@me' || conn.includePersonal);
}

/** Does a configured override apply to this repository? Keys are full names or globs. */
function overrideFor(cfg, repo) {
  const out = {};
  for (const [pattern, o] of Object.entries(cfg.overrides || {})) {
    const re = globToRegExp(pattern);
    if (re.test(repo.fullName) || re.test(`${repo.connection}:${repo.fullName}`)) Object.assign(out, o);
  }
  return out;
}

/** Every repository to measure, with the reason any is left out. */
export async function discover(cfg, { only = [], log = () => {} } = {}) {
  const repos = [];
  const problems = [];
  const sessions = new Map();
  for (const conn of cfg.connections) {
    if (only.length && !only.some((o) => o === conn.name || o.startsWith(`${conn.name}/`))) continue;
    let session;
    try {
      session = await connect(conn);
      sessions.set(conn.name, session);
      log(`✓ ${conn.name} (${session.provider.label})${session.who ? ` signed in as ${session.who}` : ''}`);
    } catch (err) {
      problems.push({ connection: conn.name, error: err.message });
      log(`✗ ${conn.name}: ${err.message}`);
      continue;
    }
    let orgs;
    try {
      orgs = await orgsOf(conn, session);
    } catch (err) {
      problems.push({ connection: conn.name, error: `could not list ${session.provider.orgNoun}s: ${err.message}` });
      log(`✗ ${conn.name}: could not list ${session.provider.orgNoun}s: ${err.message}`);
      continue;
    }
    const orgFilter = only.filter((o) => o.startsWith(`${conn.name}/`)).map((o) => o.slice(conn.name.length + 1));
    if (orgFilter.length) orgs = orgs.filter((o) => orgFilter.includes(o));
    const inc = (conn.include || []).map(globToRegExp);
    const exc = (conn.exclude || []).map(globToRegExp);
    for (const org of orgs) {
      let list;
      try {
        list = await session.provider.listRepos(session.api, org, conn);
      } catch (err) {
        problems.push({ connection: conn.name, org, error: err.message });
        log(`  ✗ ${org}: ${err.message}`);
        continue;
      }
      let kept = 0;
      for (const r of list) {
        const repo = { ...r, provider: conn.provider, connection: conn.name, org };
        const o = overrideFor(cfg, repo);
        let skip = null;
        if (!cfg.includeArchived && repo.archived) skip = 'archived';
        else if (!cfg.includeForks && repo.fork) skip = 'fork';
        else if (inc.length && !inc.some((re) => re.test(repo.fullName))) skip = 'not included';
        else if (exc.some((re) => re.test(repo.fullName))) skip = 'excluded';
        else if (o.exclude) skip = 'excluded by override';
        repos.push({ ...repo, skip, criticality: o.criticality ?? null, scansOverride: o.scans ?? null, modelOverride: o.model ?? null, locOverride: o.loc ?? null });
        if (!skip) kept++;
      }
      log(`  ${org}: ${list.length} repositories (${kept} to measure)`);
    }
  }
  // The same repository reached twice (two connections, or a group and a subgroup) counts once.
  const seen = new Set();
  const unique = repos.filter((r) => {
    const k = r.cloneUrl?.toLowerCase().replace(/\.git$/, '') || keyOf(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { repos: unique, problems, sessions };
}

/** Run `fn` over `items` with at most `n` at a time. */
async function pool(items, n, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

/** Measure every repository and price Fusion for them. Returns the report object. */
export async function scan(cfg, { only = [], limit = 0, resume = null, workDir = join(tmpdir(), 'cloc-fusion'), keep = false, outDir = null, log = () => {}, progress = () => {} } = {}) {
  const started = Date.now();
  const { repos, problems, sessions } = await discover(cfg, { only, log });
  const previous = new Map((resume?.repos || []).filter((r) => !r.error && r.analyzedAt).map((r) => [keyOf(r), r]));
  let todo = repos.filter((r) => !r.skip);
  if (limit > 0) todo = todo.slice(0, limit);
  const results = new Map();
  let done = 0;
  let lastCheckpoint = Date.now();
  progress({ done, total: todo.length });
  await pool(todo, cfg.concurrency || 4, async (repo) => {
    const prior = previous.get(keyOf(repo));
    if (prior) {
      results.set(keyOf(repo), { ...repo, ...pick(prior) });
    } else if (repo.empty && repo.provider !== 'azure') {
      results.set(keyOf(repo), { ...repo, empty: true, loc: 0, commits: 0, analyzedAt: new Date().toISOString() });
    } else {
      const session = sessions.get(repo.connection);
      const conn = cfg.connections.find((c) => c.name === repo.connection);
      try {
        const m = await analyzeRepo(repo, {
          workDir,
          keep,
          authHeader: session.provider.gitAuthHeader(conn, session.secret),
          windowDays: cfg.windowDays,
          includeMerges: cfg.includeMerges,
          exclude: [...(cfg.exclude || []), ...(conn.excludePaths || [])],
          include: cfg.include || [],
          maxFileBytes: cfg.maxFileBytes,
          countCategories: cfg.countCategories,
          locBasis: cfg.locBasis,
          onPhase: (phase) => progress({ done, total: todo.length, current: repo.fullName, phase }),
        });
        results.set(keyOf(repo), { ...repo, ...m, analyzedAt: new Date().toISOString() });
      } catch (err) {
        results.set(keyOf(repo), { ...repo, error: err.message });
        log(`  ✗ ${repo.fullName}: ${err.message}`);
      }
    }
    done++;
    progress({ done, total: todo.length, current: repo.fullName });
    if (outDir && Date.now() - lastCheckpoint > 30000) {
      lastCheckpoint = Date.now();
      await checkpoint(outDir, cfg, repos, results, problems).catch(() => {});
    }
  });
  const report = buildReport(cfg, repos.map((r) => results.get(keyOf(r)) || r), problems, { started });
  return report;
}

const MEASURED = ['headSha', 'branch', 'commits', 'authors', 'weekly', 'lastCommitAt', 'windowDays', 'treeFiles', 'loc', 'files', 'code', 'comment', 'blank', 'byCategory', 'languages', 'mainLanguage', 'empty', 'analyzedAt'];
const pick = (r) => Object.fromEntries(MEASURED.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));

async function checkpoint(outDir, cfg, repos, results, problems) {
  await mkdir(outDir, { recursive: true });
  const partial = buildReport(cfg, repos.map((r) => results.get(keyOf(r)) || r), problems, { partial: true });
  await writeFile(join(outDir, 'cloc-fusion-partial.json'), JSON.stringify(partial));
}

/** Frequency, Fusion scans and credits for measured repositories; the report object. */
export function buildReport(cfg, repos, problems = [], { started = Date.now(), partial = false } = {}) {
  const rows = repos.map((r) => {
    const measured = r.analyzedAt && !r.error;
    const windowDays = r.windowDays || cfg.windowDays;
    const f = frequencyOf(r.commits ?? 0, windowDays);
    return {
      ...r,
      frequency: measured ? f.id : null,
      frequencyLabel: measured ? frequencyLabel(f.id) : null,
      commitsPerWeek: measured ? Math.round(f.perWeek * 100) / 100 : null,
      commitsPerMonth: measured ? Math.round(((r.commits ?? 0) / windowDays) * 30.44 * 10) / 10 : null,
      included: measured && !r.skip,
    };
  });
  const estimate = fusionEstimate(rows, cfg.fusion);
  // Credits are known once every counted repository's model has a rate; until then, 10K-unit scans.
  const known = estimate.totals.units > 0 ? estimate.totals.unknownRate === 0 : true;
  const summary = { ...creditSummary(known ? estimate.totals.credits : NaN, cfg.totals), known };
  const measured = estimate.rows.filter((r) => r.analyzedAt && !r.error);
  const languages = {};
  for (const r of measured) {
    for (const [name, t] of Object.entries(r.languages || {})) {
      const l = (languages[name] ||= { category: t.category, repos: 0, files: 0, code: 0, comment: 0, blank: 0 });
      l.repos++;
      l.files += t.files;
      l.code += t.code;
      l.comment += t.comment;
      l.blank += t.blank;
    }
  }
  return {
    tool: 'cloc-fusion',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    partial,
    durationSeconds: Math.round((Date.now() - started) / 1000),
    settings: {
      ...redactConfig(cfg),
      fusion: estimate.settings,
    },
    counts: {
      discovered: rows.length,
      skipped: rows.filter((r) => r.skip).length,
      measured: measured.length,
      failed: rows.filter((r) => r.error).length,
      empty: rows.filter((r) => r.empty).length,
    },
    totals: estimate.totals,
    credits: summary,
    byFrequency: estimate.byFrequency,
    byModel: estimate.byModel,
    byOrg: estimate.byOrg,
    languages,
    problems,
    repos: estimate.rows,
  };
}

/** Re-price an existing report with (new) settings, without measuring again. */
export function reprice(report, cfg) {
  return buildReport({ ...report.settings, ...cfg, fusion: cfg.fusion ?? report.settings.fusion, totals: cfg.totals ?? report.settings.totals }, report.repos, report.problems || []);
}

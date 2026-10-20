// The scan: for every connection, its organizations, their repositories, and per repository the
// lines of code and commit history; then the Fusion suggestion and credits for all of them.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { providerOf } from './providers/index.js';
import { resolveCredentials } from './config.js';
import { analyzeRepo, gitVersion } from './git.js';
import { analyzeRepoApi } from './apiengine.js';
import { pool } from './pool.js';
import { buildReport, reprice, overrideMatcher } from './report/build.js';
import { classifyRepos, dedupeRepos } from './discover.js';

export { VERSION } from './version.js';
export { buildReport, reprice } from './report/build.js';

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


/** (host) → may this connection's clone URLs point there? Generic connections: the URLs the user typed. */
function allowedHostsOf(provider, conn) {
  if (provider.allowedHost) return (host) => provider.allowedHost(conn, host);
  if (provider.gitHosts) {
    const hosts = provider.gitHosts(conn);
    if (hosts) return (host) => hosts.includes(host);
  }
  return null;
}

/** Which engine measures repositories: git when it is installed (2.31+), else the platform APIs. */
export async function chooseEngine(requested = 'auto') {
  if (requested === 'api') return 'api';
  const v = await gitVersion().catch(() => null);
  const ok = v && (v.major > 2 || (v.major === 2 && v.minor >= 31));
  if (requested === 'git' && !ok) throw new Error(v ? `${v.text}: the git engine needs git 2.31 or newer (or use --engine api)` : 'git is not installed: use --engine api, or install git');
  return ok ? 'git' : 'api';
}

/** Every repository to measure, with the reason any is left out. Organizations are listed in parallel. */
export async function discover(cfg, { only = [], log = () => {} } = {}) {
  const repos = [];
  const problems = [];
  const sessions = new Map();
  const overrideFor = overrideMatcher(cfg);
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
    const lists = new Array(orgs.length);
    await pool(orgs, cfg.discoveryConcurrency || 8, async (org, i) => {
      try {
        lists[i] = await session.provider.listRepos(session.api, org, conn);
      } catch (err) {
        problems.push({ connection: conn.name, org, error: err.message });
        log(`  ✗ ${org}: ${err.message}`);
      }
    });
    orgs.forEach((org, i) => {
      const list = lists[i];
      if (!list) return;
      const found = classifyRepos(cfg, conn, org, list, overrideFor);
      repos.push(...found);
      const kept = found.filter((r) => !r.skip).length;
      log(`  ${org}: ${list.length} repositories (${kept} to measure)`);
    });
  }
  return { repos: dedupeRepos(repos), problems, sessions };
}

/** Measure every repository and price Fusion for them. Returns the report object. */
export async function scan(cfg, { only = [], limit = 0, resume = null, workDir = null, keep = false, outDir = null, log = () => {}, progress = () => {}, signal = null } = {}) {
  const started = Date.now();
  // A private, random work folder per run (never a predictable shared path in /tmp).
  const ownWorkDir = !workDir;
  if (ownWorkDir) workDir = await mkdtemp(join(tmpdir(), 'cloc-fusion-'));
  try {
    return await runScan(cfg, { only, limit, resume, workDir, keep, outDir, log, progress, started, signal });
  } finally {
    if (ownWorkDir && !keep) await rm(workDir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}

async function runScan(cfg, { only, limit, resume, workDir, keep, outDir, log, progress, started, signal }) {
  const engine = await chooseEngine(cfg.engine);
  log(`Engine: ${engine === 'git' ? 'git (shallow, blob-less clones)' : 'platform APIs (no git needed)'}`);
  const { repos, problems, sessions } = await discover(cfg, { only, log });
  const previous = new Map((resume?.repos || []).filter((r) => !r.error && r.analyzedAt).map((r) => [keyOf(r), r]));
  let todo = repos.filter((r) => !r.skip);
  if (limit > 0) todo = todo.slice(0, limit);
  const results = new Map();
  let done = 0;
  let lastCheckpoint = Date.now();
  progress({ done, total: todo.length });
  await pool(todo, cfg.concurrency || 4, async (repo) => {
    // Stopped: repositories not started yet are left unmeasured; the report says so (partial).
    if (signal?.aborted) return;
    const prior = previous.get(keyOf(repo));
    if (prior) {
      results.set(keyOf(repo), { ...repo, ...pick(prior) });
    } else if (repo.empty && repo.provider !== 'azure') {
      results.set(keyOf(repo), { ...repo, empty: true, loc: 0, commits: 0, analyzedAt: new Date().toISOString() });
    } else {
      const session = sessions.get(repo.connection);
      const conn = cfg.connections.find((c) => c.name === repo.connection);
      try {
        const options = {
          workDir,
          keep,
          windowDays: cfg.windowDays,
          includeMerges: cfg.includeMerges,
          exclude: [...(cfg.exclude || []), ...(conn.excludePaths || [])],
          include: cfg.include || [],
          maxFileBytes: cfg.maxFileBytes,
          maxArchiveBytes: cfg.maxArchiveBytes,
          countCategories: cfg.countCategories,
          locBasis: cfg.locBasis,
          timeoutMs: (cfg.repoTimeoutMinutes || 30) * 60000,
          onPhase: (phase) => progress({ done, total: todo.length, current: repo.fullName, phase }),
        };
        // Generic Git servers have no API: always git.
        const m =
          engine === 'git' || repo.provider === 'generic'
            ? await analyzeRepo(repo, { ...options, authHeader: session.provider.gitAuthHeader(conn, session.secret), allowedHosts: allowedHostsOf(session.provider, conn), allowHttp: conn.provider === 'generic' || /^http:\/\//i.test(conn.apiUrl || '') })
            : await analyzeRepoApi(repo, { ...options, session, conn });
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
  const report = buildReport(cfg, repos.map((r) => results.get(keyOf(r)) || r), problems, { started, partial: Boolean(signal?.aborted) });
  return report;
}

const MEASURED = ['engine', 'headSha', 'branch', 'commits', 'authors', 'devs90', 'bots90', 'contributors90', 'weekly', 'lastCommitAt', 'windowDays', 'treeFiles', 'loc', 'files', 'code', 'comment', 'blank', 'byCategory', 'languages', 'mainLanguage', 'empty', 'analyzedAt'];
const pick = (r) => Object.fromEntries(MEASURED.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));

async function checkpoint(outDir, cfg, repos, results, problems) {
  await mkdir(outDir, { recursive: true });
  const partial = buildReport(cfg, repos.map((r) => results.get(keyOf(r)) || r), problems, { partial: true });
  await writeFile(join(outDir, 'cloc-fusion-partial.json'), JSON.stringify(partial));
}

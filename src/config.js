// The configuration file: connections (a provider, how to sign in, which organizations), what to
// count, and the Fusion pricing. Secrets are referenced, not stored, unless the user asks for that:
//   "token": { "env": "GITHUB_TOKEN" }          read an environment variable (recommended)
//   "token": { "command": "gh auth token" }     run a command and use what it prints
//   "token": { "value": "ghp_…" }               stored in the file (the file is written owner-only)
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { providerOf } from './providers/index.js';

const run = promisify(exec);

export const DEFAULT_CONFIG_FILE = 'cloc-fusion.config.json';

export const DEFAULTS = Object.freeze({
  windowDays: 365,
  concurrency: 4,
  includeArchived: false,
  includeForks: false,
  includeMerges: false,
  maxFileBytes: 2 * 1024 * 1024,
  locBasis: 'code', // code | code+comments | all
  countCategories: ['code', 'markup', 'iac'],
  exclude: [],
  include: [],
  fusion: {
    periodMonths: 12,
    combine: 'higher',
    defaultScans: 1,
    models: [],
    byFrequency: {},
    byCriticality: {},
  },
  totals: { extraPercent: 0, bundleCredits: 10000 },
  overrides: {},
});

export async function loadConfig(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`no configuration at ${file}. Run "cloc-fusion init" to create one with the wizard.`);
    throw err;
  }
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
  return normalizeConfig(cfg);
}

export function normalizeConfig(cfg = {}) {
  const out = { ...DEFAULTS, ...cfg };
  out.fusion = { ...DEFAULTS.fusion, ...(cfg.fusion || {}) };
  out.totals = { ...DEFAULTS.totals, ...(cfg.totals || {}) };
  out.overrides = cfg.overrides || {};
  out.connections = (cfg.connections || []).map((c, i) => {
    if (!c.provider) throw new Error(`connection #${i + 1} has no "provider"`);
    providerOf(c.provider);
    return { name: c.name || `${c.provider}-${i + 1}`, orgs: 'all', auth: { method: 'none' }, ...c };
  });
  const names = new Set();
  for (const c of out.connections) {
    if (names.has(c.name)) throw new Error(`two connections are named "${c.name}"; names must be unique`);
    names.add(c.name);
  }
  return out;
}

export async function saveConfig(file, cfg) {
  const holdsSecret = (cfg.connections || []).some((c) => c.auth?.token?.value || c.auth?.password?.value);
  await writeFile(file, JSON.stringify(cfg, null, 2) + '\n', { mode: holdsSecret ? 0o600 : 0o644 });
  if (holdsSecret) await chmod(file, 0o600).catch(() => {});
}

/** Resolve one secret reference ({env}|{command}|{value}|string) to its text, or '' when unset. */
export async function resolveSecret(ref, env = process.env) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref.startsWith('$') ? env[ref.slice(1)] || '' : ref;
  if (ref.env) return env[ref.env] || '';
  if (ref.value) return String(ref.value);
  if (ref.command) {
    try {
      const { stdout } = await run(ref.command, { timeout: 60000, windowsHide: true });
      return stdout.trim().split(/\r?\n/).pop() || '';
    } catch (err) {
      throw new Error(`the command "${ref.command}" failed: ${(err.stderr || err.message).trim().split(/\r?\n/)[0]}`);
    }
  }
  return '';
}

/** The connection's credentials, resolved: { username, token }. */
export async function resolveCredentials(conn, env = process.env) {
  const auth = conn.auth || {};
  const provider = providerOf(conn.provider);
  const method = provider.authMethods.find((m) => m.id === auth.method);
  let tokenRef = auth.token;
  if (!tokenRef && method?.tokenCommand) tokenRef = { command: method.tokenCommand(conn) };
  const token = await resolveSecret(tokenRef, env);
  const username = typeof auth.username === 'object' ? await resolveSecret(auth.username, env) : auth.username || '';
  if (!token && auth.method && auth.method !== 'none') {
    const where = tokenRef?.env ? `the environment variable ${tokenRef.env} is empty` : 'no token is configured';
    throw new Error(`connection "${conn.name}": ${where}`);
  }
  return { username, token };
}

/** A copy of the configuration safe to put in a report: no secret values. */
export function redactConfig(cfg) {
  return {
    ...cfg,
    connections: (cfg.connections || []).map((c) => ({
      name: c.name,
      provider: c.provider,
      apiUrl: c.apiUrl,
      orgs: c.orgs,
      authMethod: c.auth?.method,
    })),
  };
}

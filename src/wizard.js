// The interactive setup: add connections (provider, address, sign-in, organizations), test each
// one, set the Fusion pricing, and save the configuration file.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync } from 'node:fs';
import { PROVIDERS } from './providers/index.js';
import { DEFAULTS, loadConfig, saveConfig, resolveCredentials } from './config.js';
import { saveToken } from './credentials.js';
import { FREQUENCIES, suggestedScans } from './fusion.js';
import { banner } from './term.js';

const bold = (s) => (stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const green = (s) => (stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s) => (stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s);

class Prompter {
  constructor() {
    this.rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
    // A queue of lines, so answers piped in all at once (scripts, CI) are not lost between questions.
    this.lines = [];
    this.waiters = [];
    this.closed = false;
    this.rl.on('line', (line) => {
      const w = this.waiters.shift();
      if (w) w(line);
      else this.lines.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      for (const w of this.waiters.splice(0)) w(null);
    });
  }

  close() {
    this.rl.close();
  }

  async line(prompt) {
    if (stdin.isTTY) {
      this.rl.setPrompt(prompt);
      this.rl.prompt();
    } else stdout.write(prompt);
    const got = this.lines.length ? this.lines.shift() : this.closed ? null : await new Promise((r) => this.waiters.push(r));
    if (got === null) throw new Error('input ended before the setup was finished');
    if (!stdin.isTTY) stdout.write('\n');
    return got;
  }

  async ask(question, def = '') {
    const a = (await this.line(`${question}${def !== '' ? dim(` [${def}]`) : ''}: `)).trim();
    return a === '' ? String(def) : a;
  }

  async yes(question, def = true) {
    const a = (await this.ask(`${question} (${def ? 'Y/n' : 'y/N'})`)).toLowerCase();
    return a === '' ? def : a.startsWith('y');
  }

  async choose(question, options, def = 1) {
    console.log(`\n${bold(question)}`);
    options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    for (;;) {
      const n = Number(await this.ask('Choose', def));
      if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
      console.log(red(`  Type a number from 1 to ${options.length}.`));
    }
  }

  /** Several of a list: "all", "1,3,5-7", or names. */
  async many(question, options) {
    console.log(`\n${bold(question)}`);
    options.forEach((o, i) => console.log(`  ${String(i + 1).padStart(3)}) ${o.label}`));
    for (;;) {
      const a = await this.ask('Pick numbers (e.g. 1,3,5-7), "all", or type names separated by commas', 'all');
      if (a.toLowerCase() === 'all') return 'all';
      const picked = new Set();
      let ok = true;
      for (const part of a.split(',').map((s) => s.trim()).filter(Boolean)) {
        const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
        if (range) for (let i = +range[1]; i <= +range[2]; i++) options[i - 1] ? picked.add(options[i - 1].id) : (ok = false);
        else if (/^\d+$/.test(part)) options[+part - 1] ? picked.add(options[+part - 1].id) : (ok = false);
        else picked.add(part);
      }
      if (ok && picked.size) return [...picked];
      console.log(red('  That did not match the list; try again.'));
    }
  }

  /** Read a secret without echoing it. */
  async secret(question) {
    if (!stdin.isTTY) return this.ask(question);
    this.rl.pause();
    stdout.write(`${question}: `);
    return new Promise((resolve) => {
      let value = '';
      stdin.setRawMode(true);
      stdin.resume();
      const onData = (buf) => {
        for (const ch of buf.toString('utf8')) {
          if (ch === '\r' || ch === '\n') {
            stdin.setRawMode(false);
            stdin.off('data', onData);
            stdout.write('\n');
            this.rl.resume();
            resolve(value.trim());
            return;
          }
          if (ch === '\u0003') process.exit(130);
          if (ch === '\u007f' || ch === '\b') {
            if (value) {
              value = value.slice(0, -1);
              stdout.write('\b \b');
            }
          } else if (ch >= ' ') {
            value += ch;
            stdout.write('*');
          }
        }
      };
      stdin.on('data', onData);
    });
  }
}

const ENV_NAMES = { github: 'GITHUB_TOKEN', gitlab: 'GITLAB_TOKEN', azure: 'AZURE_DEVOPS_TOKEN', bitbucket: 'BITBUCKET_TOKEN', 'bitbucket-server': 'BITBUCKET_SERVER_TOKEN', generic: 'GIT_TOKEN' };

function webOf(provider, apiUrl) {
  try {
    const u = new URL(apiUrl || provider.defaultApiUrl);
    if (u.host === 'api.github.com') return 'https://github.com';
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

async function addConnection(p, existingNames) {
  const pi = await p.choose('Which Git platform?', PROVIDERS.map((x) => x.label));
  const provider = PROVIDERS[pi];
  const conn = { provider: provider.id };
  let pendingToken = '';

  if (provider.id === 'generic') {
    console.log(dim('\nPaste clone URLs (https://…), one per line; an empty line ends the list.'));
    conn.repos = [];
    for (;;) {
      const url = (await p.line('  URL: ')).trim();
      if (!url) break;
      conn.repos.push(url);
    }
  } else {
    const def = provider.defaultApiUrl;
    console.log(dim(`\nAPI address: ${provider.apiUrlHint}`));
    const url = await p.ask('API address', def);
    if (url && url !== def) conn.apiUrl = url.replace(/\/+$/, '');
    else if (!def) conn.apiUrl = url;
  }

  const methods = provider.authMethods;
  const mi = methods.length === 1 ? 0 : await p.choose('How do you want to sign in?', methods.map((m) => m.label));
  const method = methods[mi];
  conn.auth = { method: method.id };
  if (method.help.length) {
    console.log('');
    const web = webOf(provider, conn.apiUrl);
    for (const line of method.help) console.log(dim(`  ${line.replace('<web>', web)}`));
  }
  if (method.needsUsername) conn.auth.username = await p.ask(method.needsUsername);

  if (method.id !== 'none' && !method.tokenCommand) {
    const where = await p.choose('Where should the token come from each time the tool runs?', [
      'An environment variable (recommended: nothing secret is written to disk)',
      'A command that prints it (a password manager or vault CLI, e.g. `op read op://vault/git/token`)',
      'Save it in your profile (~/.cloc-fusion/credentials.json, owner-only), not in the configuration file',
    ]);
    if (where === 0) {
      const name = await p.ask('Environment variable name', ENV_NAMES[provider.id]);
      conn.auth.token = { env: name };
      if (!process.env[name]) {
        console.log(dim(`  ${name} is not set in this terminal. To test the connection now, paste the token (used for this session only).`));
        const t = await p.secret('  Token (Enter to skip the test)');
        if (t) process.env[name] = t;
      }
    } else if (where === 1) {
      conn.auth.token = { command: await p.ask('Command') };
    } else {
      // Kept out of the configuration file, which is often shared or committed; saved once the connection has a name.
      pendingToken = await p.secret('Token');
      conn.auth.token = { saved: true };
    }
  }

  const host = (() => {
    try {
      return new URL(conn.apiUrl || provider.defaultApiUrl || conn.repos?.[0]).host.replace(/^api\./, '');
    } catch {
      return provider.id;
    }
  })();
  let name = `${provider.id}-${host}`.replace(/[^\w.-]+/g, '-');
  for (let i = 2; existingNames.has(name); i++) name = `${provider.id}-${host}-${i}`;
  conn.name = await p.ask('A name for this connection', name);
  if (pendingToken) await saveToken(conn.name, pendingToken);

  // Test, then pick organizations.
  if (provider.id === 'generic') {
    conn.orgs = [conn.name];
    return conn;
  }
  let session = null;
  try {
    const secret = await resolveCredentials(conn);
    const api = provider.client(conn, secret);
    const who = await provider.whoami(api, conn);
    session = { api, secret };
    console.log(green(`\n✓ Connected${who ? ` as ${who}` : ''}.`));
  } catch (err) {
    console.log(red(`\n✗ Could not connect: ${err.message}`));
    if (!(await p.yes('Keep this connection anyway (fix the token later)?', false))) {
      if (pendingToken) await saveToken(conn.name, '');
      return null;
    }
  }

  let orgs = null;
  if (session) {
    try {
      const list = await provider.listOrgs(session.api, conn);
      if (list.length) {
        const picked = await p.many(`Which ${provider.orgNoun}s should be scanned? (${list.length} found)`, list);
        if (picked === 'all') {
          conn.orgs = 'all';
          conn.includePersonal = list.some((o) => o.id === '@me') ? await p.yes('Include your personal repositories too?', false) : false;
        } else conn.orgs = picked;
        orgs = conn.orgs;
      } else console.log(dim(`  The token lists no ${provider.orgNoun}s.`));
    } catch (err) {
      console.log(red(`  Could not list ${provider.orgNoun}s: ${err.message}`));
    }
  }
  if (!orgs) {
    const typed = await p.ask(`Type the ${provider.orgNoun}s to scan, separated by commas`);
    conn.orgs = typed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (session && Array.isArray(conn.orgs) && conn.orgs.length) {
    try {
      const repos = await provider.listRepos(session.api, conn.orgs[0], conn);
      console.log(green(`✓ ${conn.orgs[0]}: ${repos.length} repositories visible.`));
    } catch (err) {
      console.log(red(`✗ ${conn.orgs[0]}: ${err.message}`));
    }
  }
  return conn;
}

async function fusionSetup(p, cfg) {
  console.log(`\n${bold('Fusion pricing')}`);
  console.log(dim('Credits for one Fusion scan = 10K units of the repository (rounded up) × the model\'s credits per 10K LOC.'));
  const fusion = { ...DEFAULTS.fusion, ...(cfg.fusion || {}) };
  fusion.periodMonths = Number(await p.ask('Projection period in months', fusion.periodMonths)) || 12;
  cfg.windowDays = Number(await p.ask('Commit history window in days (how far back to measure change frequency)', cfg.windowDays ?? DEFAULTS.windowDays)) || 365;
  const models = [...(fusion.models || [])];
  if (models.length) console.log(dim(`  Current models: ${models.map((m) => `${m.name || m.id} (${m.creditsPer10k ?? 'no rate'})`).join(', ')}`));
  if (!models.length || (await p.yes('Change the Fusion models?', false))) {
    models.length = 0;
    for (let i = 1; ; i++) {
      const name = await p.ask(`Model ${i} name (Enter to finish)`, i === 1 ? 'Fusion' : '');
      if (!name) break;
      const rate = await p.ask(`  Credits per 10K LOC for "${name}" (Enter if you don't know yet)`);
      models.push({ id: `model-${i}`, name, creditsPer10k: rate === '' ? null : Number(rate) });
    }
  }
  fusion.models = models;
  console.log(`\n${bold('Suggested Fusion scans per change frequency')} ${dim(`(over ${fusion.periodMonths} months)`)}`);
  for (const f of FREQUENCIES) console.log(dim(`  ${f.label.padEnd(30)} → ${suggestedScans(f.id, fusion.periodMonths)} scan(s)`));
  if (await p.yes('Change any of these?', false)) {
    fusion.byFrequency = {};
    for (const f of FREQUENCIES) {
      const n = await p.ask(`  ${f.label}`, suggestedScans(f.id, fusion.periodMonths));
      fusion.byFrequency[f.id] = { scans: Number(n) };
    }
  }
  cfg.fusion = fusion;
  const totals = { ...DEFAULTS.totals, ...(cfg.totals || {}) };
  totals.extraPercent = Number(await p.ask('Extra credits on top, as a % (headroom)', totals.extraPercent)) || 0;
  totals.bundleCredits = Number(await p.ask('Credits in one bundle', totals.bundleCredits)) || 10000;
  cfg.totals = totals;
}

/** Run the wizard. Returns the saved configuration. */
export async function runWizard(file) {
  const p = new Prompter();
  try {
    console.log(banner('setup', stdout));
    console.log(dim('Connect your Git platforms, pick organizations, and set Fusion pricing. Nothing is scanned until you run "cloc-fusion scan".'));
    let cfg = { ...DEFAULTS, connections: [] };
    if (existsSync(file)) {
      const existing = await loadConfig(file);
      const what = await p.choose(`${file} exists.`, ['Add connections to it', 'Change Fusion pricing only', 'Start over']);
      if (what < 2) cfg = existing;
      if (what === 1) {
        await fusionSetup(p, cfg);
        await saveConfig(file, cfg);
        console.log(green(`\nSaved ${file}`));
        return cfg;
      }
    }
    const names = new Set(cfg.connections.map((c) => c.name));
    do {
      const conn = await addConnection(p, names);
      if (conn) {
        cfg.connections.push(conn);
        names.add(conn.name);
      }
    } while (await p.yes('\nAdd another connection (another platform, server or account)?', false));
    if (!cfg.connections.length) throw new Error('no connection was added');
    cfg.includeArchived = await p.yes('Include archived repositories?', Boolean(cfg.includeArchived));
    cfg.includeForks = await p.yes('Include forks?', Boolean(cfg.includeForks));
    await fusionSetup(p, cfg);
    await saveConfig(file, cfg);
    console.log(green(`\nSaved ${file}`));
    console.log(`Next: ${bold(`cloc-fusion scan --config ${file}`)}`);
    return cfg;
  } finally {
    p.close();
  }
}


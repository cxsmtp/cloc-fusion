#!/usr/bin/env node
// cloc-fusion: count lines of code and commit activity across every repository of your Git
// organizations (GitHub, GitLab, Azure DevOps, Bitbucket, any Git), suggest how often each should
// get a Checkmarx One Fusion scan, and work out the credits that takes.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { DEFAULT_CONFIG_FILE, loadConfig, normalizeConfig } from '../src/config.js';
import { scan, discover, reprice, VERSION } from '../src/scan.js';
import { writeReports, consoleSummary, FORMATS } from '../src/report/index.js';
import { gitVersion } from '../src/git.js';
import { suggestedScans } from '../src/fusion.js';
import { buildInfo, changelogReleases, compareVersions } from '../src/version.js';
import { paint, banner, progressBar } from '../src/term.js';

const HELP = `cloc-fusion ${VERSION} — lines of code, commit activity and Fusion credits for all your repositories

Usage: cloc-fusion <command> [options]

Commands
  ui                   The web app (the default with no command): sign in through the browser,
                       set Fusion pricing, run the scan and watch the credits add up
  init                 Wizard: connect GitHub / GitLab / Azure DevOps / Bitbucket / any Git,
                       pick organizations, set Fusion pricing, save the configuration
  scan                 Discover every repository, measure LOC and commits, write the reports
  list                 Discover repositories only (no cloning): what a scan would cover
  price                Re-price an existing report with new Fusion settings (no rescan)
  ai-plan              Ask Claude for a phased Fusion onboarding plan from a report
  doctor               Check git, Node.js and every connection's sign-in
  version              This copy's version and build, and whether a newer release is out
  changelog            What changed, release by release (--all for every release)
  update               Replace this executable with the latest release (checksum-verified)

Options
  --config <file>          Configuration file (default: ${DEFAULT_CONFIG_FILE})
  --out <dir>              Where reports go (default: ./cloc-fusion-output)
  --format <list>          Report formats: ${FORMATS.join(',')} (default: all)
  --only <conn[/org],...>  Limit to some connections or organizations
  --limit <n>              Measure at most n repositories (try-out runs)
  --engine <auto|git|api>  How repos are measured: git clones, or platform APIs (no git needed).
                           Default auto: git when installed, else APIs
  --concurrency <n>        Repositories measured in parallel (default: 8)
  --window-days <n>        Commit history window (default: 365)
  --period-months <n>      Fusion projection period (default: 12)
  --credits-per-10k <n>    Credits per 10K LOC for one Fusion scan (sets/overrides the first model)
  --extra-percent <n>      Extra credits on top, in % (default: 0)
  --bundle-credits <n>     Credits in one bundle (default: 10000)
  --resume <report.json>   Reuse repositories already measured in an earlier (partial) report
  --work-dir <dir>         Where clones go while measured (default: a private temp folder)
  --keep-clones            Do not delete clones afterwards
  --input <report.json>    Report to read (price, ai-plan)
  --model <id>             Claude model for ai-plan (default: claude-opus-5-5)
  --output <file>          ai-plan: where to save the plan (default: <out>/cloc-fusion-onboarding-plan.md)
  --anonymize              ai-plan: replace repository and organization names with hashes
  --port <n>               ui: local port (default: 4747; 127.0.0.1 only)
  --no-open                ui: do not open the browser
  --quiet                  Less output
  -h, --help / -v, --version

Examples
  cloc-fusion
  cloc-fusion init
  cloc-fusion scan --credits-per-10k 2.5
  cloc-fusion scan --only github-github.com/acme --limit 20
  cloc-fusion price --input cloc-fusion-output/cloc-fusion-report.json --period-months 6 --credits-per-10k 3
  cloc-fusion ai-plan --input cloc-fusion-output/cloc-fusion-report.json
`;

const FLAGS = new Set(['no-open', 'keep-clones', 'quiet', 'anonymize', 'help', 'version', 'all', 'check', 'force']);

// Text from APIs and git is printed without its control characters (no terminal escape tricks).
const clean = (m) => String(m).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') args.help = true;
    else if (a === '-v') args.version = true;
    else if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) args[key] = a.slice(eq + 1);
      else if (FLAGS.has(key)) args[key] = true;
      else {
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) throw new Error(`--${key} needs a value`);
        args[key] = v;
        i++;
      }
    } else args._.push(a);
  }
  return args;
}

const numArg = (args, key) => {
  if (args[key] === undefined) return undefined;
  const n = Number(args[key]);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${key} must be a number ≥ 0`);
  return n;
};

/** Command-line settings over the configuration file's. */
function applyOptions(cfg, args) {
  const out = { ...cfg, fusion: { ...cfg.fusion }, totals: { ...cfg.totals } };
  if (args.engine !== undefined) {
    if (!['auto', 'git', 'api'].includes(args.engine)) throw new Error('--engine must be auto, git or api');
    out.engine = args.engine;
  }
  if (numArg(args, 'concurrency') !== undefined) out.concurrency = Math.max(1, Math.floor(numArg(args, 'concurrency')));
  if (numArg(args, 'window-days') !== undefined) out.windowDays = Math.max(7, numArg(args, 'window-days'));
  if (numArg(args, 'period-months') !== undefined) {
    const before = cfg.fusion?.periodMonths ?? 12;
    out.fusion.periodMonths = numArg(args, 'period-months');
    // Scans still at the old period's suggestion follow the new period; ones set by hand stay.
    out.fusion.byFrequency = Object.fromEntries(
      Object.entries(cfg.fusion?.byFrequency || {}).filter(([id, r]) => r?.scans !== suggestedScans(id, before)),
    );
  }
  if (numArg(args, 'credits-per-10k') !== undefined) {
    const rate = numArg(args, 'credits-per-10k');
    const models = [...(out.fusion.models || [])];
    if (models.length) models[0] = { ...models[0], creditsPer10k: rate };
    else models.push({ id: 'model-1', name: 'Fusion', creditsPer10k: rate });
    out.fusion.models = models;
  }
  if (numArg(args, 'extra-percent') !== undefined) out.totals.extraPercent = numArg(args, 'extra-percent');
  if (numArg(args, 'bundle-credits') !== undefined) out.totals.bundleCredits = numArg(args, 'bundle-credits');
  return out;
}

function progressLine(quiet) {
  if (quiet || !process.stderr.isTTY) return () => {};
  let last = 0;
  return ({ done, total, current, phase }) => {
    if (Date.now() - last < 100 && done < total) return;
    last = Date.now();
    const room = Math.max(8, (process.stderr.columns || 100) - 52);
    const name = current && current.length > room ? `…${current.slice(-(room - 1))}` : current;
    process.stderr.write(`\r\x1b[K${progressBar({ done, total, current: clean(name || ''), phase })}`);
    if (done === total) process.stderr.write('\r\x1b[K');
  };
}

async function readReport(args) {
  const file = args.input || join(args.out || 'cloc-fusion-output', 'cloc-fusion-report.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    throw new Error(`could not read the report ${file}: ${err.code === 'ENOENT' ? 'not found (run "cloc-fusion scan" first, or pass --input)' : err.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) return console.log(VERSION);
  const cmd = args._[0];
  // The daily "newer version available" notice runs alongside long commands and is shown at the end.
  const notice = ['scan', 'list', 'doctor', 'price', 'init'].includes(cmd) ? import('../src/update.js').then((m) => m.updateNotice()).catch(() => '') : Promise.resolve('');
  try {
    await runCommand(cmd, args);
  } finally {
    const text = await Promise.race([notice, new Promise((r) => setTimeout(() => r(''), 3000).unref())]);
    if (text) console.error(`\n${text}`);
  }
}

async function runCommand(cmd, args) {
  if (args.help || cmd === 'help') return console.log(HELP);
  const configFile = resolve(args.config || DEFAULT_CONFIG_FILE);
  const outDir = resolve(args.out || 'cloc-fusion-output');
  const formats = args.format ? String(args.format).split(',').map((s) => s.trim()) : FORMATS;
  // Text from APIs and git is printed without its control characters (no terminal escape tricks).
  const p = paint(process.stderr);
  // ✓ and ✗ in green and red when the terminal has colour.
  const log = args.quiet ? () => {} : (m) => console.error(clean(m).replace(/^(\s*)✓/, `$1${p.ok}`).replace(/^(\s*)✗/, `$1${p.fail}`));
  const only = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (!cmd || cmd === 'ui') {
    const { startUi } = await import('../src/ui/server.js');
    const port = args.port !== undefined ? Number(args.port) : 4747;
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be a port number');
    const ui = await startUi({ configFile, outDir, port, open: !args['no-open'], log });
    console.log(`\n  cloc-fusion ${VERSION} is running at ${ui.url}\n  (this address works only on this computer; press Ctrl+C to stop)\n`);
    await new Promise((done) => {
      const stop = () => ui.close().finally(done);
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return;
  }

  if (cmd === 'version') {
    const b = buildInfo();
    console.log(`cloc-fusion ${VERSION}`);
    console.log(b.kind === 'executable' ? `standalone executable · built ${b.date} from ${b.commit}` : `running from source · Node.js ${process.versions.node}`);
    console.log(`${process.platform}-${process.arch}`);
    const { checkForUpdate } = await import('../src/update.js');
    try {
      const u = await checkForUpdate({ timeoutMs: 8000 });
      console.log(u.newer ? `\nA newer release is out: ${u.latest} (${u.url}). Run "cloc-fusion update".` : `\nUp to date (latest release: ${u.latest}).`);
    } catch (err) {
      console.log(`\nCould not check for a newer release: ${err.message}`);
    }
    return;
  }

  if (cmd === 'changelog') {
    const releases = changelogReleases();
    if (!releases.length) throw new Error('no changelog is available in this copy');
    let shown = releases;
    if (args.since) shown = releases.filter((r) => compareVersions(r.version, args.since) > 0);
    else if (!args.all) shown = releases.slice(0, 1);
    for (const r of shown) console.log(`## ${r.version}${r.date ? ` (${r.date})` : ''}${r.version === VERSION ? '  ← this copy' : ''}\n\n${r.body}\n`);
    if (!args.all && !args.since && releases.length > 1) console.log(`(${releases.length - 1} earlier release${releases.length > 2 ? 's' : ''}: cloc-fusion changelog --all, or --since <version>)`);
    return;
  }

  if (cmd === 'update') {
    const { selfUpdate, checkForUpdate } = await import('../src/update.js');
    if (args.check) {
      const u = await checkForUpdate();
      console.log(u.newer ? `cloc-fusion ${u.latest} is available (you have ${VERSION}): ${u.url}` : `You have the latest version (${VERSION}).`);
      if (u.newer) process.exitCode = 10;
      return;
    }
    console.log(await selfUpdate({ log: (m) => console.error(m), force: Boolean(args.force) }));
    return;
  }

  if (cmd === 'init' || cmd === 'wizard') {
    const { runWizard } = await import('../src/wizard.js');
    await runWizard(configFile);
    return;
  }

  if (cmd === 'doctor') {
    const v = await gitVersion().catch(() => null);
    const gitOk = v && (v.major > 2 || (v.major === 2 && v.minor >= 31));
    console.log(`Node.js ${process.versions.node}${Number(process.versions.node.split('.')[0]) < 18 ? '  ✗ needs 18 or newer' : ''}`);
    console.log(v ? `${v.text}${gitOk ? '' : '  (older than 2.31: the API engine is used)'}` : 'git: not installed (fine: the API engine is used, no git needed)');
    console.log(`Engine: ${gitOk ? 'git' : 'api'} (override with --engine)`);
    const cfg = applyOptions(await loadConfig(configFile), args);
    const { repos, problems } = await discover(cfg, { only, log: (m) => console.log(clean(m)) });
    console.log(`\n${repos.filter((r) => !r.skip).length} repositories to measure, ${repos.filter((r) => r.skip).length} skipped, ${problems.length} problem(s).`);
    if (problems.length) process.exitCode = 1;
    return;
  }

  if (cmd === 'list') {
    const cfg = applyOptions(await loadConfig(configFile), args);
    const { repos, problems } = await discover(cfg, { only, log });
    for (const r of repos) console.log(clean(`${r.skip ? '-' : '+'} ${r.connection}  ${r.fullName}${r.skip ? `  (${r.skip})` : ''}`));
    console.error(`\n${repos.filter((r) => !r.skip).length} to measure, ${repos.filter((r) => r.skip).length} skipped${problems.length ? `, ${problems.length} problem(s)` : ''}.`);
    return;
  }

  if (cmd === 'scan') {
    const cfg = applyOptions(await loadConfig(configFile), args);
    if (!args.quiet) console.error(banner('sizing your estate for Fusion'));
    const resume = args.resume ? JSON.parse(await readFile(resolve(args.resume), 'utf8')) : null;
    const report = await scan(cfg, {
      only,
      limit: numArg(args, 'limit') || 0,
      resume,
      workDir: args['work-dir'] ? resolve(args['work-dir']) : null,
      keep: Boolean(args['keep-clones']),
      outDir,
      log,
      progress: progressLine(args.quiet),
    });
    const written = await writeReports(report, outDir, formats);
    if (!args.quiet) console.log(consoleSummary(report));
    const po = paint(process.stdout);
    const total = report.credits.known ? `${Math.round(report.credits.total).toLocaleString('en-US')} credits` : `${report.totals.unitScans.toLocaleString('en-US')} 10K-unit scans`;
    console.log(`\n  ${po.gradient('◆ Ready for Fusion')}  ${po.bold(`${report.counts.measured.toLocaleString('en-US')} repositories`)} ${po.dim('·')} ${po.bold(total)} ${po.dim(`· ${report.durationSeconds}s`)}`);
    console.log(`\n${po.dim('Reports')}\n${written.map((f) => `  ${po.accent('→')} ${f}`).join('\n')}`);
    if (report.counts.failed || report.problems.length) process.exitCode = 2;
    return;
  }

  if (cmd === 'price') {
    const report = await readReport(args);
    // The configuration file, or settings downloaded from a report ("Tune the plan"): only its
    // Fusion pricing, totals and repository rules are used here.
    let cfg = {};
    let text = null;
    try {
      text = await readFile(configFile, 'utf8');
    } catch (err) {
      if (args.config) throw new Error(`could not read ${configFile}: ${err.message}`);
    }
    if (text !== null) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`${configFile} is not valid JSON: ${err.message}`);
      }
      const n = normalizeConfig({ ...data, connections: [] });
      cfg = { fusion: data.fusion ? n.fusion : undefined, totals: data.totals ? n.totals : undefined, overrides: data.overrides ? n.overrides : undefined };
    }
    const base = normalizeConfig({ ...report.settings, connections: [], ...cfg, fusion: cfg.fusion || report.settings.fusion, totals: cfg.totals || report.settings.totals });
    const next = applyOptions(base, args);
    const priced = reprice(report, { fusion: next.fusion, totals: next.totals, ...(cfg.overrides ? { overrides: cfg.overrides } : {}) });
    priced.settings.connections = report.settings.connections;
    const written = await writeReports(priced, outDir, formats, args.name || 'cloc-fusion-report');
    if (!args.quiet) console.log(consoleSummary(priced));
    console.log(`\nReports:\n${written.map((p) => `  ${p}`).join('\n')}`);
    return;
  }

  if (cmd === 'ai-plan') {
    const report = await readReport(args);
    const { onboardingPlan } = await import('../src/ai.js');
    const file = resolve(args.output || join(outDir, 'cloc-fusion-onboarding-plan.md'));
    console.error('Asking Claude for the onboarding plan…\n');
    const text = await onboardingPlan(report, { model: args.model, anonymize: Boolean(args.anonymize), onText: args.quiet ? null : (t) => process.stdout.write(t) });
    await writeFile(file, text);
    console.error(`\n\nSaved ${file}`);
    return;
  }

  throw new Error(`unknown command "${cmd}". Run "cloc-fusion --help".`);
}

// Behind a corporate proxy: Node's fetch honours HTTPS_PROXY only with NODE_USE_ENV_PROXY (Node 22.21+),
// so re-run with it set. Git reads the proxy variables itself.
const proxied = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxied && !process.env.NODE_USE_ENV_PROXY && Number(process.versions.node.split('.')[0]) >= 22) {
  // A standalone executable takes no Node options on its command line: the argv after it are ours.
  const standalone = Boolean(process.getBuiltinModule?.('node:sea')?.isSea?.());
  const argv = standalone ? process.argv.slice(2) : ['--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)];
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1', ...(standalone ? { NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --disable-warning=UNDICI-EHPA`.trim() } : {}) };
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit', env });
  process.exit(r.status ?? 1);
}

// Output piped into something that stops reading (| head): exit quietly, like other CLIs.
for (const stream of [process.stdout, process.stderr]) stream.on('error', (err) => (err.code === 'EPIPE' ? process.exit(0) : null));

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
});

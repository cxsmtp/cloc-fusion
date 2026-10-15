#!/usr/bin/env node
// cloc-fusion: count lines of code and commit activity across every repository of your Git
// organizations (GitHub, GitLab, Azure DevOps, Bitbucket, any Git), suggest how often each should
// get a Checkmarx One Fusion scan, and work out the credits that takes.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_CONFIG_FILE, loadConfig, normalizeConfig } from '../src/config.js';
import { scan, discover, reprice, VERSION } from '../src/scan.js';
import { writeReports, consoleSummary, FORMATS } from '../src/report/index.js';
import { gitVersion } from '../src/git.js';
import { suggestedScans } from '../src/fusion.js';

const HELP = `cloc-fusion ${VERSION} — lines of code, commit activity and Fusion credits for all your repositories

Usage: cloc-fusion <command> [options]

Commands
  init                 Wizard: connect GitHub / GitLab / Azure DevOps / Bitbucket / any Git,
                       pick organizations, set Fusion pricing, save the configuration
  scan                 Discover every repository, measure LOC and commits, write the reports
  list                 Discover repositories only (no cloning): what a scan would cover
  price                Re-price an existing report with new Fusion settings (no rescan)
  ai-plan              Ask Claude for a phased Fusion onboarding plan from a report
  doctor               Check git, Node.js and every connection's sign-in

Options
  --config <file>          Configuration file (default: ${DEFAULT_CONFIG_FILE})
  --out <dir>              Where reports go (default: ./cloc-fusion-output)
  --format <list>          Report formats: ${FORMATS.join(',')} (default: all)
  --only <conn[/org],...>  Limit to some connections or organizations
  --limit <n>              Measure at most n repositories (try-out runs)
  --concurrency <n>        Repositories measured in parallel (default: 4)
  --window-days <n>        Commit history window (default: 365)
  --period-months <n>      Fusion projection period (default: 12)
  --credits-per-10k <n>    Credits per 10K LOC for one Fusion scan (sets/overrides the first model)
  --extra-percent <n>      Extra credits on top, in % (default: 0)
  --bundle-credits <n>     Credits in one bundle (default: 10000)
  --resume <report.json>   Reuse repositories already measured in an earlier (partial) report
  --work-dir <dir>         Where clones go while measured (default: system temp)
  --keep-clones            Do not delete clones afterwards
  --input <report.json>    Report to read (price, ai-plan)
  --model <id>             Claude model for ai-plan (default: claude-opus-5-5)
  --output <file>          ai-plan: where to save the plan (default: <out>/cloc-fusion-onboarding-plan.md)
  --anonymize              ai-plan: replace repository and organization names with hashes
  --quiet                  Less output
  -h, --help / -v, --version

Examples
  cloc-fusion init
  cloc-fusion scan --credits-per-10k 2.5
  cloc-fusion scan --only github-github.com/acme --limit 20
  cloc-fusion price --input cloc-fusion-output/cloc-fusion-report.json --period-months 6 --credits-per-10k 3
  cloc-fusion ai-plan --input cloc-fusion-output/cloc-fusion-report.json
`;

const FLAGS = new Set(['keep-clones', 'quiet', 'anonymize', 'help', 'version']);

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
    if (Date.now() - last < 120 && done < total) return;
    last = Date.now();
    const pct = total ? Math.floor((done / total) * 100) : 100;
    const what = current ? ` ${current}${phase ? ` (${phase})` : ''}` : '';
    process.stderr.write(`\r\x1b[K[${done}/${total} ${pct}%]${what}`.slice(0, (process.stderr.columns || 100) + 4));
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
  if (args.help || !cmd || cmd === 'help') return console.log(HELP);
  const configFile = resolve(args.config || DEFAULT_CONFIG_FILE);
  const outDir = resolve(args.out || 'cloc-fusion-output');
  const formats = args.format ? String(args.format).split(',').map((s) => s.trim()) : FORMATS;
  const log = args.quiet ? () => {} : (m) => console.error(m);
  const only = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (cmd === 'init' || cmd === 'wizard') {
    const { runWizard } = await import('../src/wizard.js');
    await runWizard(configFile);
    return;
  }

  if (cmd === 'doctor') {
    const v = await gitVersion().catch((e) => ({ text: `✗ ${e.message}` }));
    console.log(`Node.js ${process.versions.node}${Number(process.versions.node.split('.')[0]) < 18 ? '  ✗ needs 18 or newer' : ''}`);
    console.log(`${v.text}${v.major && (v.major < 2 || (v.major === 2 && v.minor < 31)) ? '  ✗ needs git 2.31 or newer' : ''}`);
    const cfg = applyOptions(await loadConfig(configFile), args);
    const { repos, problems } = await discover(cfg, { only, log: console.log });
    console.log(`\n${repos.filter((r) => !r.skip).length} repositories to measure, ${repos.filter((r) => r.skip).length} skipped, ${problems.length} problem(s).`);
    if (problems.length) process.exitCode = 1;
    return;
  }

  if (cmd === 'list') {
    const cfg = applyOptions(await loadConfig(configFile), args);
    const { repos, problems } = await discover(cfg, { only, log });
    for (const r of repos) console.log(`${r.skip ? '-' : '+'} ${r.connection}  ${r.fullName}${r.skip ? `  (${r.skip})` : ''}`);
    console.error(`\n${repos.filter((r) => !r.skip).length} to measure, ${repos.filter((r) => r.skip).length} skipped${problems.length ? `, ${problems.length} problem(s)` : ''}.`);
    return;
  }

  if (cmd === 'scan') {
    const v = await gitVersion();
    if (v.major < 2 || (v.major === 2 && v.minor < 31)) throw new Error(`${v.text}: cloc-fusion needs git 2.31 or newer`);
    const cfg = applyOptions(await loadConfig(configFile), args);
    const resume = args.resume ? JSON.parse(await readFile(resolve(args.resume), 'utf8')) : null;
    const report = await scan(cfg, {
      only,
      limit: numArg(args, 'limit') || 0,
      resume,
      workDir: resolve(args['work-dir'] || join(tmpdir(), 'cloc-fusion')),
      keep: Boolean(args['keep-clones']),
      outDir,
      log,
      progress: progressLine(args.quiet),
    });
    const written = await writeReports(report, outDir, formats);
    if (!args.quiet) console.log(consoleSummary(report));
    console.log(`\nReports:\n${written.map((p) => `  ${p}`).join('\n')}`);
    if (report.counts.failed || report.problems.length) process.exitCode = 2;
    return;
  }

  if (cmd === 'price') {
    const report = await readReport(args);
    let cfg = {};
    try {
      const fileCfg = await loadConfig(configFile);
      cfg = { fusion: fileCfg.fusion, totals: fileCfg.totals };
    } catch {}
    const base = normalizeConfig({ ...report.settings, connections: [], ...cfg, fusion: cfg.fusion || report.settings.fusion, totals: cfg.totals || report.settings.totals });
    const next = applyOptions(base, args);
    const priced = reprice(report, { fusion: next.fusion, totals: next.totals });
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
  const r = spawnSync(process.execPath, ['--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(r.status ?? 1);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
});

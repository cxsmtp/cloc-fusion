// Builds cloc-fusion.html: the whole tool as one HTML file that opens straight from disk, with no
// install and no hosting. The page's script is src/browser/main.js and everything it imports,
// bundled by esbuild (a build-time tool only; the page needs nothing). Run: node scripts/build-standalone.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { NEXTGEN_CSS } from '../src/report/theme.js';
import { UI_CSS } from '../src/ui/page.js';
import { VERSION } from '../src/version.js';

const root = new URL('..', import.meta.url).pathname;
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
mkdirSync(`${root}dist`, { recursive: true });
const out = `${root}dist/standalone.js`;
execFileSync(npx, ['--yes', 'esbuild@0.25.10', 'src/browser/main.js', '--bundle', '--platform=browser', '--format=iife', '--target=es2022', '--alias:node:fs=./src/browser/fs-stub.js', `--outfile=${out}`, '--log-level=warning', '--legal-comments=none', ...(process.env.NO_MINIFY ? [] : ['--minify'])], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
let js = readFileSync(out, 'utf8');
rmSync(out);
// The script is inline: nothing in it may close the <script> element or open an HTML comment.
js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const CSP = ["default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", 'font-src data:', 'img-src data:', 'connect-src https: http:', "base-uri 'none'", "form-action 'none'"].join('; ');
const page = `<!doctype html>
<html lang="en" data-theme="dark" data-accent="indigo">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="color-scheme" content="dark light">
<meta name="generator" content="cloc-fusion ${VERSION}">
<title>cloc-fusion</title>
<style>${NEXTGEN_CSS}${UI_CSS}
.note{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:12px 14px;border-radius:14px;font-size:12.5px;color:var(--muted);border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface-2) 70%,transparent)}
.note b{color:var(--text)}
</style>
</head>
<body>
<div class="aurora" aria-hidden="true"><i></i><i></i></div>
<header class="topbar"><div class="topbar-in">
<div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9"/><path d="M17 3v4.5h-4.5M7 21v-4.5h4.5"/></svg></span><span class="brand-name">cloc·<b>fusion</b></span></div>
<span class="chip" id="version"></span>
<span class="chip path">one file · nothing to install</span>
<span class="spacer"></span>
<button type="button" id="import" class="sm" title="Load settings: a cloc-fusion.config.json, settings downloaded from a report, or a report">Import settings</button><input type="file" id="import-file" accept=".json,application/json" hidden>
<button type="button" id="export" class="sm" title="Save these settings as cloc-fusion.config.json (no tokens)">Export settings</button>
<button type="button" id="reset" class="sm ghost" title="Back to the defaults">Reset</button>
<button type="button" id="theme" class="sm icon-btn" title="Dark or light" aria-label="Dark or light"><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/></svg></button>
</div></header>
<main class="wrap">
<div>
<section class="glass hero">
<div class="eyebrow">Fusion planner · runs in this browser</div>
<h1>Size every repository for <span class="grad">Fusion</span>, from one file</h1>
<p>Sign in to your Git platforms, check the pricing, and run the scan. Every repository is counted and priced right here, in this page: nothing to install, nothing hosted, and nothing leaves your computer except the calls to your own Git platforms.</p>
<div class="note"><span>🔒</span><span><b>Tokens stay in this page's memory</b> and are gone when you close it. Settings (never tokens) are remembered in this browser. GitHub may not allow archive downloads from a page opened from disk; its lines of code are then estimated from GitHub's language statistics and marked as such. For exact counts there, use the cloc-fusion app.</span></div>
</section>
<section class="glass card"><div class="card-h"><span class="step">1</span><h2>Connections</h2></div><p class="lede">Sign in to every connection with a token before the scan. <b>Create a token</b> opens the platform's page with the right permissions ticked where it can.</p><div id="connections"></div></section>
<section class="glass card"><div class="card-h"><span class="step">2</span><h2>Fusion pricing</h2></div><p class="lede">Credits = 10K units of code × Fusion scans × the model's credits per 10K LOC. After a scan, the estimate follows every change.</p><div id="pricing"></div></section>
<section class="glass card"><div class="card-h"><span class="step">3</span><h2>Scan settings</h2></div><p class="lede">What counts as code, and how far back to look at commits.</p><div id="settings"></div></section>
<section class="glass card"><div class="card-h"><span class="step">4</span><h2>Repository rules</h2></div><p class="lede">Raise the cadence of critical repositories, pin a model, or skip some. Patterns like <code>acme/payments-*</code> work.</p><div id="overrides"></div></section>
</div>
<aside class="side">
<section class="glass plan" id="plan"></section>
<section class="glass plan" id="progress" hidden></section>
<section class="glass plan" id="estimate"></section>
</aside>
<footer><span>cloc-fusion ${VERSION} · standalone page</span><span>Runs in this browser only · nothing leaves it except calls to your Git platforms</span></footer>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<noscript><p style="position:fixed;inset:auto 0 0;padding:16px;text-align:center;background:#7f1d1d;color:#fff">cloc-fusion needs JavaScript to run.</p></noscript>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(`${root}cloc-fusion.html`, page);
console.log(`Built cloc-fusion.html (${(page.length / 1024).toFixed(0)} KB, version ${VERSION})`);

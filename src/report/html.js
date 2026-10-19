// A single self-contained HTML report in the next-gen look (src/report/theme.js): a hero with the
// credits and readiness, the journey from discovery to a Fusion plan, the cadence of scans, the
// breakdowns, and a sortable, searchable repository table. No external resources: it opens
// anywhere, offline, and renders the same everywhere (fonts embedded).
import { num, esc, modelName } from './format.js';
import { NEXTGEN_CSS } from './theme.js';
import { VERSION } from '../version.js';
import { TUNE_CSS, tuneBase, tuneSection, tuner } from './tune.js';
import { BRAND_CSS, BRAND_MARK } from './brand.js';

/** A figure that counts up when shown (the final value is in the markup, so it reads without script). */
const count = (value, digits = 0) => (Number.isFinite(Number(value)) ? `<span class="count" data-to="${Number(value)}" data-digits="${digits}">${num(value, digits)}</span>` : '—');

const tile = (label, value, note = '', icon = '', id = '') => `<div class="tile reveal"${id ? ` id="${id}"` : ''}>${icon ? `<div class="tile-icon" aria-hidden="true">${icon}</div>` : ''}<div class="tile-label">${esc(label)}</div><div class="tile-value">${value}</div>${note ? `<div class="tile-note">${note}</div>` : ''}</div>`;

const ICONS = {
  repo: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h12"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13 4l-2 16"/></svg>',
  pulse: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  scan: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  look: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/></svg>',
};

export function toHtml(report) {
  const t = report.totals;
  const k = report.counts;
  const f = report.settings.fusion;
  const c = report.credits;
  const priced = c.known;
  const maxScans = Math.max(1, ...report.byFrequency.map((b) => b.scans));
  const toMeasure = Math.max(1, k.discovered - k.skipped);
  const readyPct = k.discovered ? Math.min(100, Math.round((k.measured / toMeasure) * 100)) : 0;
  const weekly = t.commits / Math.max(1, report.settings.windowDays / 7);
  const generated = new Date(report.generatedAt);
  const digits = (v) => (v < 100 ? 1 : 0);

  const cadence = report.byFrequency
    .map((b) => {
      const each = f.byFrequency[b.id]?.scans;
      return `<div class="cad-row${b.repos ? '' : ' dim'}">
<div class="cad-label">${esc(b.label)}<span class="cad-sub">${num(each)} scan${each === 1 ? '' : 's'} each</span></div>
<div class="cad-bar"><span style="--w:${((b.scans / maxScans) * 100).toFixed(1)}%"></span></div>
<div class="cad-fig"><b>${num(b.repos)}</b> repos</div>
<div class="cad-fig"><b>${num(b.scans)}</b> scans</div>
<div class="cad-fig cad-credits">${priced ? `<b>${num(b.credits, 1)}</b> credits` : '—'}</div>
</div>`;
    })
    .join('');
  const orgRows = report.byOrg
    .map((o) => `<tr><td>${esc(o.connection)}</td><td>${esc(o.org)}</td><td class="n">${num(o.repos)}</td><td class="n">${num(o.counted)}</td><td class="n">${num(o.lines)}</td><td class="n">${num(o.commits)}</td><td class="n">${num(o.scans)}</td><td class="n">${priced ? num(o.credits, 1) : '—'}</td></tr>`)
    .join('');
  const langs = Object.entries(report.languages).sort((a, b) => b[1].code - a[1].code);
  const langMax = Math.max(1, ...langs.map(([, l]) => l.code));
  const langRows = langs
    .slice(0, 12)
    .map(([name, l]) => `<div class="lang"><span class="lang-name">${esc(name)}<i>${esc(l.category)}</i></span><span class="lang-bar"><span style="--w:${((l.code / langMax) * 100).toFixed(1)}%"></span></span><span class="lang-fig">${num(l.code)}</span></div>`)
    .join('');
  const modelRows = (report.byModel || [])
    .map((m) => `<tr><td>${esc(m.name || m.id)}</td><td class="n">${m.rate === null ? '<span class="warn">not set</span>' : num(m.rate, 2)}</td><td class="n">${num(m.repos)}</td><td class="n">${num(m.unitScans)}</td><td class="n">${num(m.credits, 1)}</td></tr>`)
    .join('');

  const data = report.repos.map((r) => ({
    p: r.provider,
    c: r.connection,
    o: r.org,
    n: r.fullName,
    u: /^https?:\/\//i.test(r.webUrl || '') ? r.webUrl : null,
    lg: r.mainLanguage || '',
    loc: r.lines ?? r.loc ?? null,
    es: r.locEstimated ? 1 : 0,
    cm: r.commits ?? null,
    cw: r.commitsPerWeek ?? null,
    au: r.authors ?? null,
    lc: r.lastCommitAt ? r.lastCommitAt.slice(0, 10) : '',
    fq: r.frequencyLabel || '',
    fr: r.frequency || '',
    cr: r.criticality ?? null,
    so: r.scansOverride ?? null,
    mo: r.modelOverride ?? null,
    mi: r.included ? r.model ?? null : null,
    inc: r.included && r.units > 0 ? 1 : 0,
    sc: r.included ? r.scans : null,
    un: r.included ? r.units : null,
    md: r.included ? modelName(report, r.model) : '',
    cd: r.included ? r.credits : null,
    w: r.weekly || [],
    st: r.error ? 'failed' : r.skip ? r.skip : r.empty ? 'empty' : r.analyzedAt ? 'ok' : 'pending',
    er: r.error || '',
  }));
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  const heroFigure = priced
    ? `<div class="hero-figure">${count(c.total, digits(c.total))}</div><div class="hero-unit">Fusion credits · ${num(f.periodMonths)} months</div>`
    : `<div class="hero-figure">${count(t.unitScans)}</div><div class="hero-unit">10K-unit Fusion scans · ${num(f.periodMonths)} months</div>`;
  const heroPills = priced
    ? `<span class="pill glow">${num(c.bundles)} bundle${c.bundles === 1 ? '' : 's'} of ${num(c.settings.bundleCredits)}</span>${c.settings.extraPercent ? `<span class="pill">incl. ${num(c.settings.extraPercent, 2)}% headroom</span>` : ''}`
    : '<span class="pill warn-pill">Set credits per 10K LOC to price the plan</span>';

  const journey = [
    ['Discovered', `${num(k.discovered)} repositories`, k.discovered > 0],
    ['Measured', `${num(t.lines)} lines of code`, k.measured > 0],
    ['Planned', `${num(t.scans)} Fusion scans`, t.scans > 0],
    ['Ready for Fusion', priced ? `${num(c.total, digits(c.total))} credits` : 'awaiting pricing', priced && t.scans > 0],
  ]
    .map(([title, sub, done], i) => `<li class="step${done ? ' done' : ''}" style="--i:${i}"><span class="step-dot" aria-hidden="true">${ICONS.check}</span><span class="step-title">${esc(title)}</span><span class="step-sub"${i === 3 ? ' id="step-ready"' : ''}>${esc(sub)}</span></li>`)
    .join('');
  const version = esc(report.version || VERSION);

  return `<!doctype html>
<html lang="en" data-theme="dark" data-accent="indigo">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="generator" content="cloc-fusion ${version}">
<title>Fusion Readiness Report</title>
<script>try{var d=document.documentElement,t=localStorage.getItem('cf-theme'),a=localStorage.getItem('cf-accent');if(t==='auto')d.removeAttribute('data-theme');else if(t==='light')d.setAttribute('data-theme','light');if(/^(indigo|cyan|emerald|violet|amber)$/.test(a||''))d.setAttribute('data-accent',a)}catch(e){}</script>
<style>
${NEXTGEN_CSS}
${TUNE_CSS}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;color:var(--text);font:14.5px/1.55 var(--font);font-feature-settings:"kern","liga","ss01";-webkit-font-smoothing:antialiased;background-color:var(--bg);
background-image:radial-gradient(640px 360px at 18% -80px,var(--ng-ambient-1),transparent 70%),radial-gradient(560px 460px at 105% 24%,var(--ng-ambient-2),transparent 70%),radial-gradient(760px 400px at 40% 105%,var(--ng-ambient-3),transparent 70%);background-attachment:fixed;
transition:background-color .45s var(--ease),color .45s var(--ease)}
::selection{background:color-mix(in srgb,var(--ng-from) 32%,transparent)}
*{scrollbar-width:thin;scrollbar-color:var(--border-strong) transparent}
:focus-visible{outline:2px solid color-mix(in srgb,var(--ng-from) 75%,transparent);outline-offset:2px;border-radius:8px}
.aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.aurora i{position:absolute;width:56vmax;height:56vmax;border-radius:50%;opacity:.30;will-change:transform;background:radial-gradient(circle,var(--c) 0,transparent 62%)}
.aurora i:nth-child(1){--c:var(--ng-from);top:-22vmax;left:-12vmax;animation:drift1 26s var(--ease) infinite alternate}
.aurora i:nth-child(2){--c:var(--ng-to);top:18vh;right:-20vmax;animation:drift2 32s var(--ease) infinite alternate}
.aurora i:nth-child(3){--c:#10b981;bottom:-30vmax;left:30vw;opacity:.12;animation:drift3 38s var(--ease) infinite alternate}
:root[data-theme="light"] .aurora i{opacity:.09}
@keyframes drift1{to{transform:translate(12vmax,8vmax) scale(1.12)}}
@keyframes drift2{to{transform:translate(-10vmax,12vmax) scale(.92)}}
@keyframes drift3{to{transform:translate(-14vmax,-8vmax) scale(1.08)}}
.wrap{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:0 20px 72px}
.topbar{position:sticky;top:0;z-index:20;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:color-mix(in srgb,var(--bg) 70%,transparent);border-bottom:1px solid var(--ng-glass-line)}
.topbar-in{max-width:1280px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:12px}
.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:inherit}
.brand-mark{position:relative;width:34px;height:34px;border-radius:11px;background:var(--ng-solid);display:grid;place-items:center;box-shadow:0 6px 18px -6px var(--ng-glow),inset 0 1px 0 rgb(255 255 255/.2)}
.brand-mark svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.brand-mark::after{content:"";position:absolute;right:-3px;bottom:-3px;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid var(--bg);box-shadow:0 0 10px #10b981;animation:live 2.4s ease-in-out infinite}
@keyframes live{50%{box-shadow:0 0 2px #10b981}}
.brand-name{font-weight:700;letter-spacing:-.02em;font-size:16.5px;background:var(--ng-wordmark);-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-name b{background:linear-gradient(90deg,var(--ng-from),var(--ng-to));-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}
.chip{font-family:var(--mono);font-size:11px;letter-spacing:.04em;padding:3px 9px;border-radius:999px;border:1px solid var(--ng-glass-line);color:var(--muted);background:color-mix(in srgb,var(--surface) 60%,transparent);white-space:nowrap}
.spacer{flex:1}
button,.btn{font:600 13px/1 var(--font);color:var(--text);display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 80%,transparent);cursor:pointer;
transition:background .2s var(--ease),border-color .2s var(--ease),box-shadow .25s var(--ease),transform .12s var(--ease),filter .2s}
button svg,.btn svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
button:hover,.btn:hover{border-color:color-mix(in srgb,var(--ng-from) 45%,transparent);background:color-mix(in srgb,var(--ng-from) 9%,var(--surface));box-shadow:0 6px 18px -10px var(--ng-glow);transform:translateY(-1px)}
button:active,.btn:active{transform:translateY(1px);transition-duration:.05s}
button.primary{color:#fff;border-color:transparent;background:var(--ng-solid);box-shadow:0 8px 22px -10px var(--ng-glow),inset 0 1px 0 rgb(255 255 255/.18)}
button.primary:hover{filter:brightness(1.1);background:var(--ng-solid);box-shadow:0 12px 30px -10px var(--ng-glow),inset 0 1px 0 rgb(255 255 255/.22)}
button.golden{color:#3a2300;border-color:#c99418;background:linear-gradient(120deg,#fff1b8 0%,#f8d55c 28%,#e3a812 52%,#f8d55c 76%,#fff1b8 100%);background-size:220% 100%;
box-shadow:0 0 0 1px rgb(255 214 92/.6),0 2px 10px rgb(227 168 18/.45),0 0 22px 6px color-mix(in srgb,var(--ng-from) 55%,transparent),0 0 46px 14px color-mix(in srgb,var(--ng-to) 28%,transparent);animation:gold 6s linear infinite}
button.golden:hover{filter:brightness(1.05);background:linear-gradient(120deg,#fff6cf 0%,#fbdf72 28%,#ecb424 52%,#fbdf72 76%,#fff6cf 100%);background-size:220% 100%;border-color:#c99418;box-shadow:0 0 0 1px rgb(255 214 92/.7),0 4px 14px rgb(227 168 18/.5),0 0 28px 9px color-mix(in srgb,var(--ng-from) 70%,transparent),0 0 56px 18px color-mix(in srgb,var(--ng-to) 40%,transparent)}
@keyframes gold{to{background-position:220% 0}}
.icon{width:36px;padding:0;justify-content:center}
.look{position:relative}
.look>summary{list-style:none}
.look>summary::-webkit-details-marker{display:none}
.look[open]>summary{border-color:var(--ng-from);color:var(--accent)}
.look-pop{position:absolute;right:0;top:calc(100% + 8px);width:min(290px,90vw);display:grid;gap:14px;padding:16px;border-radius:16px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:var(--shadow-pop);transform-origin:top right;animation:pop .22s var(--ease)}
@keyframes pop{from{opacity:0;transform:translateY(-6px) scale(.97)}}
.look-pop fieldset{border:0;margin:0;padding:0;display:grid;gap:8px}
.look-pop legend{font:600 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ng-head);margin-bottom:6px;padding:0}
.seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;padding:3px;border-radius:12px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface-2) 80%,transparent)}
.seg label{position:relative;display:grid;place-items:center;min-height:32px;border-radius:9px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--muted);transition:background .2s var(--ease),color .2s,box-shadow .2s}
.seg input,.swatches input{position:absolute;opacity:0;pointer-events:none}
.seg label:has(input:checked){color:var(--text);background:linear-gradient(135deg,color-mix(in srgb,var(--ng-from) 24%,transparent),color-mix(in srgb,var(--ng-to) 12%,transparent));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ng-from) 40%,transparent)}
.seg label:has(input:focus-visible),.swatches label:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.swatches{display:flex;gap:10px}
.swatches label{position:relative;width:30px;height:30px;border-radius:50%;cursor:pointer;background:linear-gradient(135deg,var(--a),var(--b));box-shadow:inset 0 0 0 1px rgb(255 255 255/.25);transition:transform .2s var(--ease),box-shadow .2s}
.swatches label:hover{transform:scale(1.1)}
.swatches label:has(input:checked){box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--a),0 0 18px var(--a)}
.glass{background:var(--ng-glass);border:1px solid var(--ng-glass-line);border-radius:20px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:var(--shadow)}
.hero{position:relative;margin-top:28px;padding:34px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:28px;align-items:center;overflow:hidden;isolation:isolate}
.hero::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(135deg,color-mix(in srgb,var(--ng-from) 70%,transparent),transparent 40%,transparent 60%,color-mix(in srgb,var(--ng-to) 60%,transparent));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.hero::after{content:"";position:absolute;width:440px;height:440px;right:-130px;top:-170px;border-radius:50%;background:radial-gradient(circle,var(--ng-glow),transparent 65%);z-index:-1;animation:breathe 7s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.15);opacity:.7}}
.eyebrow{font:600 11px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:8px}
.eyebrow::before{content:"";width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 12px #10b981}
.hero h1{font-size:clamp(28px,4.2vw,46px);line-height:1.08;letter-spacing:-.035em;margin:14px 0 12px;font-weight:700}
.hero h1 .grad{background:linear-gradient(100deg,var(--ng-from),var(--ng-to) 55%,#10b981);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sheen 8s ease-in-out infinite alternate}
@keyframes sheen{to{background-position:100% 0}}
.hero p{color:var(--muted);font-size:15.5px;margin:0 0 22px;max-width:58ch}
.hero-actions{display:flex;gap:10px;flex-wrap:wrap}
.hero-side{display:grid;justify-items:center;text-align:center;gap:10px}
.ring{position:relative;width:min(240px,64vw);aspect-ratio:1}
.ring svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.ring .track{stroke:color-mix(in srgb,var(--text) 9%,transparent)}
.ring .val{stroke:url(#ringGrad);stroke-linecap:round;stroke-dasharray:100 100;stroke-dashoffset:calc(100 - var(--p));filter:drop-shadow(0 0 6px var(--ng-glow));transition:stroke-dashoffset 1.6s var(--ease)}
.ring-in{position:absolute;inset:0;display:grid;place-content:center;gap:4px;padding:0 18%}
.hero-figure{font:600 clamp(28px,3.6vw,40px)/1 var(--mono);letter-spacing:-.04em}
.hero-unit{font-size:12px;color:var(--muted)}
.hero-pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pill{font:600 11.5px var(--mono);padding:5px 11px;border-radius:999px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 65%,transparent);color:var(--muted);white-space:nowrap}
.pill.glow{color:var(--accent);border-color:color-mix(in srgb,var(--ng-from) 40%,transparent);box-shadow:0 0 18px -6px var(--ng-glow)}
.warn-pill{color:var(--warn)}
.ready-label{font:600 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ng-head)}
.journey{list-style:none;margin:18px 0 0;padding:18px 22px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.step{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center}
.step-dot{grid-row:span 2;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--ng-glass-line);background:var(--surface-2);color:var(--muted);transition:background .5s var(--ease) calc(var(--i)*.18s),box-shadow .5s var(--ease) calc(var(--i)*.18s),color .5s calc(var(--i)*.18s)}
.step-dot svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.in .step.done .step-dot,body:not(.pre) .step.done .step-dot{color:#fff;border-color:transparent;background:linear-gradient(135deg,var(--ng-from),var(--ng-to));box-shadow:0 0 0 4px color-mix(in srgb,var(--ng-from) 16%,transparent),0 0 20px var(--ng-glow)}
.step-title{font-weight:700;font-size:14px}
.step-sub{font:500 12px var(--mono);color:var(--muted)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:14px;margin-top:18px}
.tile{position:relative;overflow:hidden;padding:18px 18px 16px;border-radius:18px;background:var(--ng-glass);border:1px solid var(--ng-glass-line);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:var(--shadow);transition:transform .35s var(--ease),box-shadow .35s var(--ease),border-color .35s,opacity .7s var(--ease)}
.tile::before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,var(--ng-from),var(--ng-to));opacity:.7}
.tile:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--ng-from) 35%,transparent);box-shadow:var(--shadow),0 18px 40px -22px var(--ng-glow)}
.tile-icon{position:absolute;right:14px;top:14px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:var(--accent);background:var(--accent-soft)}
.tile-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.tile-label{font:600 10.5px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ng-head)}
.tile-value{font:600 28px/1.15 var(--mono);letter-spacing:-.03em;margin-top:8px}
.tile-note{font-size:12.5px;color:var(--muted);margin-top:4px}
h2{font-size:19px;font-weight:700;letter-spacing:-.015em;margin:44px 0 6px;display:flex;align-items:center;gap:10px}
.n-chip{font:600 11px var(--mono);color:var(--accent);padding:2px 8px;border-radius:999px;background:var(--accent-soft);letter-spacing:0}
.lede{color:var(--muted);margin:0 0 14px;max-width:92ch;font-size:13.5px}
.panel{padding:6px 0;overflow:hidden}
.cad-row{display:grid;grid-template-columns:minmax(150px,1.3fr) minmax(120px,2fr) repeat(3,minmax(84px,.7fr));gap:14px;align-items:center;padding:12px 22px;border-bottom:1px solid var(--ng-glass-line);transition:background .2s}
.cad-row:last-child{border-bottom:0}
.cad-row:hover{background:color-mix(in srgb,var(--ng-from) 6%,transparent)}
.cad-row.dim{opacity:.45}
.cad-label{font-weight:600;display:grid}
.cad-sub{font:500 11.5px var(--mono);color:var(--muted)}
.cad-bar,.lang-bar{height:10px;border-radius:999px;background:color-mix(in srgb,var(--text) 7%,transparent);overflow:hidden}
.cad-bar span,.lang-bar span{display:block;height:100%;width:var(--w);min-width:0;border-radius:inherit;background:linear-gradient(90deg,var(--ng-from),var(--ng-to));box-shadow:0 0 14px var(--ng-glow);transform-origin:left;transition:transform 1.2s var(--ease) .15s}
.pre .reveal:not(.in) .cad-bar span,.pre .reveal:not(.in) .lang-bar span{transform:scaleX(0)}
.cad-fig{font:500 12.5px var(--mono);color:var(--muted);text-align:right;white-space:nowrap}
.cad-fig b{color:var(--text);font-weight:600}
.cad-credits b{color:var(--accent)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr));gap:18px}
.grid2>div{min-width:0}
.lang{display:grid;grid-template-columns:minmax(120px,1fr) 2fr auto;gap:12px;align-items:center;padding:9px 20px}
.lang-name{font-weight:600;display:flex;gap:8px;align-items:baseline;min-width:0}
.lang-name i{font:500 10.5px var(--mono);font-style:normal;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.lang-fig{font:500 12.5px var(--mono);color:var(--muted)}
.table-wrap{overflow:auto;border-radius:20px}
.glass.table-wrap{backdrop-filter:none;-webkit-backdrop-filter:none;background:color-mix(in srgb,var(--surface) 88%,transparent)}
table{border-collapse:collapse;width:100%}
th,td{padding:10px 14px;border-bottom:1px solid var(--ng-glass-line);text-align:left;white-space:nowrap}
thead th{position:sticky;top:0;z-index:1;background:color-mix(in srgb,var(--surface-2) 94%,transparent);color:var(--ng-head);font:600 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase}
td.n,th.n{text-align:right;font-family:var(--mono);font-size:13px}
tbody tr{transition:background .18s}
@media (hover:hover){tbody tr:hover td{background:color-mix(in srgb,var(--ng-from) 7%,transparent)}}
tbody tr:last-child td{border-bottom:0}
.warn{color:var(--warn)}.bad{color:var(--danger)}.ok{color:var(--ok)}
.status{display:inline-flex;align-items:center;gap:6px;font:600 11.5px var(--mono)}
.status::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
a{color:var(--accent);text-decoration:none;transition:color .2s}
a:hover{text-decoration:underline;text-underline-offset:3px}
.tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 12px}
input,select{font:500 13.5px var(--font);color:var(--text);min-height:38px;padding:0 12px;border-radius:11px;border:1px solid color-mix(in srgb,var(--text) 12%,transparent);background-color:color-mix(in srgb,var(--surface-2) 85%,transparent);transition:border-color .2s,box-shadow .25s var(--ease)}
input:focus,select:focus{outline:none;border-color:var(--ng-from);box-shadow:0 0 0 3px color-mix(in srgb,var(--ng-from) 22%,transparent),0 0 24px -8px var(--ng-glow)}
input[type=search]{flex:1;min-width:220px;padding-left:36px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:12px center;background-size:16px}
#repos th{cursor:pointer;user-select:none;transition:color .2s}
#repos th:hover{color:var(--text)}
#repos th[aria-sort=ascending]::after{content:" ↑";color:var(--accent)}
#repos th[aria-sort=descending]::after{content:" ↓";color:var(--accent)}
#repos tbody tr{animation:rowin .4s var(--ease) both}
@keyframes rowin{from{opacity:0;transform:translateY(4px)}}
.spark{display:block}
#repos td.cd{color:var(--accent);font-weight:600}
.more{display:flex;justify-content:center;gap:10px;margin-top:14px}
.more button[hidden]{display:none}
.problems td{white-space:normal}
.next{margin-top:44px;padding:26px 28px;display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.next h3{margin:0 0 4px;font-size:18px;letter-spacing:-.015em}
.next p{margin:0;color:var(--muted);max-width:70ch}
footer{margin-top:28px;color:var(--muted);font-size:12px;display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between}
.reveal{transition:opacity .7s var(--ease),transform .7s var(--ease)}
.pre .reveal:not(.in){opacity:0;transform:translateY(14px)}
@media (max-width:900px){.hero{grid-template-columns:1fr;padding:24px}.journey{grid-template-columns:repeat(2,minmax(0,1fr))}.cad-row{grid-template-columns:1fr 1fr 1fr;row-gap:8px}.cad-label{grid-column:1/-1}.cad-bar{grid-column:1/-1}.cad-fig{text-align:left}}
@media (max-width:520px){.topbar-in{padding:10px 16px;gap:8px}.wrap{padding:0 16px 56px}.chip.when{display:none}.journey{grid-template-columns:1fr}.tile-value{font-size:24px}.label-sm span{display:none}.label-sm{width:38px;padding:0;justify-content:center}input[type=search]{min-width:0;flex-basis:100%}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.aurora{display:none}.pre .reveal:not(.in){opacity:1;transform:none}.pre .reveal:not(.in) .cad-bar span,.pre .reveal:not(.in) .lang-bar span{transform:none}}
@media print{.aurora,.look,#print,.tools,.more,.hero-actions,.next button{display:none!important}body{background:#fff;color:#000}.glass,.tile{backdrop-filter:none;box-shadow:none}.pre .reveal:not(.in){opacity:1;transform:none}.pre .reveal:not(.in) .cad-bar span,.pre .reveal:not(.in) .lang-bar span{transform:none}}
${BRAND_CSS}
</style>
</head>
<body class="pre">
<div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
<header class="topbar"><div class="topbar-in">
<a class="brand" href="#top" aria-label="Checkmarx">${BRAND_MARK}</a>
<span class="chip" title="cloc-fusion version">v${version}</span>
<span class="chip when">${esc(generated.toISOString().slice(0, 16).replace('T', ' '))} UTC</span>
<span class="spacer"></span>
<button type="button" class="icon" id="print" title="Print or save as PDF" aria-label="Print or save as PDF">${ICONS.print}</button>
<details class="look"><summary class="btn icon" title="Look: theme and accent" aria-label="Change the look">${ICONS.look}</summary>
<div class="look-pop">
<fieldset><legend>Theme</legend><div class="seg">
<label><input type="radio" name="theme" value="auto">Auto</label><label><input type="radio" name="theme" value="light">Daylight</label><label><input type="radio" name="theme" value="dark">Obsidian</label>
</div></fieldset>
<fieldset><legend>Accent</legend><div class="swatches">
<label style="--a:#6366f1;--b:#06b6d4" title="Indigo"><input type="radio" name="accent" value="indigo" aria-label="Indigo"></label>
<label style="--a:#06b6d4;--b:#6366f1" title="Cyan"><input type="radio" name="accent" value="cyan" aria-label="Cyan"></label>
<label style="--a:#10b981;--b:#06b6d4" title="Emerald"><input type="radio" name="accent" value="emerald" aria-label="Emerald"></label>
<label style="--a:#8b5cf6;--b:#6366f1" title="Violet"><input type="radio" name="accent" value="violet" aria-label="Violet"></label>
<label style="--a:#f59e0b;--b:#f43f5e" title="Amber"><input type="radio" name="accent" value="amber" aria-label="Amber"></label>
</div></fieldset>
</div></details>
</div></header>

<main class="wrap" id="top">
<section class="glass hero reveal" aria-labelledby="hero-title">
<div>
<div class="eyebrow">Fusion readiness${report.partial ? ' · partial scan' : ''}</div>
<h1 id="hero-title"><span class="grad">${num(k.measured)} ${k.measured === 1 ? 'repository' : 'repositories'}</span> sized and ready for Fusion</h1>
<p>${num(t.lines)} lines of code and ${num(t.commits)} commits analysed across ${num(report.byOrg.length)} ${report.byOrg.length === 1 ? 'organization' : 'organizations'}. Every repository now has a Fusion cadence matched to how fast it changes, so unknown issues surface as fast as your teams ship.</p>
<div class="hero-actions">
<button type="button" class="golden" id="csv-all">${ICONS.download}<span>Download the Fusion plan</span></button>
<button type="button" id="to-repos">${ICONS.repo}<span>Explore repositories</span></button>
</div>
</div>
<div class="hero-side">
<div class="ring" style="--p:${readyPct}">
<svg viewBox="0 0 36 36" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="var(--ng-from)"/><stop offset="1" stop-color="var(--ng-to)"/></linearGradient></defs>
<circle class="track" cx="18" cy="18" r="15.9155" fill="none" stroke-width="2.2"/><circle class="val" cx="18" cy="18" r="15.9155" fill="none" stroke-width="2.2" pathLength="100"/></svg>
<div class="ring-in" id="hero-figure">${heroFigure}</div>
</div>
<div class="hero-pills" id="hero-pills">${heroPills}</div>
<div class="ready-label">${readyPct}% of repositories measured${k.failed ? ` · ${num(k.failed)} to retry` : ''}</div>
</div>
</section>

<ol class="glass journey reveal" aria-label="Progress">${journey}</ol>

<section class="tiles">
${tile('Repositories', count(k.measured), `${num(k.discovered)} found · ${num(k.skipped)} skipped${k.failed ? ` · <span class="bad">${num(k.failed)} failed</span>` : ''}`, ICONS.repo)}
${tile('Lines of code', count(t.lines), `${num(t.units)} × 10K units, each repository rounded up`, ICONS.code)}
${tile('Commits in window', count(t.commits), `${num(weekly, 1)} a week across the estate`, ICONS.pulse)}
${tile('Fusion scans', count(t.scans), `${num(t.unitScans)} 10K-unit scans over ${num(f.periodMonths)} months`, ICONS.scan, 'tile-scans')}
${tile('Fusion credits', priced ? count(c.total, digits(c.total)) : '—', priced ? `${num(c.bundles)} bundle${c.bundles === 1 ? '' : 's'} of ${num(c.settings.bundleCredits)}` : '<span class="warn">Set credits per 10K LOC</span>', ICONS.spark, 'tile-credits')}
</section>

${tuneSection(ICONS)}

<h2 class="reveal">Fusion cadence <span class="n-chip">by change frequency</span></h2>
<p class="lede reveal">Every commit to the default branch runs a pipeline, so commit frequency sets the scan frequency. More than 5 commits a week means one Fusion scan a week, 1 to 5 means one every 2 weeks, and so on: the same rules as the Cx Credits Calculator. Credits = 10K units × Fusion scans × the model's credits per 10K LOC.</p>
<div class="glass panel reveal" id="cadence">${cadence}</div>

<div class="grid2">
<div><h2 class="reveal">Organizations</h2><div class="glass table-wrap reveal"><table>
<thead><tr><th>Connection</th><th>Organization</th><th class="n">Repos</th><th class="n">Measured</th><th class="n">LOC</th><th class="n">Commits</th><th class="n">Scans</th><th class="n">Credits</th></tr></thead>
<tbody id="org-body">${orgRows || '<tr><td colspan="8">None</td></tr>'}</tbody></table></div>
<h2 class="reveal">Fusion models</h2><div class="glass table-wrap reveal"><table>
<thead><tr><th>Model</th><th class="n">Credits / 10K LOC</th><th class="n">Repos</th><th class="n">10K-unit scans</th><th class="n">Credits</th></tr></thead>
<tbody id="model-body">${modelRows || '<tr><td colspan="5"><span class="warn">No Fusion model yet: add one with its credits per 10K LOC (cloc-fusion price --credits-per-10k N).</span></td></tr>'}</tbody></table></div></div>
<div><h2 class="reveal">Languages <span class="n-chip">${num(langs.length)}</span></h2><div class="glass panel reveal" id="langs">${langRows || '<div class="lang">None</div>'}</div></div>
</div>

<h2 class="reveal" id="repositories">Repositories <span class="n-chip">${num(data.length)}</span></h2>
<div class="tools reveal">
<input type="search" id="q" placeholder="Filter by name, organization, language…" aria-label="Filter repositories">
<select id="fq" aria-label="Change frequency"><option value="">All frequencies</option>${report.byFrequency.map((b) => `<option value="${esc(b.id)}">${esc(b.label)}</option>`).join('')}</select>
<select id="st" aria-label="Status"><option value="">All statuses</option><option value="ok">Measured</option><option value="failed">Failed</option><option value="skip">Skipped</option><option value="empty">Empty</option></select>
<span id="count" class="pill"></span>
<button type="button" id="csv" class="label-sm" title="Download this view as CSV">${ICONS.download}<span>CSV of this view</span></button>
</div>
<div class="glass table-wrap reveal" style="max-height:78vh"><table id="repos">
<thead><tr>
<th data-k="n">Repository</th><th data-k="o">Organization</th><th data-k="fr">Change frequency</th><th class="n" data-k="cr">Criticality</th><th class="n" data-k="sc">Fusion scans</th><th data-k="md">Model</th><th class="n" data-k="cd">Credits</th><th class="n" data-k="loc">LOC</th><th class="n" data-k="un">10K units</th><th class="n" data-k="cm">Commits</th><th class="n" data-k="cw">Per week</th><th data-k="w">Last 52 weeks</th><th class="n" data-k="au">Authors</th><th data-k="lc">Last commit</th><th data-k="lg">Language</th><th data-k="st">Status</th>
</tr></thead><tbody></tbody></table></div>
<div class="more"><button type="button" id="more" hidden>Show more</button><button type="button" id="all" hidden>Show all</button></div>

${report.problems?.length ? `<h2 class="reveal">Needs attention <span class="n-chip">${num(report.problems.length)}</span></h2><div class="glass table-wrap reveal problems"><table><thead><tr><th>Connection</th><th>Organization</th><th>Problem</th></tr></thead><tbody>${report.problems.map((p) => `<tr><td>${esc(p.connection)}</td><td>${esc(p.org || '')}</td><td class="bad">${esc(p.error)}</td></tr>`).join('')}</tbody></table></div>` : ''}

<section class="glass next reveal">
<div><h3>Fusion is the next step</h3><p>The estate is mapped and the plan is priced. Start with the busiest repositories: they change the most, so Fusion finds what was hiding there first.</p></div>
<button type="button" class="primary" id="csv-plan">${ICONS.download}<span>Download the plan</span></button>
</section>

<footer><span>cloc-fusion v${version} · lines of code are ${esc(report.settings.locBasis === 'all' ? 'all lines' : report.settings.locBasis === 'code+comments' ? 'code and comment lines' : 'code lines (no blanks or comments)')} in ${esc((report.settings.countCategories || []).join(', '))} files, excluding dependencies, build output and generated files.</span><span>Commit window ${num(report.settings.windowDays)} days · measured in ${num(report.durationSeconds || 0)} s</span></footer>
</main>
<script id="data" type="application/json">${json}</script>
<script id="app">
(function(){
var W=typeof window!=='undefined'?window:{},D=document,root=D.documentElement||{dataset:{},setAttribute:function(){},removeAttribute:function(){}};
var rows=JSON.parse(D.getElementById('data').textContent);
var FQ=${JSON.stringify(report.byFrequency.map((b) => b.id))};
var BASE=${JSON.stringify(tuneBase(report)).replace(/</g, '\\u003c')},T=null;
var still=!!(W.matchMedia&&W.matchMedia('(prefers-reduced-motion: reduce)').matches);
var raf=W.requestAnimationFrame?W.requestAnimationFrame.bind(W):function(f){return setTimeout(function(){f(Date.now())},16)};
var store={get:function(k){try{return W.localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{W.localStorage.setItem(k,v)}catch(e){}}};
function fmt(n,d){return n===null||n===undefined||n===''?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d||0})}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function all$(sel){return Array.prototype.slice.call(D.querySelectorAll(sel)||[])}

/* Look: theme and accent, remembered on this device */
function setLook(name,v){if(name==='theme'){if(v==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',v);store.set('cf-theme',v)}else{root.setAttribute('data-accent',v);store.set('cf-accent',v)}}
all$('.look input').forEach(function(i){var cur=i.name==='theme'?(store.get('cf-theme')||'dark'):(store.get('cf-accent')||'indigo');if(i.value===cur)i.checked=true;i.addEventListener('change',function(){setLook(i.name,i.value)})});

/* Motion: count-ups, bars, the ring and sections ease in as they come into view */
function countUp(el){var to=+el.getAttribute('data-to'),d=+el.getAttribute('data-digits')||0;if(still||!isFinite(to))return;var t0=null,dur=1500;function step(t){if(t0===null)t0=t;var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,4);el.textContent=fmt(to*e,p<1?0:d);if(p<1)raf(step)}el.textContent='0';raf(step)}
function show(el){el.classList.add('in');Array.prototype.forEach.call(el.querySelectorAll('.count'),countUp)}
var revs=all$('.reveal');
if(!still&&typeof IntersectionObserver!=='undefined'){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){show(e.target);io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -5% 0px'});revs.forEach(function(el,i){el.style.transitionDelay=(i%5)*70+'ms';io.observe(el)});
var ring=D.querySelector('.ring .val');if(ring&&ring.style){ring.style.strokeDashoffset='100';setTimeout(function(){ring.style.strokeDashoffset=''},250)}}
else{if(D.body)D.body.classList.remove('pre');revs.forEach(function(el){el.classList&&el.classList.add('in')})}

/* Repository table */
var tbody=D.querySelector('#repos tbody'),q=D.getElementById('q'),fq=D.getElementById('fq'),st=D.getElementById('st'),count=D.getElementById('count');
var cmp=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}).compare,sortKey='cd',dir=-1,PAGE=250,limit=PAGE,more=D.getElementById('more'),every=D.getElementById('all'),view=rows;
function spark(w){if(!w||!w.length)return'';var m=Math.max.apply(null,w.concat([1])),SW=104,H=20,d='';for(var i=0;i<w.length;i++){var h=w[i]?Math.max(2,Math.round(w[i]/m*H)):0;if(h)d+='M'+(i*2+0.75)+' '+H+'v-'+h}return d?'<svg class="spark" width="'+SW+'" height="'+H+'" viewBox="0 0 '+SW+' '+H+'" aria-label="weekly commits"><path d="'+d+'" stroke="url(#ringGrad)" stroke-width="1.5"/></svg>':''}
function val(r,k){if(k==='fr')return FQ.indexOf(r.fr)<0?99:FQ.indexOf(r.fr);if(k==='w')return r.cm;return r[k]}
function filtered(){var text=q.value.trim().toLowerCase(),f=fq.value,s=st.value;
var list=rows.filter(function(r){
if(text&&(r.n+' '+r.o+' '+r.c+' '+r.lg+' '+r.md).toLowerCase().indexOf(text)<0)return false;
if(f&&r.fr!==f)return false;
if(s==='skip'&&['ok','failed','empty','pending'].indexOf(r.st)>=0)return false;
if(s&&s!=='skip'&&r.st!==s)return false;return true});
list.sort(function(a,b){var x=val(a,sortKey),y=val(b,sortKey);if(x===y)return cmp(a.n,b.n);if(x===null||x===undefined||x==='')return 1;if(y===null||y===undefined||y==='')return -1;return(typeof x==='number'?x-y:cmp(String(x),String(y)))*dir});
return list}
function render(){view=filtered();
count.textContent=view.length+' of '+rows.length;
var shown=view.slice(0,limit);more.hidden=every.hidden=shown.length>=view.length;more.textContent='Show '+Math.min(PAGE,view.length-shown.length)+' more';every.textContent='Show all '+view.length;
tbody.innerHTML=shown.map(function(r,i){
var name=r.u&&/^https?:/i.test(r.u)?'<a href="'+esc(r.u)+'" target="_blank" rel="noopener">'+esc(r.n)+'</a>':esc(r.n);
var status=r.st==='ok'?'<span class="status ok">measured</span>':r.st==='failed'?'<span class="status bad" title="'+esc(r.er)+'">failed</span>':'<span class="status warn">'+esc(r.st)+'</span>';
return '<tr'+(i<24?' style="animation-delay:'+(i*14)+'ms"':'')+'><td>'+name+'</td><td>'+esc(r.o)+'</td><td>'+esc(r.fq)+'</td><td class="n'+(T?' pick':'')+'">'+(T?T.crit(r):fmt(r.cr))+'</td><td class="n'+(T?' pick':'')+'">'+(T?T.scans(r):fmt(r.sc))+'</td><td'+(T?' class="pick"':'')+'>'+(T?T.model(r):esc(r.md))+'</td><td class="n cd">'+fmt(r.cd,1)+'</td><td class="n"'+(r.es?' title="Estimated from the platform&#39;s language statistics"':'')+'>'+(r.es?'≈ ':'')+fmt(r.loc)+'</td><td class="n">'+fmt(r.un)+'</td><td class="n">'+fmt(r.cm)+'</td><td class="n">'+fmt(r.cw,1)+'</td><td>'+spark(r.w)+'</td><td class="n">'+fmt(r.au)+'</td><td>'+esc(r.lc)+'</td><td>'+esc(r.lg)+'</td><td>'+status+'</td></tr>'}).join('');
all$('#repos th').forEach(function(th){th.setAttribute('aria-sort',th.getAttribute('data-k')===sortKey?(dir>0?'ascending':'descending'):'none')});
}
all$('#repos th').forEach(function(th){th.addEventListener('click',function(){var k=th.getAttribute('data-k');if(k===sortKey)dir=-dir;else{sortKey=k;dir=['n','o','lg','md','st','fr','lc'].indexOf(k)>=0?1:-1}render()})});
var timer;[q,fq,st].forEach(function(el){el.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){limit=PAGE;render()},120)})});
more.addEventListener('click',function(){limit+=PAGE;render()});every.addEventListener('click',function(){limit=Infinity;render()});

/* Downloads: the plan as CSV, all of it or this view (spreadsheet formulas defused) */
function cell(v){if(v===null||v===undefined)return'';var s=String(v);if(/^[=+\\-@\\t\\r]/.test(s)&&!/^-?\\d+(\\.\\d+)?$/.test(s))s="'"+s;return /[",\\n\\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function csv(list,name){var head=['Repository','Organization','Connection','Language','Lines of code','Commits','Commits per week','Authors','Last commit','Change frequency','Criticality','Fusion scans','10K units','Model','Credits','Status'];
var lines=[head.join(',')].concat(list.map(function(r){return[r.n,r.o,r.c,r.lg,r.loc,r.cm,r.cw,r.au,r.lc,r.fq,r.cr,r.sc,r.un,r.md,r.cd,r.st].map(cell).join(',')}));
if(typeof Blob==='undefined'||!W.URL)return;var url=W.URL.createObjectURL(new Blob(['\\ufeff'+lines.join('\\r\\n')],{type:'text/csv'}));var a=D.createElement('a');a.href=url;a.download=name;D.body.appendChild(a);a.click();a.remove();setTimeout(function(){W.URL.revokeObjectURL(url)},1000)}
function plan(){return rows.slice().sort(function(a,b){return(b.cd||0)-(a.cd||0)||cmp(a.n,b.n)})}
function on(id,f){var el=D.getElementById(id);if(el)el.addEventListener('click',f)}
on('csv',function(){csv(view,'fusion-plan-view.csv')});
on('csv-all',function(){csv(plan(),'fusion-plan.csv')});on('csv-plan',function(){csv(plan(),'fusion-plan.csv')});
on('to-repos',function(){var t=D.getElementById('repositories');if(t&&t.scrollIntoView)t.scrollIntoView({behavior:still?'auto':'smooth'})});
on('print',function(){if(W.print)W.print()});
/* Tune the plan: models, scans and pricing chosen on the page (src/report/tune.js) */
try{T=(${tuner.toString()})({rows:rows,base:BASE,D:D,W:W,store:store,fmt:fmt,esc:esc,tbody:tbody,render:function(){render()}})}catch(e){T=null}
render();
})();
</script>
</body>
</html>
`;
}

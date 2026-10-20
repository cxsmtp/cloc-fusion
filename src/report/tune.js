// "Tune the plan": the HTML report as a credit calculator, with the controls of the Cx Credits
// Calculator. The customer picks which Fusion model each repository gets: by change frequency, by
// criticality, or one by one, with a default model for the rest. The same goes for the Fusion
// scans, the models' credits per 10K LOC, the projection period, the extra % and the bundle size.
// Every figure in the report (hero, tiles, cadence, organizations, models, the repository table and
// its CSV) follows at once. Choices are remembered in this browser for this report, and can be
// downloaded as settings for the web app or the CLI.
//
// The arithmetic is src/fusion.js (allocate, fusionEstimate, creditSummary) in browser form: the
// test suite checks that both give the same credits.
import { FREQUENCIES, CRITICALITIES } from '../fusion.js';

export const TUNE_CSS = `
.tune{margin-top:18px;padding:24px 26px;position:relative;overflow:hidden;isolation:isolate}
.tune::after{content:"";position:absolute;width:380px;height:380px;left:-140px;bottom:-200px;border-radius:50%;background:radial-gradient(circle,var(--ng-glow),transparent 65%);z-index:-1;opacity:.6}
.tune-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
.tune-head h2{margin:8px 0 4px}
.tune-actions{display:flex;gap:8px;flex-wrap:wrap}
.tuned-chip{display:none}.tuned .tuned-chip{display:inline-flex}
.tune-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:16px 0 4px}
.tune-kpi{padding:12px 14px;border-radius:14px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 70%,transparent)}
.tune-kpi b{display:block;font:600 22px/1.2 var(--mono);letter-spacing:-.03em;margin-top:4px}
.tune-kpi.gold b{color:#f5c542;text-shadow:0 0 18px rgb(245 197 66/.35)}
.tune-kpi span{font:600 10px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ng-head)}
.tune-kpi small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
.tune-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:22px;margin-top:18px;align-items:start}
.tune-col{display:grid;grid-template-columns:minmax(0,1fr);gap:22px;min-width:0}
.tune-scroll{overflow-x:auto;border-radius:14px}
.tune h3{font-size:13.5px;margin:0 0 8px;letter-spacing:-.01em;display:flex;gap:8px;align-items:center}
.tune h3 small{font:500 11px var(--mono);color:var(--muted)}
.tune table{border:1px solid var(--ng-glass-line);border-radius:14px;border-collapse:separate;border-spacing:0;overflow:hidden;background:color-mix(in srgb,var(--surface) 75%,transparent)}
.tune th,.tune td{padding:7px 10px}
.tune thead th{position:static}
.tune input,.tune select,#repos select,#repos input{min-height:32px;padding:0 9px;border-radius:9px;font-size:12.5px}
.tune input[type=number],#repos input[type=number]{font-family:var(--mono);width:86px}
.tune input[type=text]{width:100%;min-width:110px}
.tune select,#repos select{max-width:220px}
.tune input[type=radio]{min-height:0;width:16px;height:16px;accent-color:var(--ng-from)}
.tune .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.tune .fields label{display:grid;gap:5px;font:600 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ng-head)}
.tune .fields input,.tune .fields select{width:100%}
.tune .how{color:var(--muted);font-size:12.5px;margin:10px 0 0}
.tune .muted{color:var(--muted)}
.tune .sug{font:500 10px var(--mono);color:var(--muted);margin-left:6px}
.tune .x{min-height:30px;width:30px;padding:0;justify-content:center}
.tune button.sm{min-height:30px;font-size:12px;margin-top:8px}
#repos td.pick{padding-top:5px;padding-bottom:5px}
#repos .pinned{border-color:color-mix(in srgb,var(--ng-from) 60%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--ng-from) 14%,transparent)}
@media (max-width:980px){.tune-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:520px){.tune{padding:18px 16px}}
@media print{.tune .tune-actions,.tune button{display:none!important}}
`;

/** The settings the report was priced with, for the page to start from. */
export function tuneBase(report) {
  const f = report.settings.fusion;
  const t = report.credits.settings;
  return {
    key: `${report.generatedAt}|${report.repos.length}`,
    orgDevs: Object.fromEntries(report.byOrg.map((o) => [`${o.connection}\u0000${o.org}`, o.devs90 ?? null])),
    periodMonths: f.periodMonths,
    defaultScans: f.defaultScans,
    defaultModel: f.defaultModel,
    combine: f.combine,
    models: f.models.map((m) => ({ id: m.id, name: m.name, rate: m.creditsPer10k })),
    byFrequency: f.byFrequency,
    byCriticality: f.byCriticality,
    extraPercent: t.extraPercent,
    bundleCredits: t.bundleCredits,
    freqs: FREQUENCIES.map((x) => ({ id: x.id, label: x.label, perYear: x.perYear })),
    crits: CRITICALITIES,
  };
}

/** The section's frame; the script fills it. */
export const tuneSection = (icons) => `<section class="glass tune reveal" id="tune" aria-labelledby="tune-title">
<div class="tune-head"><div><div class="eyebrow">Tune the plan · live</div><h2 id="tune-title">Choose your Fusion models <span class="n-chip tuned-chip">tuned</span></h2>
<p class="lede" style="margin:0">Pick the model each repository gets: by how often it changes, by how critical it is, or one by one in the table below, with a default for the rest. Every figure on this page follows as you change it.</p></div>
<div class="tune-actions"><button type="button" id="tune-reset" title="Back to the settings this report was priced with">Reset</button><button type="button" class="primary" id="tune-save" title="Use these choices in the cloc-fusion app (Import settings) or the CLI (--config)">${icons.download}<span>Download settings</span></button></div></div>
<div class="tune-kpis" id="tune-kpis"></div>
<div class="tune-grid"><div class="tune-col"><div id="tune-models"></div><div id="tune-general"></div></div><div class="tune-col"><div id="tune-freq"></div><div id="tune-crit"></div></div></div>
</section>`;

/**
 * The page's side, serialized into the report with Function.prototype.toString(): plain browser
 * code, no imports. `ctx` is { rows, base, D, W, store, fmt, esc, render }. Returns the repository
 * table's cell renderers, or null when the page has no tuning section.
 */
export function tuner(ctx) {
  var D = ctx.D, W = ctx.W, rows = ctx.rows, base = ctx.base, fmt = ctx.fmt, esc = ctx.esc, store = ctx.store;
  var box = D.getElementById('tune');
  if (!box || !box.querySelector) return null;
  var KEY = 'cf-tune:' + base.key;
  var FREQS = base.freqs, CRITS = base.crits;
  var num = function (v, dec) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/[,_\s]/g, ''));
    return isFinite(n) && n >= 0 ? (dec ? n : Math.floor(n)) : null;
  };
  var suggested = function (id, months) {
    var f = FREQS.filter(function (x) { return x.id === id; })[0] || FREQS[FREQS.length - 1];
    return Math.max(1, Math.ceil((f.perYear * Math.min(60, Math.max(1, months || 12))) / 12));
  };
  var rule = function (r) { return { s: r && r.scans !== undefined ? r.scans : null, m: (r && r.model) || null }; };
  function fresh() {
    var s = { period: base.periodMonths, combine: base.combine, def: base.defaultModel, defScans: base.defaultScans, extra: base.extraPercent, bundle: base.bundleCredits, models: base.models.map(function (m) { return { id: m.id, name: m.name, rate: m.rate }; }), freq: {}, crit: {}, repo: {} };
    FREQS.forEach(function (f) { s.freq[f.id] = rule(base.byFrequency[f.id]); });
    CRITS.forEach(function (c) { s.crit[c] = rule(base.byCriticality[c]); });
    return s;
  }
  var S = fresh();
  try {
    var saved = JSON.parse(store.get(KEY) || 'null');
    if (saved && Array.isArray(saved.models) && saved.freq && saved.crit && saved.repo) S = saved;
  } catch (e) {}
  rows.forEach(function (r, i) { r.i = i; r.cr0 = r.cr; r.so0 = r.so; r.mo0 = r.mo; });

  var modelById = function (id) { return S.models.filter(function (m) { return m.id === id; })[0] || null; };
  var nameOf = function (m) { return m ? m.name || 'Unnamed model' : ''; };
  var rateText = function (m) { return m && m.rate !== null && m.rate !== undefined && m.rate !== '' ? ' · ' + fmt(m.rate, 2) : ''; };
  var defaultModel = function () { return modelById(S.def) || S.models[0] || null; };
  var repoSet = function (r) { return Object.prototype.hasOwnProperty.call(S.repo, r.n) ? S.repo[r.n] : {}; };
  var critOf = function (r) { var o = repoSet(r); return o.c !== undefined ? o.c : r.cr0; };

  /* src/fusion.js allocate(): Fusion scans and model for one repository. */
  function allocate(r) {
    var o = repoSet(r);
    var crit = critOf(r);
    crit = CRITS.indexOf(Number(crit)) >= 0 ? Number(crit) : null;
    var fr = S.freq[r.fr] || { s: null, m: null };
    var cr = crit ? S.crit[crit] : { s: null, m: null };
    var f = num(fr.s), c = num(cr.s);
    if (f === null) f = suggested(r.fr, S.period);
    var scans = num(S.defScans) === null ? 1 : num(S.defScans), from = 'default';
    if (f !== null || c !== null) {
      if (S.combine === 'frequency') { scans = f !== null ? f : c; from = f !== null ? 'frequency' : 'criticality'; }
      else if (S.combine === 'criticality') { scans = c !== null ? c : f; from = c !== null ? 'criticality' : 'frequency'; }
      else if ((f === null ? -1 : f) >= (c === null ? -1 : c)) { scans = f; from = 'frequency'; }
      else { scans = c; from = 'criticality'; }
    }
    var so = o.s !== undefined ? o.s : r.so0;
    if (num(so) !== null) { scans = num(so); from = 'repository'; }
    var order = S.combine === 'criticality' ? [cr.m, fr.m] : [fr.m, cr.m];
    var pin = o.m !== undefined ? o.m : r.mo0;
    var auto = (order[0] && modelById(order[0]) ? order[0] : null) || (order[1] && modelById(order[1]) ? order[1] : null) || (defaultModel() ? defaultModel().id : null);
    var pinned = Boolean(pin && modelById(pin));
    return { scans: scans, from: from, model: pinned ? pin : auto, auto: auto, pinned: pinned };
  }

  var est = null;
  function recompute() {
    var sum = { credits: 0, scans: 0, unitScans: 0, repos: 0, unknown: 0 };
    var byF = {}, byM = {}, byO = {}, orgOrder = [];
    FREQS.forEach(function (f) { byF[f.id] = { repos: 0, scans: 0, credits: 0 }; });
    S.models.forEach(function (m) { byM[m.id] = { repos: 0, unitScans: 0, credits: 0 }; });
    rows.forEach(function (r) {
      var k = r.c + '\u0000' + r.o;
      if (!byO[k]) { byO[k] = { c: r.c, o: r.o, repos: 0, counted: 0, lines: 0, commits: 0, scans: 0, credits: 0 }; orgOrder.push(k); }
      var g = byO[k];
      g.repos++;
      if (!r.inc) { r.cr = critOf(r); r.sc = null; r.cd = null; r.md = ''; r.mi = null; return; }
      var a = allocate(r);
      var m = modelById(a.model);
      var rate = m ? num(m.rate, true) : null;
      r.sc = a.scans; r.mi = a.model; r.md = nameOf(m); r.from = a.from; r.pin = a.pinned; r.auto = a.auto; r.cr = critOf(r);
      r.cd = rate === null ? (a.scans ? null : 0) : r.un * a.scans * rate;
      if (r.cd === null) sum.unknown++;
      sum.repos++; sum.scans += a.scans; sum.unitScans += r.un * a.scans; sum.credits += r.cd || 0;
      var b = byF[r.fr]; if (b) { b.repos++; b.scans += a.scans; b.credits += r.cd || 0; }
      var bm = byM[a.model]; if (bm) { bm.repos++; bm.unitScans += r.un * a.scans; bm.credits += r.cd || 0; }
      g.counted++; g.lines += r.loc || 0; g.commits += r.cm || 0; g.scans += a.scans; g.credits += r.cd || 0;
    });
    var extra = Math.min(500, num(S.extra, true) || 0), bundle = num(S.bundle) || 10000;
    var total = sum.credits * (1 + extra / 100);
    var priced = S.models.some(function (m) { return num(m.rate, true) !== null; });
    est = { sum: sum, byF: byF, byM: byM, byO: byO, orgOrder: orgOrder, total: total, extra: extra, bundle: bundle, bundles: total > 0 ? Math.ceil(total / bundle - 1e-9) : 0, priced: priced };
    return est;
  }

  var digits = function (v) { return v < 100 ? 1 : 0; };
  var setHtml = function (id, html) { var el = D.getElementById(id); if (el) el.innerHTML = html; };
  function paintReport() {
    var e = est, s = e.sum;
    setHtml('hero-figure', e.priced
      ? '<div class="hero-figure">' + fmt(e.total, digits(e.total)) + '</div><div class="hero-unit">Fusion credits · ' + fmt(S.period) + ' months</div>'
      : '<div class="hero-figure">' + fmt(s.unitScans) + '</div><div class="hero-unit">10K-unit Fusion scans · ' + fmt(S.period) + ' months</div>');
    setHtml('hero-pills', e.priced
      ? '<span class="pill glow">' + fmt(e.bundles) + ' bundle' + (e.bundles === 1 ? '' : 's') + ' of ' + fmt(e.bundle) + '</span>' + (e.extra ? '<span class="pill">incl. ' + fmt(e.extra, 2) + '% headroom</span>' : '')
      : '<span class="pill warn-pill">Set credits per 10K LOC to price the plan</span>');
    setHtml('tile-scans', '<div class="tile-label">Fusion scans</div><div class="tile-value">' + fmt(s.scans) + '</div><div class="tile-note">' + fmt(s.unitScans) + ' 10K-unit scans over ' + fmt(S.period) + ' months</div>');
    setHtml('tile-credits', '<div class="tile-label">Fusion credits</div><div class="tile-value">' + (e.priced ? fmt(e.total, digits(e.total)) : '—') + '</div><div class="tile-note">' + (e.priced ? fmt(e.bundles) + ' bundle' + (e.bundles === 1 ? '' : 's') + ' of ' + fmt(e.bundle) : '<span class="warn">Set credits per 10K LOC</span>') + '</div>');
    var step = D.getElementById('step-ready');
    if (step) step.textContent = e.priced ? fmt(e.total, digits(e.total)) + ' credits' : 'awaiting pricing';
    var max = 1;
    FREQS.forEach(function (f) { max = Math.max(max, e.byF[f.id].scans); });
    setHtml('cadence', FREQS.map(function (f) {
      var b = e.byF[f.id], each = num(S.freq[f.id].s); if (each === null) each = suggested(f.id, S.period);
      return '<div class="cad-row' + (b.repos ? '' : ' dim') + '"><div class="cad-label">' + esc(f.label) + '<span class="cad-sub">' + fmt(each) + ' scan' + (each === 1 ? '' : 's') + ' each' + (S.freq[f.id].m && modelById(S.freq[f.id].m) ? ' · ' + esc(nameOf(modelById(S.freq[f.id].m))) : '') + '</span></div>' +
        '<div class="cad-bar"><span style="--w:' + ((b.scans / max) * 100).toFixed(1) + '%"></span></div><div class="cad-fig"><b>' + fmt(b.repos) + '</b> repos</div><div class="cad-fig"><b>' + fmt(b.scans) + '</b> scans</div><div class="cad-fig cad-credits">' + (e.priced ? '<b>' + fmt(b.credits, 1) + '</b> credits' : '—') + '</div></div>';
    }).join(''));
    setHtml('model-body', S.models.length ? S.models.map(function (m) {
      var b = e.byM[m.id];
      return '<tr><td>' + esc(nameOf(m)) + (defaultModel() === m ? ' <span class="n-chip">default</span>' : '') + '</td><td class="n">' + (num(m.rate, true) === null ? '<span class="warn">not set</span>' : fmt(m.rate, 2)) + '</td><td class="n">' + fmt(b.repos) + '</td><td class="n">' + fmt(b.unitScans) + '</td><td class="n">' + fmt(b.credits, 1) + '</td></tr>';
    }).join('') : '<tr><td colspan="5"><span class="warn">No Fusion model yet: add one above with its credits per 10K LOC.</span></td></tr>');
    setHtml('org-body', e.orgOrder.map(function (k) {
      var g = e.byO[k];
      return '<tr><td>' + esc(g.c) + '</td><td>' + esc(g.o) + '</td><td class="n">' + fmt(g.repos) + '</td><td class="n">' + fmt(g.counted) + '</td><td class="n">' + fmt(g.lines) + '</td><td class="n">' + fmt(g.commits) + '</td><td class="n">' + fmt(base.orgDevs ? base.orgDevs[k] : null) + '</td><td class="n">' + fmt(g.scans) + '</td><td class="n">' + (e.priced ? fmt(g.credits, 1) : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="9">None</td></tr>');
    setHtml('tune-kpis',
      '<div class="tune-kpi gold"><span>Fusion credits</span><b>' + (e.priced ? fmt(e.total, digits(e.total)) : '—') + '</b><small>' + (e.extra ? fmt(e.sum.credits, 1) + ' + ' + fmt(e.extra, 2) + '% on top' : 'over ' + fmt(S.period) + ' months') + '</small></div>' +
      '<div class="tune-kpi"><span>Bundles</span><b>' + fmt(e.bundles) + '</b><small>of ' + fmt(e.bundle) + ' credits</small></div>' +
      '<div class="tune-kpi"><span>Fusion scans</span><b>' + fmt(s.scans) + '</b><small>' + fmt(s.repos) + ' repositories</small></div>' +
      '<div class="tune-kpi"><span>10K-unit scans</span><b>' + fmt(s.unitScans) + '</b><small>' + (s.unknown ? '<span class="warn">' + fmt(s.unknown) + ' on a model without credits</span>' : 'every repository priced') + '</small></div>');
    box.classList.toggle('tuned', JSON.stringify(S) !== JSON.stringify(fresh()));
  }

  /* The controls */
  var opt = function (value, label, on) { return '<option value="' + esc(value) + '"' + (on ? ' selected' : '') + '>' + esc(label) + '</option>'; };
  var modelSelect = function (attr, selected, blank) {
    return '<select ' + attr + '>' + opt('', blank, !selected) + S.models.map(function (m) { return opt(m.id, nameOf(m) + rateText(m), m.id === selected); }).join('') + '</select>';
  };
  var defLabel = function () { var m = defaultModel(); return m ? 'Default: ' + nameOf(m) + rateText(m) : 'Default model'; };
  var count = function (pred) { var n = 0; rows.forEach(function (r) { if (r.inc && pred(r)) n++; }); return n; };
  function paintControls() {
    setHtml('tune-models', '<h3>Fusion models <small>credits per 10K LOC</small></h3><div class="tune-scroll"><table><thead><tr><th>Model</th><th class="n">Credits / 10K</th><th class="n">Default</th><th></th></tr></thead><tbody>' +
      S.models.map(function (m, i) {
        return '<tr><td><input type="text" maxlength="80" data-model="' + i + '" data-f="name" value="' + esc(m.name) + '" placeholder="Model name, as Checkmarx One shows it" aria-label="Model name"></td>' +
          '<td class="n"><input type="number" min="0" step="0.01" data-model="' + i + '" data-f="rate" value="' + esc(m.rate === null || m.rate === undefined ? '' : m.rate) + '" placeholder="credits" aria-label="Credits per 10K LOC"></td>' +
          '<td class="n"><input type="radio" name="tune-def" data-model="' + i + '" data-f="def"' + (defaultModel() === m ? ' checked' : '') + ' aria-label="Default model"></td>' +
          '<td class="n"><button type="button" class="x" data-model="' + i + '" data-f="remove" title="Remove this model" aria-label="Remove this model">×</button></td></tr>';
      }).join('') + (S.models.length ? '' : '<tr><td colspan="4" class="muted">No model yet: add one to price the plan.</td></tr>') +
      '</tbody></table></div><button type="button" class="sm" data-f="add-model">+ Add a model</button>');
    setHtml('tune-freq', '<h3>By change frequency <small>commits on the default branch</small></h3><div class="tune-scroll"><table><thead><tr><th>How often it changes</th><th class="n">Repos</th><th class="n">Scans / ' + fmt(S.period) + ' mo</th><th>Model</th></tr></thead><tbody>' +
      FREQS.map(function (f) {
        var r = S.freq[f.id], sug = suggested(f.id, S.period);
        return '<tr><td>' + esc(f.label) + (num(r.s) === null || num(r.s) === sug ? '<span class="sug">suggested</span>' : '') + '</td><td class="n muted">' + fmt(count(function (x) { return x.fr === f.id; })) + '</td>' +
          '<td class="n"><input type="number" min="0" data-freq="' + f.id + '" data-f="s" value="' + esc(num(r.s) === null ? sug : r.s) + '" aria-label="Fusion scans for ' + esc(f.label) + '"></td>' +
          '<td>' + modelSelect('data-freq="' + f.id + '" data-f="m" aria-label="Model for ' + esc(f.label) + '"', r.m, defLabel()) + '</td></tr>';
      }).join('') + '</tbody></table></div>');
    setHtml('tune-crit', '<h3>By criticality <small>set per repository in the table below</small></h3><div class="tune-scroll"><table><thead><tr><th>Criticality</th><th class="n">Repos</th><th class="n">Scans</th><th>Model</th></tr></thead><tbody>' +
      CRITS.map(function (c) {
        var r = S.crit[c];
        return '<tr><td>' + c + (c === 5 ? ' (most critical)' : c === 1 ? ' (least critical)' : '') + '</td><td class="n muted">' + fmt(count(function (x) { return Number(critOf(x)) === c; })) + '</td>' +
          '<td class="n"><input type="number" min="0" data-crit="' + c + '" data-f="s" value="' + esc(num(r.s) === null ? '' : r.s) + '" placeholder="—" aria-label="Fusion scans for criticality ' + c + '"></td>' +
          '<td>' + modelSelect('data-crit="' + c + '" data-f="m" aria-label="Model for criticality ' + c + '"', r.m, defLabel()) + '</td></tr>';
      }).join('') + '</tbody></table></div>');
    setHtml('tune-general', '<h3>Plan</h3><div class="fields" style="margin-top:0">' +
      '<label>Projection (months)<input type="number" min="1" max="60" data-f="period" value="' + esc(S.period) + '"></label>' +
      '<label>If cadences disagree<select data-f="combine">' + opt('higher', 'Higher wins', S.combine === 'higher') + opt('frequency', 'Frequency decides', S.combine === 'frequency') + opt('criticality', 'Criticality decides', S.combine === 'criticality') + '</select></label>' +
      '<label>Extra on top (%)<input type="number" min="0" max="500" step="0.5" data-f="extra" value="' + esc(S.extra) + '"></label>' +
      '<label>Credits per bundle<input type="number" min="1" data-f="bundle" value="' + esc(S.bundle) + '"></label></div>' +
      '<p class="how">Which model a repository gets: the one picked for it in the table below, else its change frequency’s (its criticality’s first when criticality decides), else the default model. Credits = 10K units × Fusion scans × the model’s credits per 10K LOC.</p>');
  }

  function changed(repaint) {
    store.set(KEY, JSON.stringify(S));
    recompute();
    if (repaint) paintControls();
    paintReport();
    ctx.render();
  }
  var data = function (el, k) { return el.getAttribute ? el.getAttribute('data-' + k) : null; };
  function onEdit(ev, final) {
    var el = ev.target, f = data(el, 'f');
    if (!f) return;
    var mi = data(el, 'model'), fr = data(el, 'freq'), cr = data(el, 'crit');
    if (mi !== null) {
      var m = S.models[Number(mi)];
      if (f === 'name') m.name = el.value.slice(0, 80);
      else if (f === 'rate') m.rate = num(el.value, true);
      else if (f === 'def') S.def = m.id;
      return changed(final || f === 'def');
    }
    if (fr) { S.freq[fr][f] = f === 's' ? num(el.value) : el.value || null; return changed(final && f === 's'); }
    if (cr) { S.crit[cr][f] = f === 's' ? num(el.value) : el.value || null; return changed(false); }
    if (f === 'period') {
      var p = Math.min(60, Math.max(1, num(el.value) || 12));
      FREQS.forEach(function (x) { if (num(S.freq[x.id].s) === suggested(x.id, S.period)) S.freq[x.id].s = null; });
      S.period = p;
      return changed(final);
    }
    if (f === 'combine') S.combine = el.value;
    else if (f === 'extra') S.extra = num(el.value, true) || 0;
    else if (f === 'bundle') S.bundle = num(el.value) || 10000;
    changed(false);
  }
  box.addEventListener('input', function (ev) { if (ev.target.tagName === 'INPUT' && ev.target.type !== 'radio') onEdit(ev, false); });
  box.addEventListener('change', function (ev) { onEdit(ev, true); });
  box.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('button') : null, f = el && data(el, 'f');
    if (f === 'add-model') { S.models.push({ id: 'model-' + Date.now().toString(36), name: '', rate: null }); changed(true); }
    else if (f === 'remove') {
      var gone = S.models.splice(Number(data(el, 'model')), 1)[0];
      if (gone && S.def === gone.id) S.def = S.models[0] ? S.models[0].id : null;
      changed(true);
    }
  });
  var reset = D.getElementById('tune-reset');
  if (reset) reset.addEventListener('click', function () { S = fresh(); try { W.localStorage.removeItem(KEY); } catch (e) {} changed(true); });
  var save = D.getElementById('tune-save');
  if (save) save.addEventListener('click', function () {
    var out = { fusion: { periodMonths: S.period, combine: S.combine, defaultScans: num(S.defScans) === null ? 1 : num(S.defScans), defaultModel: defaultModel() ? defaultModel().id : null, models: S.models.map(function (m) { return { id: m.id, name: m.name, creditsPer10k: num(m.rate, true) }; }), byFrequency: {}, byCriticality: {} }, totals: { extraPercent: num(S.extra, true) || 0, bundleCredits: num(S.bundle) || 10000 }, overrides: {} };
    FREQS.forEach(function (f) { var r = S.freq[f.id]; out.fusion.byFrequency[f.id] = { scans: num(r.s) === null ? suggested(f.id, S.period) : num(r.s), model: r.m || null }; });
    CRITS.forEach(function (c) { var r = S.crit[c]; if (num(r.s) !== null || r.m) out.fusion.byCriticality[c] = { scans: num(r.s), model: r.m || null }; });
    Object.keys(S.repo).forEach(function (n) {
      var o = S.repo[n], v = {};
      if (o.c !== undefined && o.c !== null) v.criticality = o.c;
      if (o.s !== undefined && o.s !== null) v.scans = o.s;
      if (o.m) v.model = o.m;
      if (Object.keys(v).length) out.overrides[n] = v;
    });
    if (typeof Blob === 'undefined' || !W.URL) return;
    var url = W.URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    var a = D.createElement('a'); a.href = url; a.download = 'cloc-fusion-settings.json'; D.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { W.URL.revokeObjectURL(url); }, 1000);
  });

  /* Per repository, in the table: criticality, Fusion scans and model. */
  var setRepo = function (n, k, v) {
    var o = Object.prototype.hasOwnProperty.call(S.repo, n) ? S.repo[n] : (S.repo[n] = {});
    o[k] = v;
  };
  ctx.tbody.addEventListener('change', function (ev) {
    var el = ev.target, i = data(el, 'row'), k = data(el, 'pick');
    if (i === null || !k) return;
    var r = rows[Number(i)];
    if (!r) return;
    if (k === 'm') setRepo(r.n, 'm', el.value || null);
    else if (k === 's') setRepo(r.n, 's', num(el.value));
    else if (k === 'c') setRepo(r.n, 'c', el.value ? Number(el.value) : null);
    changed(k === 'c');
  });
  recompute();
  paintControls();
  paintReport();
  return {
    model: function (r) {
      if (!r.inc) return '';
      return '<select data-row="' + r.i + '" data-pick="m" class="' + (r.pin ? 'pinned' : '') + '" aria-label="Model for ' + esc(r.n) + '">' + opt('', 'Auto: ' + (nameOf(modelById(r.auto)) || 'none') + rateText(modelById(r.auto)), !r.pin) +
        S.models.map(function (m) { return opt(m.id, nameOf(m) + rateText(m), r.pin && m.id === r.mi); }).join('') + '</select>';
    },
    scans: function (r) {
      if (!r.inc) return fmt(r.sc);
      var o = repoSet(r), own = o.s !== undefined ? o.s : r.so0;
      return '<input type="number" min="0" data-row="' + r.i + '" data-pick="s" value="' + esc(num(own) === null ? '' : own) + '" placeholder="' + esc(fmt(r.sc)) + '" title="' + esc(r.from === 'repository' ? 'Set for this repository' : 'From its ' + r.from + ' (type to change)') + '" aria-label="Fusion scans for ' + esc(r.n) + '">';
    },
    crit: function (r) {
      if (!r.inc) return '';
      var c = critOf(r);
      return '<select data-row="' + r.i + '" data-pick="c" aria-label="Criticality of ' + esc(r.n) + '">' + opt('', '—', !c) + CRITS.map(function (x) { return opt(x, String(x), Number(c) === x); }).join('') + '</select>';
    },
  };
}

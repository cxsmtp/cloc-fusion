// A single self-contained HTML report: summary, Fusion rules, breakdowns, and a sortable,
// searchable repository table. No external resources, so it opens anywhere, offline.
import { num, esc, modelName } from './format.js';

const kpi = (label, value, note = '') => `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div>${note ? `<div class="kpi-note">${note}</div>` : ''}</div>`;

export function toHtml(report) {
  const t = report.totals;
  const k = report.counts;
  const f = report.settings.fusion;
  const c = report.credits;
  const priced = c.known;
  const maxScans = Math.max(1, ...report.byFrequency.map((b) => b.scans));

  const freqRows = report.byFrequency
    .map(
      (b) => `<tr class="${b.repos ? '' : 'dim'}"><td>${esc(b.label)}</td><td class="n">${num(f.byFrequency[b.id]?.scans)}</td><td class="n">${num(b.repos)}</td><td class="n">${num(b.lines)}</td><td class="n">${num(b.scans)}</td>
      <td class="bar-cell"><span class="bar" style="width:${((b.scans / maxScans) * 100).toFixed(1)}%"></span></td><td class="n">${priced ? num(b.credits, 1) : '—'}</td></tr>`,
    )
    .join('');
  const orgRows = report.byOrg
    .map((o) => `<tr><td>${esc(o.connection)}</td><td>${esc(o.org)}</td><td class="n">${num(o.repos)}</td><td class="n">${num(o.counted)}</td><td class="n">${num(o.lines)}</td><td class="n">${num(o.commits)}</td><td class="n">${num(o.scans)}</td><td class="n">${priced ? num(o.credits, 1) : '—'}</td></tr>`)
    .join('');
  const langRows = Object.entries(report.languages)
    .sort((a, b) => b[1].code - a[1].code)
    .slice(0, 25)
    .map(([name, l]) => `<tr><td>${esc(name)}</td><td>${esc(l.category)}</td><td class="n">${num(l.repos)}</td><td class="n">${num(l.files)}</td><td class="n">${num(l.code)}</td><td class="n">${num(l.comment)}</td></tr>`)
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
    cm: r.commits ?? null,
    cw: r.commitsPerWeek ?? null,
    au: r.authors ?? null,
    lc: r.lastCommitAt ? r.lastCommitAt.slice(0, 10) : '',
    fq: r.frequencyLabel || '',
    fr: r.frequency || '',
    cr: r.criticality ?? null,
    sc: r.included ? r.scans : null,
    un: r.included ? r.units : null,
    md: r.included ? modelName(report, r.model) : '',
    cd: r.included ? r.credits : null,
    w: r.weekly || [],
    st: r.error ? 'failed' : r.skip ? r.skip : r.empty ? 'empty' : r.analyzedAt ? 'ok' : 'pending',
    er: r.error || '',
  }));
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  const creditsKpi = priced
    ? kpi('Fusion credits', num(c.total, 1), `${num(c.bundles)} bundle(s) of ${num(c.settings.bundleCredits)}${c.settings.extraPercent ? ` · incl. ${num(c.settings.extraPercent, 2)}% extra` : ''}`)
    : kpi('Fusion credits', '—', '<span class="warn">Set credits per 10K LOC for your Fusion model to price this.</span>');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fusion Sizing Report</title>
<style>
:root{--bg:#f7f7f5;--surface:#ffffff;--text:#1d1d1b;--muted:#6b6b66;--line:#e4e3de;--accent:#2f5bd3;--accent-soft:#e3eafc;--warn:#a1520a;--bad:#b42318;--ok:#1f7a3d;--bar:#2f5bd3}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#151514;--surface:#1f1f1d;--text:#ecebe6;--muted:#a3a29b;--line:#34332f;--accent:#8aa8ff;--accent-soft:#25304d;--warn:#f0a454;--bad:#ff8a80;--ok:#7bd88f;--bar:#7f9dff}}
:root[data-theme="dark"]{--bg:#151514;--surface:#1f1f1d;--text:#ecebe6;--muted:#a3a29b;--line:#34332f;--accent:#8aa8ff;--accent-soft:#25304d;--warn:#f0a454;--bad:#ff8a80;--ok:#7bd88f;--bar:#7f9dff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1280px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 10px}
.sub{color:var(--muted);margin:0 0 20px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:12px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.kpi-label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.kpi-value{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums;margin-top:2px}
.kpi-note{color:var(--muted);font-size:12.5px;margin-top:2px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:auto}
table{border-collapse:collapse;width:100%}
th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
th{font-size:12px;color:var(--muted);font-weight:600;background:var(--surface);position:sticky;top:0}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
tr.dim td{color:var(--muted)}
.bar-cell{width:22%;min-width:90px}.bar{display:block;height:8px;border-radius:4px;background:var(--bar)}
.warn{color:var(--warn)}.bad{color:var(--bad)}.ok{color:var(--ok)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:16px}.grid2>div{min-width:0}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}
button{font:inherit;color:var(--accent);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:7px 14px;cursor:pointer}
input,select{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:7px 10px}
input[type=search]{flex:1;min-width:200px}
#repos th{cursor:pointer;user-select:none}#repos th[aria-sort]::after{content:" ↕";color:var(--muted)}
#repos th[aria-sort=ascending]::after{content:" ↑"}#repos th[aria-sort=descending]::after{content:" ↓"}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.spark{display:block}
.note{color:var(--muted);font-size:13px;max-width:900px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--accent-soft);font-size:12px}
footer{color:var(--muted);font-size:12px;margin-top:32px}
@media (max-width:600px){.kpi-value{font-size:22px}.grid2{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
<h1>Fusion sizing report</h1>
<p class="sub">${esc(new Date(report.generatedAt).toUTCString())} · commit window ${num(report.settings.windowDays)} days · projection ${num(f.periodMonths)} months · ${num(report.settings.connections?.length || 0)} connection(s)${report.partial ? ' · <span class="warn">partial — scan still running or interrupted</span>' : ''}</p>

<section class="kpis">
${kpi('Repositories', num(k.measured), `${num(k.discovered)} found · ${num(k.skipped)} skipped · ${k.failed ? `<span class="bad">${num(k.failed)} failed</span>` : '0 failed'}`)}
${kpi('Lines of code', num(t.lines), `${num(t.units)} × 10K units (each repo rounded up)`)}
${kpi('Commits in window', num(t.commits), `${num(t.commits / Math.max(1, report.settings.windowDays / 7), 1)} a week across all repos`)}
${kpi('Suggested Fusion scans', num(t.scans), `${num(t.unitScans)} 10K-unit scans`)}
${creditsKpi}
</section>

<h2>Fusion scans by change frequency</h2>
<p class="note">Each commit to the default branch runs a pipeline, so commit frequency stands in for scan frequency: a repository with more than 5 commits a week gets one Fusion scan a week, one with 1–5 a week one every 2 weeks, and so on (the same rules as the Cx Credits Calculator). Credits = 10K units × Fusion scans × the model's credits per 10K LOC.</p>
<div class="card"><table>
<thead><tr><th>Change frequency</th><th class="n">Fusion scans each</th><th class="n">Repos</th><th class="n">LOC</th><th class="n">Total scans</th><th></th><th class="n">Credits</th></tr></thead>
<tbody>${freqRows}</tbody></table></div>

<div class="grid2">
<div><h2>By organization</h2><div class="card"><table>
<thead><tr><th>Connection</th><th>Organization</th><th class="n">Repos</th><th class="n">Measured</th><th class="n">LOC</th><th class="n">Commits</th><th class="n">Scans</th><th class="n">Credits</th></tr></thead>
<tbody>${orgRows || '<tr><td colspan="8">None</td></tr>'}</tbody></table></div></div>
<div><h2>Fusion models</h2><div class="card"><table>
<thead><tr><th>Model</th><th class="n">Credits / 10K LOC</th><th class="n">Repos</th><th class="n">10K-unit scans</th><th class="n">Credits</th></tr></thead>
<tbody>${modelRows || '<tr><td colspan="5"><span class="warn">No Fusion model configured: add one with its credits per 10K LOC (cloc-fusion price --credits-per-10k N).</span></td></tr>'}</tbody></table></div>
<h2>Top languages</h2><div class="card"><table>
<thead><tr><th>Language</th><th>Category</th><th class="n">Repos</th><th class="n">Files</th><th class="n">Code</th><th class="n">Comments</th></tr></thead>
<tbody>${langRows || '<tr><td colspan="6">None</td></tr>'}</tbody></table></div></div>
</div>

<h2>Repositories</h2>
<div class="tools">
<input type="search" id="q" placeholder="Filter by name, organization, language…" aria-label="Filter repositories">
<select id="fq" aria-label="Change frequency"><option value="">All frequencies</option>${report.byFrequency.map((b) => `<option value="${esc(b.id)}">${esc(b.label)}</option>`).join('')}</select>
<select id="st" aria-label="Status"><option value="">All statuses</option><option value="ok">Measured</option><option value="failed">Failed</option><option value="skip">Skipped</option><option value="empty">Empty</option></select>
<span id="count" class="pill"></span>
</div>
<div class="card" style="max-height:75vh"><table id="repos">
<thead><tr>
<th data-k="n">Repository</th><th data-k="o">Organization</th><th data-k="lg">Language</th><th class="n" data-k="loc">LOC</th><th class="n" data-k="cm">Commits</th><th class="n" data-k="cw">Commits / wk</th><th data-k="w">Last 52 weeks</th><th class="n" data-k="au">Authors</th><th data-k="lc">Last commit</th><th data-k="fr">Change frequency</th><th class="n" data-k="sc">Fusion scans</th><th class="n" data-k="un">10K units</th><th data-k="md">Model</th><th class="n" data-k="cd">Credits</th><th data-k="st">Status</th>
</tr></thead><tbody></tbody></table></div>
<div class="tools" style="margin-top:10px"><button type="button" id="more" hidden>Show more</button><button type="button" id="all" hidden>Show all</button></div>

${report.problems?.length ? `<h2>Problems</h2><div class="card"><table><thead><tr><th>Connection</th><th>Organization</th><th>Problem</th></tr></thead><tbody>${report.problems.map((p) => `<tr><td>${esc(p.connection)}</td><td>${esc(p.org || '')}</td><td class="bad" style="white-space:normal">${esc(p.error)}</td></tr>`).join('')}</tbody></table></div>` : ''}

<footer>cloc-fusion ${esc(report.version)} · lines of code are ${esc(report.settings.locBasis === 'all' ? 'all lines' : report.settings.locBasis === 'code+comments' ? 'code and comment lines' : 'code lines (no blanks or comments)')} in ${esc((report.settings.countCategories || []).join(', '))} files, excluding dependencies, build output and generated files.</footer>
</main>
<script id="data" type="application/json">${json}</script>
<script>
(function(){
var rows=JSON.parse(document.getElementById('data').textContent);
var FQ=${JSON.stringify(report.byFrequency.map((b) => b.id))};
var tbody=document.querySelector('#repos tbody'),q=document.getElementById('q'),fq=document.getElementById('fq'),st=document.getElementById('st'),count=document.getElementById('count');
var sortKey='cd',dir=-1,PAGE=250,limit=PAGE,more=document.getElementById('more'),all=document.getElementById('all');
function fmt(n,d){return n===null||n===undefined||n===''?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d||0})}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function spark(w){if(!w||!w.length)return'';var m=Math.max.apply(null,w.concat([1])),W=104,H=20,s='';for(var i=0;i<w.length;i++){var h=w[i]?Math.max(2,Math.round(w[i]/m*H)):0;if(h)s+='<rect x="'+(i*2)+'" y="'+(H-h)+'" width="1.5" height="'+h+'"/>'}return'<svg class="spark" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" fill="currentColor" style="color:var(--bar)" aria-label="weekly commits">'+s+'</svg>'}
function val(r,k){if(k==='fr')return FQ.indexOf(r.fr)<0?99:FQ.indexOf(r.fr);if(k==='w')return r.cm;return r[k]}
function render(){
var text=q.value.trim().toLowerCase(),f=fq.value,s=st.value;
var list=rows.filter(function(r){
if(text&&(r.n+' '+r.o+' '+r.c+' '+r.lg+' '+r.md).toLowerCase().indexOf(text)<0)return false;
if(f&&r.fr!==f)return false;
if(s==='skip'&&['ok','failed','empty','pending'].indexOf(r.st)>=0)return false;
if(s&&s!=='skip'&&r.st!==s)return false;return true});
list.sort(function(a,b){var x=val(a,sortKey),y=val(b,sortKey);if(x===y)return a.n.localeCompare(b.n);if(x===null||x===undefined||x==='')return 1;if(y===null||y===undefined||y==='')return -1;return(typeof x==='number'?x-y:String(x).localeCompare(String(y)))*dir});
count.textContent=list.length+' of '+rows.length;
var shown=list.slice(0,limit);more.hidden=all.hidden=shown.length>=list.length;more.textContent='Show '+Math.min(PAGE,list.length-shown.length)+' more';all.textContent='Show all '+list.length;
tbody.innerHTML=shown.map(function(r){
var name=r.u&&/^https?:\/\//i.test(r.u)?'<a href="'+esc(r.u)+'" target="_blank" rel="noopener">'+esc(r.n)+'</a>':esc(r.n);
var status=r.st==='ok'?'<span class="ok">measured</span>':r.st==='failed'?'<span class="bad" title="'+esc(r.er)+'">failed</span>':'<span class="warn">'+esc(r.st)+'</span>';
return '<tr><td>'+name+'</td><td>'+esc(r.o)+'</td><td>'+esc(r.lg)+'</td><td class="n">'+fmt(r.loc)+'</td><td class="n">'+fmt(r.cm)+'</td><td class="n">'+fmt(r.cw,1)+'</td><td>'+spark(r.w)+'</td><td class="n">'+fmt(r.au)+'</td><td>'+esc(r.lc)+'</td><td>'+esc(r.fq)+'</td><td class="n">'+fmt(r.sc)+'</td><td class="n">'+fmt(r.un)+'</td><td>'+esc(r.md)+'</td><td class="n">'+fmt(r.cd,1)+'</td><td>'+status+'</td></tr>'}).join('');
document.querySelectorAll('#repos th').forEach(function(th){th.setAttribute('aria-sort',th.dataset.k===sortKey?(dir>0?'ascending':'descending'):'none')});
}
document.querySelectorAll('#repos th').forEach(function(th){th.addEventListener('click',function(){var k=th.dataset.k;if(k===sortKey)dir=-dir;else{sortKey=k;dir=['n','o','lg','md','st','fr','lc'].indexOf(k)>=0?1:-1}render()})});
var timer;[q,fq,st].forEach(function(el){el.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(function(){limit=PAGE;render()},120)})});
more.addEventListener('click',function(){limit+=PAGE;render()});all.addEventListener('click',function(){limit=Infinity;render()});
render();
})();
</script>
</body>
</html>
`;
}

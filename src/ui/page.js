// The web app's single page, in the next-gen look (src/report/theme.js). The client code below is
// a real function, serialized into the page, so it is written and linted as ordinary JavaScript.
// Every piece of text it shows goes through DOM text nodes (no HTML strings from data).
import { NEXTGEN_CSS } from '../report/theme-fonts.js';

export const UI_CSS = `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;color:var(--text);font:14.5px/1.55 var(--font);-webkit-font-smoothing:antialiased;background-color:var(--bg);
background-image:radial-gradient(640px 360px at 18% -80px,var(--ng-ambient-1),transparent 70%),radial-gradient(560px 460px at 105% 24%,var(--ng-ambient-2),transparent 70%),radial-gradient(760px 400px at 40% 105%,var(--ng-ambient-3),transparent 70%);background-attachment:fixed;transition:background-color .45s var(--ease),color .45s var(--ease)}
::selection{background:color-mix(in srgb,var(--ng-from) 32%,transparent)}
:focus-visible{outline:2px solid color-mix(in srgb,var(--ng-from) 75%,transparent);outline-offset:2px;border-radius:8px}
.aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.aurora i{position:absolute;width:56vmax;height:56vmax;border-radius:50%;opacity:.28;background:radial-gradient(circle,var(--c) 0,transparent 62%);animation:drift 30s var(--ease) infinite alternate}
.aurora i:nth-child(1){--c:var(--ng-from);top:-24vmax;left:-14vmax}
.aurora i:nth-child(2){--c:var(--ng-to);top:20vh;right:-22vmax;animation-duration:36s}
:root[data-theme="light"] .aurora i{opacity:.10}
@keyframes drift{to{transform:translate(8vmax,6vmax) scale(1.1)}}
.topbar{position:sticky;top:0;z-index:30;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:color-mix(in srgb,var(--bg) 70%,transparent);border-bottom:1px solid var(--ng-glass-line)}
.topbar-in{max-width:1320px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:12px}
.brand{display:flex;align-items:center;gap:11px}
.brand-mark{position:relative;width:34px;height:34px;border-radius:11px;background:var(--ng-solid);display:grid;place-items:center;box-shadow:0 6px 18px -6px var(--ng-glow)}
.brand-mark svg{width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.brand-mark::after{content:"";position:absolute;right:-3px;bottom:-3px;width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid var(--bg);box-shadow:0 0 10px #10b981}
.brand-name{font-weight:700;letter-spacing:-.02em;font-size:16.5px;background:var(--ng-wordmark);-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-name b{background:linear-gradient(90deg,var(--ng-from),var(--ng-to));-webkit-background-clip:text;background-clip:text;color:transparent}
.chip{font:500 11px var(--mono);letter-spacing:.03em;padding:3px 9px;border-radius:999px;border:1px solid var(--ng-glass-line);color:var(--muted);background:color-mix(in srgb,var(--surface) 60%,transparent);white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.chip.dirty::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--warn);box-shadow:0 0 8px var(--warn)}
.chip.saved::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok)}
.spacer{flex:1}
button,.btn{font:600 13px/1 var(--font);color:var(--text);display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 80%,transparent);cursor:pointer;text-decoration:none;white-space:nowrap;
transition:background .2s var(--ease),border-color .2s var(--ease),box-shadow .25s var(--ease),transform .12s var(--ease),filter .2s,opacity .2s}
button:hover:not(:disabled),.btn:hover{border-color:color-mix(in srgb,var(--ng-from) 45%,transparent);background:color-mix(in srgb,var(--ng-from) 9%,var(--surface));box-shadow:0 6px 18px -10px var(--ng-glow);transform:translateY(-1px)}
button:active:not(:disabled){transform:translateY(1px)}
button:disabled{opacity:.45;cursor:not-allowed}
button.primary{color:#fff;border-color:transparent;background:var(--ng-solid);box-shadow:0 8px 22px -10px var(--ng-glow),inset 0 1px 0 rgb(255 255 255/.18)}
button.primary:hover:not(:disabled){filter:brightness(1.1);background:var(--ng-solid)}
button.golden{color:#3a2300;border-color:#c99418;background:linear-gradient(120deg,#fff1b8 0%,#f8d55c 28%,#e3a812 52%,#f8d55c 76%,#fff1b8 100%);background-size:220% 100%;box-shadow:0 0 0 1px rgb(255 214 92/.6),0 2px 10px rgb(227 168 18/.45),0 0 22px 6px color-mix(in srgb,var(--ng-from) 50%,transparent),0 0 46px 14px color-mix(in srgb,var(--ng-to) 26%,transparent);animation:gold 6s linear infinite}
button.golden:hover:not(:disabled){background:linear-gradient(120deg,#fff6cf 0%,#fbdf72 28%,#ecb424 52%,#fbdf72 76%,#fff6cf 100%);background-size:220% 100%;border-color:#c99418;filter:brightness(1.04)}
button.golden:disabled{animation:none;box-shadow:none;filter:grayscale(.7)}
@keyframes gold{to{background-position:220% 0}}
button.ghost{background:transparent;border-color:transparent}
button.danger:hover:not(:disabled){border-color:color-mix(in srgb,var(--danger) 50%,transparent);background:color-mix(in srgb,var(--danger) 10%,var(--surface))}
button.sm,.btn.sm{min-height:30px;padding:0 10px;font-size:12px;border-radius:9px}
button.big{min-height:46px;padding:0 22px;font-size:14.5px;border-radius:12px}
.icon-btn{width:36px;padding:0}
svg.i{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.wrap{position:relative;z-index:1;max-width:1320px;margin:0 auto;padding:22px 20px 80px;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:22px;align-items:start}
.glass{background:var(--ng-glass);border:1px solid var(--ng-glass-line);border-radius:20px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:var(--shadow)}
.card{padding:22px 24px;margin-bottom:18px;animation:rise .55s var(--ease) both}
.card:nth-child(2){animation-delay:.06s}.card:nth-child(3){animation-delay:.12s}.card:nth-child(4){animation-delay:.18s}
@keyframes rise{from{opacity:0;transform:translateY(12px)}}
.card-h{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.card-h h2{margin:0;font-size:18px;font-weight:700;letter-spacing:-.015em}
.step{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font:700 12px var(--mono);color:#fff;background:linear-gradient(135deg,var(--ng-from),var(--ng-to));box-shadow:0 0 14px var(--ng-glow);flex:none}
.step.ok{background:linear-gradient(135deg,#10b981,#06b6d4)}
.lede{color:var(--muted);margin:-6px 0 16px;font-size:13.5px}
.hero{padding:26px 28px;margin-bottom:18px;position:relative;overflow:hidden;isolation:isolate;animation:rise .5s var(--ease) both}
.hero::after{content:"";position:absolute;width:380px;height:380px;right:-120px;top:-180px;border-radius:50%;background:radial-gradient(circle,var(--ng-glow),transparent 65%);z-index:-1;animation:breathe 7s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.15);opacity:.7}}
.eyebrow{font:600 11px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:8px}
.eyebrow::before{content:"";width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 12px #10b981}
.hero h1{font-size:clamp(24px,3.2vw,36px);line-height:1.1;letter-spacing:-.03em;margin:10px 0 8px}
.grad{background:linear-gradient(100deg,var(--ng-from),var(--ng-to) 55%,#10b981);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:0;color:var(--muted);max-width:70ch}
.field{display:grid;gap:6px;min-width:0}
.field>span{font:600 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ng-head);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.warn-box{margin-top:10px;padding:10px 12px;border-radius:12px;font-size:12.5px;color:#fbbf24;background:color-mix(in srgb,#f59e0b 10%,transparent);border:1px solid color-mix(in srgb,#f59e0b 30%,transparent)}.warn-box ul{margin:6px 0 0;padding-left:18px;color:var(--text)}.warn-box li{overflow-wrap:anywhere}
.rules-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:26px;align-items:start}.rules-grid table{width:100%}.rules-grid select{min-width:170px}
.field small{color:var(--muted);font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
input,select,textarea{font:500 13.5px var(--font);color:var(--text);min-height:38px;padding:0 12px;border-radius:11px;border:1px solid color-mix(in srgb,var(--text) 12%,transparent);background-color:color-mix(in srgb,var(--surface-2) 85%,transparent);transition:border-color .2s,box-shadow .25s var(--ease);width:100%}
textarea{padding:10px 12px;min-height:76px;resize:vertical;font-family:var(--mono);font-size:12.5px}
input[type=number]{font-family:var(--mono)}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--ng-from);box-shadow:0 0 0 3px color-mix(in srgb,var(--ng-from) 22%,transparent),0 0 24px -8px var(--ng-glow)}
input[type=checkbox]{width:auto;min-height:0}
.seg{display:inline-grid;grid-auto-flow:column;gap:3px;padding:3px;border-radius:12px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface-2) 80%,transparent)}
.seg button{min-height:30px;border:0;background:transparent;color:var(--muted);font-size:12.5px;box-shadow:none;transform:none}
.seg button.on{color:var(--text);background:linear-gradient(135deg,color-mix(in srgb,var(--ng-from) 24%,transparent),color-mix(in srgb,var(--ng-to) 12%,transparent));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ng-from) 40%,transparent)}
.toggle{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;font-weight:500}
.toggle input{appearance:none;width:38px;height:22px;border-radius:999px;background:color-mix(in srgb,var(--text) 16%,transparent);position:relative;cursor:pointer;transition:background .25s var(--ease);border:0;padding:0}
.toggle input::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.3);transition:transform .25s var(--ease)}
.toggle input:checked{background:linear-gradient(135deg,var(--ng-from),var(--ng-to));box-shadow:0 0 12px var(--ng-glow)}
.toggle input:checked::after{transform:translateX(16px)}
.pills{display:flex;gap:8px;flex-wrap:wrap}
.pill-btn{min-height:30px;border-radius:999px;font-size:12.5px;color:var(--muted)}
.pill-btn.on{color:var(--accent);border-color:color-mix(in srgb,var(--ng-from) 45%,transparent);background:color-mix(in srgb,var(--ng-from) 14%,transparent);box-shadow:0 0 14px -6px var(--ng-glow)}
.conn{border:1px solid var(--ng-glass-line);border-radius:16px;padding:14px 16px;margin-bottom:12px;background:color-mix(in srgb,var(--surface) 55%,transparent);transition:border-color .3s,box-shadow .3s}
.conn.ok{border-color:color-mix(in srgb,var(--ok) 35%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ok) 10%,transparent),0 10px 30px -22px var(--ok)}
.conn-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.badge{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font:700 15px var(--font);color:#fff;background:var(--ng-solid);box-shadow:0 6px 16px -8px var(--ng-glow);flex:none}
.conn-name{font-weight:700;font-size:15px}
.conn-sub{color:var(--muted);font-size:12.5px}
.status{display:inline-flex;align-items:center;gap:7px;font:600 12px var(--mono);padding:5px 11px;border-radius:999px;border:1px solid var(--ng-glass-line)}
.status::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}
.status.ok{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 30%,transparent)}
.status.bad{color:var(--warn);border-color:color-mix(in srgb,var(--warn) 30%,transparent)}
.status.wait{color:var(--muted)}
.status.wait::before{animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{opacity:.25}}
.editor{margin-top:14px;padding-top:14px;border-top:1px dashed var(--ng-glass-line);display:grid;gap:16px;animation:rise .35s var(--ease) both}
.tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:38px;padding:4px 6px;border-radius:11px;border:1px solid color-mix(in srgb,var(--text) 12%,transparent);background:color-mix(in srgb,var(--surface-2) 85%,transparent)}
.tags input{border:0;background:transparent;min-height:28px;flex:1;min-width:120px;box-shadow:none;padding:0 6px}
.tag{display:inline-flex;align-items:center;gap:6px;font:500 12px var(--mono);padding:3px 4px 3px 10px;border-radius:999px;background:color-mix(in srgb,var(--ng-from) 16%,transparent);color:var(--accent);border:1px solid color-mix(in srgb,var(--ng-from) 30%,transparent);animation:pop .2s var(--ease)}
.tag button{min-height:18px;width:18px;padding:0;border-radius:50%;border:0;background:transparent;color:inherit;font-size:13px}
@keyframes pop{from{opacity:0;transform:scale(.9)}}
.signin{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.method{border:1px solid var(--ng-glass-line);border-radius:14px;padding:14px;display:grid;gap:10px;align-content:start;background:color-mix(in srgb,var(--surface-2) 60%,transparent);transition:border-color .25s,transform .25s var(--ease),box-shadow .25s}
.method:hover{border-color:color-mix(in srgb,var(--ng-from) 35%,transparent);transform:translateY(-2px);box-shadow:0 14px 30px -22px var(--ng-glow)}
.method h4{margin:0;font-size:14px;display:flex;align-items:center;gap:8px}
.method p{margin:0;color:var(--muted);font-size:12.5px}
.rec{font:600 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:#10b981;border:1px solid color-mix(in srgb,#10b981 40%,transparent);border-radius:999px;padding:1px 7px}
.code-box{display:grid;justify-items:center;gap:12px;padding:18px;border-radius:16px;border:1px solid color-mix(in srgb,var(--ng-from) 35%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--ng-from) 12%,transparent),color-mix(in srgb,var(--ng-to) 8%,transparent));text-align:center;animation:rise .35s var(--ease) both}
.code{font:700 30px var(--mono);letter-spacing:.18em;padding:4px 14px;border-radius:12px;background:var(--surface);box-shadow:0 0 30px -10px var(--ng-glow)}
.spin{width:16px;height:16px;border-radius:50%;border:2px solid color-mix(in srgb,var(--text) 15%,transparent);border-top-color:var(--ng-from);animation:spin .8s linear infinite;display:inline-block;vertical-align:-3px}
@keyframes spin{to{transform:rotate(360deg)}}
table{border-collapse:collapse;width:100%}
th,td{padding:8px 10px;border-bottom:1px solid var(--ng-glass-line);text-align:left}
th{font:600 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ng-head)}
td input,td select{min-height:34px}
td.n,th.n{text-align:right}
.suggested{font:500 10.5px var(--mono);color:var(--muted);margin-left:6px}
details.more>summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:13px;list-style:none}
details.more>summary::-webkit-details-marker{display:none}
details.more>summary::before{content:"▸ ";transition:transform .2s}
details.more[open]>summary::before{content:"▾ "}
.side{position:sticky;top:76px;display:grid;gap:18px}
.plan{padding:22px}
.check{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13.5px}
.check i{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;flex:none;border:1px solid var(--ng-glass-line);color:var(--muted);font-style:normal;font-size:11px;transition:all .4s var(--ease)}
.check.ok i{color:#fff;border-color:transparent;background:linear-gradient(135deg,#10b981,#06b6d4);box-shadow:0 0 12px rgb(16 185 129/.5)}
.big-figure{font:600 38px/1 var(--mono);letter-spacing:-.04em}
.unit{color:var(--muted);font-size:12.5px}
.bar{height:10px;border-radius:999px;background:color-mix(in srgb,var(--text) 8%,transparent);overflow:hidden}
.bar span{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,var(--ng-from),var(--ng-to));box-shadow:0 0 14px var(--ng-glow);transition:width .5s var(--ease)}
.log{font:12px/1.55 var(--mono);max-height:220px;overflow:auto;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--surface-2) 90%,transparent);border:1px solid var(--ng-glass-line);white-space:pre-wrap;word-break:break-word;color:var(--muted)}
.mini{display:grid;grid-template-columns:1fr auto;gap:6px 10px;font-size:12.5px;align-items:center}
.mini .bar{grid-column:1/-1;height:6px}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tile{padding:12px;border-radius:14px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 55%,transparent)}
.tile b{display:block;font:600 20px var(--mono);letter-spacing:-.03em}
.tile span{font:600 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ng-head)}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.muted{color:var(--muted)}
.warn{color:var(--warn)}.bad{color:var(--danger)}.ok-t{color:var(--ok)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);opacity:0;z-index:50;padding:12px 18px;border-radius:14px;background:color-mix(in srgb,var(--surface) 95%,transparent);border:1px solid var(--ng-glass-line);box-shadow:var(--shadow-pop);font-weight:600;transition:all .35s var(--ease);pointer-events:none;max-width:90vw}
.toast.show{opacity:1;transform:translateX(-50%)}
.toast.err{border-color:color-mix(in srgb,var(--danger) 45%,transparent)}
.look{position:relative}
.look>summary{list-style:none}
.look>summary::-webkit-details-marker{display:none}
.look-pop{position:absolute;right:0;top:calc(100% + 8px);width:250px;display:grid;gap:10px;padding:14px;border-radius:16px;border:1px solid var(--ng-glass-line);background:color-mix(in srgb,var(--surface) 95%,transparent);box-shadow:var(--shadow-pop);animation:pop .2s var(--ease);z-index:40}
.swatches{display:flex;gap:9px}
.swatches button{width:28px;height:28px;min-height:0;padding:0;border-radius:50%;border:0;background:linear-gradient(135deg,var(--a),var(--b))}
.swatches button.on{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--a),0 0 16px var(--a)}
footer{grid-column:1/-1;color:var(--muted);font-size:12px;display:flex;gap:14px;flex-wrap:wrap;justify-content:space-between}
@media (max-width:1060px){.wrap{grid-template-columns:1fr}.side{position:static}}
@media (max-width:560px){.wrap{padding:16px 16px 64px}.card{padding:18px}.topbar-in{padding:10px 16px}.chip.path{display:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.aurora{display:none}}
`;

/* eslint-disable no-undef */
function clientApp(boot) {
  const D = document;
  const $ = (s, el = D) => el.querySelector(s);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON = {
    plus: 'M12 5v14M5 12h14',
    play: 'M7 4.5v15l12-7.5z',
    save: 'M5 4h11l3 3v13H5zM8 4v5h7M8 20v-6h8v6',
    stop: 'M7 7h10v10H7z',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    check: 'm5 12.5 4.5 4.5L19 7.5',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    key: 'M15 7a4 4 0 1 1-3.5 6L5 19.5V22H2v-3l7-7A4 4 0 0 1 15 7Z',
    refresh: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    report: 'M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3',
    download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14',
    look: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0v18',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-3.5-3.5',
  };
  function icon(name) {
    const s = D.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'i');
    s.setAttribute('aria-hidden', 'true');
    const p = D.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICON[name]);
    s.append(p);
    return s;
  }
  // A tiny element builder: properties, events, and children as nodes or text (never HTML).
  function h(tag, props, ...kids) {
    const el = D.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (['value', 'checked', 'disabled', 'hidden', 'selected', 'open'].includes(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : D.createTextNode(String(kid)));
    return el;
  }
  const fmt = (n, d = 0) => (n === null || n === undefined || n === '' || !isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let S = null; // server state
  let cfg = null; // the working configuration
  let dirty = false;
  const status = {}; // connection → { state: 'checking'|'ok'|'bad', who, error, orgs }
  const open = {}; // connection editors open
  const optsCache = {}; // provider|apiUrl|org → sign-in options of a connection not saved yet
  const auth = {}; // connection → live sign-in { status, userCode, verificationUri, error, id }

  async function api(path, body) {
    const res = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-cf-key': boot.key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  let toastTimer;
  function toast(text, err = false) {
    const t = $('#toast');
    t.textContent = text;
    t.className = `toast show${err ? ' err' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 3600);
  }

  // ---------- configuration helpers ----------
  const get = (path, obj = cfg) => path.reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  function set(path, value, obj = cfg) {
    let o = obj;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] ??= typeof path[i + 1] === 'number' ? [] : {};
    o[path[path.length - 1]] = value;
    markDirty();
  }
  function markDirty() {
    dirty = true;
    renderPlan();
    const c = $('#save-state');
    c.className = 'chip dirty';
    c.textContent = 'Unsaved changes';
  }
  function markSaved() {
    dirty = false;
    const c = $('#save-state');
    c.className = 'chip saved';
    c.textContent = S.configExists ? 'Saved' : 'Defaults: not saved yet';
  }
  const field = (label, control, note) => h('label', { class: 'field' }, h('span', null, label), control, note ? h('small', null, note) : null);
  const num = (path, opts = {}) =>
    h('input', {
      type: 'number',
      min: opts.min ?? 0,
      max: opts.max,
      step: opts.step ?? 1,
      value: opts.read ? opts.read(get(path)) : get(path) ?? '',
      placeholder: opts.placeholder,
      oninput: (e) => {
        const v = e.target.value === '' ? null : Number(e.target.value);
        set(path, opts.write ? opts.write(v) : v);
        opts.after?.();
      },
    });
  const text = (path, placeholder = '') => h('input', { type: 'text', value: get(path) ?? '', placeholder, oninput: (e) => set(path, e.target.value) });
  const toggle = (path, label) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: Boolean(get(path)), onchange: (e) => set(path, e.target.checked) }), label);
  function seg(path, options, after) {
    const box = h('div', { class: 'seg', role: 'group' });
    const draw = () => {
      box.replaceChildren(...options.map(([v, label]) => h('button', { type: 'button', class: get(path) === v ? 'on' : '', 'aria-pressed': String(get(path) === v), onclick: () => (set(path, v), draw(), after?.()) }, label)));
    };
    draw();
    return box;
  }
  const lines = (path, placeholder) =>
    h('textarea', {
      placeholder,
      value: (get(path) || []).join('\n'),
      oninput: (e) =>
        set(
          path,
          e.target.value
            .split(/\n/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
    });
  const providerOf = (id) => S.providers.find((p) => p.id === id) || S.providers[0];

  // ---------- connections ----------
  function statusPill(name) {
    const st = status[name];
    if (st?.state === 'checking') return h('span', { class: 'status wait' }, 'Checking…');
    if (!st) return h('span', { class: 'status bad' }, 'Not signed in yet');
    if (st.state === 'ok') return h('span', { class: 'status ok' }, `Signed in${st.who ? ` as ${st.who}` : ''}`);
    return h('span', { class: 'status bad', title: st.error || '' }, 'Not signed in');
  }
  function orgsEditor(conn, i) {
    const p = providerOf(conn.provider);
    const all = conn.orgs === 'all';
    const list = Array.isArray(conn.orgs) ? conn.orgs : [];
    const box = h('div', { class: 'tags' });
    const draw = () => {
      const cur = Array.isArray(cfg.connections[i].orgs) ? cfg.connections[i].orgs : [];
      const input = h('input', {
        placeholder: cur.length ? 'add another…' : `type ${/^[aeiou]/i.test(p.orgNoun) ? 'an' : 'a'} ${p.orgNoun} and press Enter`,
        onkeydown: (e) => {
          if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
            e.preventDefault();
            const v = e.target.value.trim();
            if (!cur.includes(v)) set(['connections', i, 'orgs'], [...cur, v]);
            draw();
            $('input', box).focus();
          } else if (e.key === 'Backspace' && !e.target.value && cur.length) {
            set(['connections', i, 'orgs'], cur.slice(0, -1));
            draw();
            $('input', box).focus();
          }
        },
      });
      box.replaceChildren(
        ...cur.map((o) => h('span', { class: 'tag' }, o === '@me' ? 'My own repositories' : o, h('button', { type: 'button', 'aria-label': `Remove ${o}`, onclick: () => (set(['connections', i, 'orgs'], cur.filter((x) => x !== o)), draw()) }, '×'))),
        input,
      );
    };
    draw();
    const found = status[conn.name]?.orgs || [];
    return h(
      'div',
      { class: 'field' },
      h('span', null, `${p.orgNoun}s to scan`),
      h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: all, onchange: (e) => (set(['connections', i, 'orgs'], e.target.checked ? 'all' : list.length ? list : []), renderConnections()) }), `Every ${p.orgNoun} this sign-in can see`),
      all ? null : box,
      !all && found.length
        ? h(
            'div',
            { class: 'pills' },
            h('small', { class: 'muted' }, 'Found: '),
            found.map((o) => {
              const on = list.includes(o.id);
              return h('button', { type: 'button', class: `pill-btn${on ? ' on' : ''}`, title: o.label, onclick: () => (set(['connections', i, 'orgs'], on ? list.filter((x) => x !== o.id) : [...list, o.id]), renderConnections()) }, o.id === '@me' ? 'My own repositories' : o.id);
            }),
          )
        : null,
    );
  }
  function signInPanel(conn, i) {
    const saved = S.config.connections.find((c) => c.name === conn.name);
    const sameAsSaved = saved && saved.provider === conn.provider && (saved.apiUrl || '') === (conn.apiUrl || '') && String(saved.orgs?.[0] || '') === String(conn.orgs?.[0] || '');
    const optsKey = `${conn.provider}|${conn.apiUrl || ''}|${Array.isArray(conn.orgs) ? conn.orgs[0] || '' : ''}`;
    let opts = sameAsSaved ? S.signIn[conn.name] : optsCache[optsKey];
    if (!opts) {
      opts = { gh: conn.provider === 'github' && S.tools.gh, tokenUrl: '' };
      optsCache[optsKey] = opts;
      api('/api/connection/signin', { connection: conn })
        .then((o) => ((optsCache[optsKey] = o), renderConnections()))
        .catch(() => {});
    }
    const live = auth[conn.name];
    const p = providerOf(conn.provider);
    if (live && ['starting', 'waiting', 'code'].includes(live.status)) {
      return h(
        'div',
        { class: 'code-box' },
        live.userCode ? [h('div', { class: 'muted' }, 'Enter this code on the sign-in page'), h('div', { class: 'code' }, live.userCode)] : h('div', null, h('span', { class: 'spin' }), ' ', live.method === 'az' ? 'Finish signing in in the Microsoft window that opened…' : 'Starting the sign-in…'),
        h(
          'div',
          { class: 'row' },
          live.userCode ? h('button', { type: 'button', onclick: () => (navigator.clipboard?.writeText(live.userCode), toast('Code copied')) }, icon('copy'), 'Copy code') : null,
          live.verificationUri && /^https:\/\//.test(live.verificationUri) ? h('a', { class: 'btn primary', href: live.verificationUri, target: '_blank', rel: 'noopener noreferrer' }, icon('ext'), 'Open sign-in page') : null,
          h('button', { type: 'button', class: 'ghost', onclick: () => api('/api/auth/cancel', { id: live.id }).catch(() => {}) }, 'Cancel'),
        ),
        live.userCode ? h('div', { class: 'muted' }, h('span', { class: 'spin' }), ' Waiting for you to approve…') : null,
      );
    }
    const browserStart = (method) => async () => {
      if (!(await ensureSaved())) return;
      try {
        const a = await api('/api/auth/start', { connection: conn.name, method });
        auth[conn.name] = a;
        renderConnections();
      } catch (err) {
        toast(err.message, true);
      }
    };
    const methods = [];
    if (opts.gh) methods.push(h('div', { class: 'method' }, h('h4', null, 'Sign in with GitHub', h('span', { class: 'rec' }, 'recommended')), h('p', null, 'Opens GitHub in your browser with a one-time code, through the GitHub CLI. Works with SSO / Okta.'), h('button', { type: 'button', class: 'primary', onclick: browserStart('gh') }, icon('key'), 'Sign in with GitHub')));
    if (opts.az) methods.push(h('div', { class: 'method' }, h('h4', null, 'Sign in with Microsoft', h('span', { class: 'rec' }, 'recommended')), h('p', null, 'Microsoft Entra ID sign-in in your browser, through the Azure CLI. Works with Okta federation.'), h('button', { type: 'button', class: 'primary', onclick: browserStart('az') }, icon('key'), 'Sign in with Microsoft')));
    if (opts.device) methods.push(h('div', { class: 'method' }, h('h4', null, `Sign in with ${p.label.split(' ')[0]}`, opts.gh ? null : h('span', { class: 'rec' }, 'recommended')), h('p', null, 'Approve cloc-fusion on the platform’s own sign-in page with a short code.'), h('button', { type: 'button', class: 'primary', onclick: browserStart('device') }, icon('key'), 'Sign in in the browser')));
    const needsUser = ['bitbucket', 'generic'].includes(conn.provider);
    const user = h('input', { type: 'text', placeholder: conn.provider === 'bitbucket' ? 'Atlassian email (API token) — or leave empty for an access token' : 'Username (optional)', autocomplete: 'off' });
    const tok = h('input', { type: 'password', placeholder: 'Paste the token', autocomplete: 'off', spellcheck: 'false' });
    methods.push(
      h(
        'div',
        { class: 'method' },
        h('h4', null, 'Create a token in the browser', methods.length ? null : h('span', { class: 'rec' }, 'easiest')),
        h('p', null, 'Opens the token page with the right permissions ticked where the platform allows. Paste it here once: it is kept privately on this computer, not in the settings file.'),
        opts.tokenUrl ? h('a', { class: 'btn', href: opts.tokenUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('ext'), 'Open the token page') : null,
        needsUser ? user : null,
        tok,
        h(
          'button',
          {
            type: 'button',
            onclick: async (e) => {
              if (!tok.value.trim()) return toast('Paste the token first', true);
              if (!(await ensureSaved())) return;
              e.target.disabled = true;
              try {
                const r = await api('/api/auth/token', { connection: conn.name, token: tok.value.trim(), username: user.value.trim() });
                tok.value = '';
                await reloadState();
                status[cfg.connections[i].name] = r.ok ? { state: 'ok', who: r.who, orgs: r.orgs } : { state: 'bad', error: r.error };
                renderAll();
                toast(r.ok ? `Signed in as ${r.who}` : r.error, !r.ok);
              } catch (err) {
                toast(err.message, true);
              } finally {
                e.target.disabled = false;
              }
            },
          },
          icon('check'),
          'Save and verify',
        ),
      ),
    );
    const methodsOfProvider = p.authMethods;
    return h(
      'div',
      { class: 'field' },
      h('span', null, 'Sign in'),
      live?.status === 'error' ? h('div', { class: 'bad' }, `Sign-in failed: ${live.error}`) : null,
      h('div', { class: 'signin' }, methods),
      h(
        'details',
        { class: 'more' },
        h('summary', null, 'Advanced: how the token is found'),
        h(
          'div',
          { class: 'grid', style: 'margin-top:12px' },
          field(
            'Method',
            h(
              'select',
              { onchange: (e) => (set(['connections', i, 'auth', 'method'], e.target.value), renderConnections()) },
              methodsOfProvider.map((m) => h('option', { value: m.id, selected: conn.auth?.method === m.id }, m.label)),
            ),
          ),
          methodsOfProvider.find((m) => m.id === conn.auth?.method)?.browser
            ? h('small', { class: 'muted' }, 'Uses the platform CLI’s own sign-in; no token is stored by cloc-fusion.')
            : [
                field('Environment variable', h('input', { type: 'text', value: conn.auth?.token?.env || '', placeholder: 'e.g. GITHUB_TOKEN', oninput: (e) => set(['connections', i, 'auth', 'token'], e.target.value ? { env: e.target.value } : { saved: true }) }), 'Read each run, never stored'),
                field('Or a command that prints it', h('input', { type: 'text', value: conn.auth?.token?.command && typeof conn.auth.token.command === 'string' ? conn.auth.token.command : '', placeholder: 'e.g. op read op://vault/git/token', oninput: (e) => set(['connections', i, 'auth', 'token'], e.target.value ? { command: e.target.value } : { saved: true }) })),
              ],
        ),
      ),
    );
  }
  function connectionCard(conn, i) {
    const p = providerOf(conn.provider);
    const st = status[conn.name];
    const orgsText = conn.orgs === 'all' ? `every ${p.orgNoun}` : (conn.orgs || []).map((o) => (o === '@me' ? 'my own repositories' : o)).join(', ') || `no ${p.orgNoun}s yet`;
    const card = h(
      'div',
      { class: `conn${st?.state === 'ok' ? ' ok' : ''}` },
      h(
        'div',
        { class: 'conn-top' },
        h('div', { class: 'badge', 'aria-hidden': 'true' }, { github: 'GH', gitlab: 'GL', azure: 'AZ', bitbucket: 'BB', 'bitbucket-server': 'BS', generic: 'Git' }[conn.provider] || '?'),
        h('div', { style: 'flex:1;min-width:160px' }, h('div', { class: 'conn-name' }, conn.name || 'New connection'), h('div', { class: 'conn-sub' }, `${p.label} · ${orgsText}`)),
        statusPill(conn.name),
        st?.state === 'ok'
          ? h('button', { type: 'button', class: 'sm', title: 'Check again', onclick: () => checkOne(conn.name) }, icon('refresh'))
          : h('button', { type: 'button', class: 'primary sm', onclick: () => ((open[i] = true), renderConnections()) }, icon('key'), 'Sign in'),
        h('button', { type: 'button', class: 'sm', 'aria-expanded': String(Boolean(open[i])), onclick: () => ((open[i] = !open[i]), renderConnections()) }, icon('edit'), open[i] ? 'Close' : 'Edit'),
        h('button', { type: 'button', class: 'sm danger', title: 'Remove this connection', onclick: () => (confirm(`Remove ${conn.name}?`) && (cfg.connections.splice(i, 1), markDirty(), renderConnections())) }, icon('trash')),
      ),
    );
    if (open[i]) {
      card.append(
        h(
          'div',
          { class: 'editor' },
          h(
            'div',
            { class: 'grid' },
            field('Name', text(['connections', i, 'name'], 'e.g. github-acme')),
            field(
              'Platform',
              h(
                'select',
                {
                  onchange: (e) => {
                    const np = providerOf(e.target.value);
                    cfg.connections[i] = { name: conn.name, provider: np.id, auth: { method: np.authMethods[0].id }, orgs: [] };
                    markDirty();
                    renderConnections();
                  },
                },
                S.providers.map((x) => h('option', { value: x.id, selected: x.id === conn.provider }, x.label)),
              ),
            ),
            conn.provider === 'generic' ? null : field('API address', text(['connections', i, 'apiUrl'], p.defaultApiUrl || 'https://…'), p.apiUrlHint),
          ),
          conn.provider === 'generic' ? field('Clone URLs', lines(['connections', i, 'repos'], 'https://git.example.com/team/repo.git — one per line')) : orgsEditor(conn, i),
          signInPanel(conn, i),
          h(
            'details',
            { class: 'more' },
            h('summary', null, 'Advanced: which repositories'),
            h('div', { class: 'grid', style: 'margin-top:12px' }, field('Only repositories matching', lines(['connections', i, 'include'], 'acme/payments-*')), field('Skip repositories matching', lines(['connections', i, 'exclude'], 'acme/sandbox-*'))),
          ),
        ),
      );
    }
    return card;
  }
  function renderConnections() {
    const box = $('#connections');
    box.replaceChildren(
      ...cfg.connections.map(connectionCard),
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            const n = cfg.connections.length + 1;
            cfg.connections.push({ name: `connection-${n}`, provider: 'github', auth: { method: S.tools.gh ? 'gh-cli' : 'pat', ...(S.tools.gh ? {} : { token: { saved: true } }) }, orgs: [] });
            open[cfg.connections.length - 1] = true;
            markDirty();
            renderConnections();
          },
        },
        icon('plus'),
        'Add a connection',
      ),
    );
    renderPlan();
  }

  // ---------- settings ----------
  function renderSettings() {
    const MB = 1048576;
    const GB = 1073741824;
    $('#settings').replaceChildren(
      h(
        'div',
        { class: 'grid' },
        field('How repositories are measured', seg(['engine'], [['auto', 'Auto'], ['git', 'Git'], ['api', 'APIs only']]), `Auto picks git when it is installed (here: ${S.engine})`),
        field('Commit history window (days)', num(['windowDays'], { min: 7 })),
        field('Lines of code count', seg(['locBasis'], [['code', 'Code'], ['code+comments', '+ comments'], ['all', 'All lines']])),
      ),
      h('div', { class: 'row', style: 'margin:16px 0 4px;gap:22px' }, toggle(['includeArchived'], 'Include archived repositories'), toggle(['includeForks'], 'Include forks'), toggle(['includeMerges'], 'Count merge commits')),
      h(
        'div',
        { class: 'field', style: 'margin-top:14px' },
        h('span', null, 'File types that count'),
        h(
          'div',
          { class: 'pills' },
          [
            ['code', 'Code'],
            ['markup', 'Markup (HTML, templates)'],
            ['iac', 'Infrastructure as code'],
            ['data', 'Data (JSON, YAML, XML)'],
            ['docs', 'Docs'],
          ].map(([id, label]) => {
            const on = (cfg.countCategories || []).includes(id);
            return h('button', { type: 'button', class: `pill-btn${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick: () => (set(['countCategories'], on ? cfg.countCategories.filter((c) => c !== id) : [...(cfg.countCategories || []), id]), renderSettings()) }, label);
          }),
        ),
      ),
      h(
        'details',
        { class: 'more', style: 'margin-top:16px' },
        h('summary', null, 'Advanced: paths, speed and limits'),
        h(
          'div',
          { class: 'grid', style: 'margin-top:12px' },
          field('Skip paths', lines(['exclude'], '**/test/**')),
          field('Only paths', lines(['include'], '(all)')),
          field('Repositories at once', num(['concurrency'], { min: 1, max: 64 })),
          field('Organizations listed at once', num(['discoveryConcurrency'], { min: 1, max: 32 })),
          field('Per-repository limit (minutes)', num(['repoTimeoutMinutes'], { min: 1 })),
          field('Largest file counted (MB)', num(['maxFileBytes'], { min: 0.1, step: 0.1, read: (v) => (v ? +(v / MB).toFixed(2) : ''), write: (v) => Math.round((v || 2) * MB) })),
          field('Largest archive (GB, API engine)', num(['maxArchiveBytes'], { min: 0.1, step: 0.1, read: (v) => (v ? +(v / GB).toFixed(2) : ''), write: (v) => Math.round((v || 4) * GB) })),
        ),
      ),
    );
  }

  // ---------- pricing ----------
  function renderPricing() {
    const f = cfg.fusion;
    f.models ||= [];
    const defaultName = () => {
      const m = f.models.find((x) => x.id === (f.defaultModel || f.models[0]?.id));
      return m ? `Default: ${m.name || 'unnamed'}${m.creditsPer10k != null && m.creditsPer10k !== '' ? ` · ${m.creditsPer10k}` : ''}` : '(default model)';
    };
    const modelOptions = (selected) => [h('option', { value: '' }, defaultName()), ...f.models.map((m) => h('option', { value: m.id, selected: m.id === selected }, `${m.name || m.id}${m.creditsPer10k != null && m.creditsPer10k !== '' ? ` · ${m.creditsPer10k}` : ''}`))];
    const reposIn = (list, id) => list?.find((b) => String(b.id) === String(id))?.repos;
    $('#pricing').replaceChildren(
      h(
        'div',
        { class: 'grid' },
        field('Projection period (months)', num(['fusion', 'periodMonths'], { min: 1, max: 60, after: () => (renderPricing(), schedulePrice()) })),
        field('If cadences disagree', seg(['fusion', 'combine'], [['higher', 'Higher wins'], ['frequency', 'Frequency'], ['criticality', 'Criticality']], schedulePrice)),
        field('Extra credits on top (%)', num(['totals', 'extraPercent'], { max: 500, after: schedulePrice })),
        field('Credits per bundle', num(['totals', 'bundleCredits'], { min: 1, after: schedulePrice })),
      ),
      h('h3', { style: 'margin:22px 0 8px;font-size:14px' }, 'Fusion models'),
      h(
        'table',
        null,
        h('thead', null, h('tr', null, h('th', null, 'Model'), h('th', { class: 'n' }, 'Credits per 10K LOC'), h('th', { class: 'n' }, 'Default'), h('th', null, ''))),
        h(
          'tbody',
          null,
          f.models.map((m, i) =>
            h(
              'tr',
              null,
              h('td', null, h('input', { type: 'text', value: m.name || '', placeholder: 'e.g. haiku', oninput: (e) => (set(['fusion', 'models', i, 'name'], e.target.value), schedulePrice()) })),
              h('td', { class: 'n' }, h('input', { type: 'number', min: 0, step: 0.1, value: m.creditsPer10k ?? '', style: 'max-width:140px;margin-left:auto', oninput: (e) => (set(['fusion', 'models', i, 'creditsPer10k'], e.target.value === '' ? null : Number(e.target.value)), schedulePrice()) })),
              h('td', { class: 'n' }, h('input', { type: 'radio', name: 'default-model', checked: (f.defaultModel || f.models[0]?.id) === m.id, onchange: () => (set(['fusion', 'defaultModel'], m.id), schedulePrice()) })),
              h('td', { class: 'n' }, h('button', { type: 'button', class: 'sm danger', title: 'Remove model', onclick: () => (f.models.splice(i, 1), markDirty(), renderPricing(), schedulePrice()) }, icon('trash'))),
            ),
          ),
        ),
      ),
      h('button', { type: 'button', class: 'sm', style: 'margin-top:10px', onclick: () => (f.models.push({ id: `model-${Date.now().toString(36)}`, name: '', creditsPer10k: null }), markDirty(), renderPricing()) }, icon('plus'), 'Add a model'),
      h(
        'div',
        { class: 'rules-grid', style: 'margin-top:22px' },
        h(
          'div',
          null,
          h('h3', { style: 'margin:0 0 8px;font-size:14px' }, 'Fusion scans by change frequency'),
          h(
            'table',
            null,
            h('thead', null, h('tr', null, h('th', null, 'Commits on the default branch'), S.report ? h('th', { class: 'n' }, 'Repos') : null, h('th', { class: 'n' }, `Scans / ${f.periodMonths || 12} mo`), h('th', null, 'Model'))),
            h(
              'tbody',
              null,
              S.frequencies.map((fr) => {
                const suggested = Math.max(1, Math.ceil((({ 'more-5-week': 52, '1-5-week': 26, '2-weeks': 12, month: 6, '2-months': 4, '3-months': 4, '6-months': 2, year: 1, rare: 1 })[fr.id] * (f.periodMonths || 12)) / 12));
                const own = f.byFrequency?.[fr.id]?.scans;
                return h(
                  'tr',
                  null,
                  h('td', null, fr.label, own === undefined || own === null ? h('span', { class: 'suggested' }, 'suggested') : null),
                  S.report ? h('td', { class: 'n muted' }, String(reposIn(S.report.byFrequency, fr.id) ?? 0)) : null,
                  h('td', { class: 'n' }, h('input', { type: 'number', min: 0, value: own ?? suggested, style: 'max-width:110px;margin-left:auto', oninput: (e) => (set(['fusion', 'byFrequency', fr.id], { ...(f.byFrequency?.[fr.id] || {}), scans: e.target.value === '' ? null : Number(e.target.value) }), schedulePrice()) })),
                  h('td', null, h('select', { 'aria-label': `Model for ${fr.label}`, onchange: (e) => (set(['fusion', 'byFrequency', fr.id], { ...(f.byFrequency?.[fr.id] || {}), model: e.target.value || null }), schedulePrice()) }, modelOptions(f.byFrequency?.[fr.id]?.model))),
                );
              }),
            ),
          ),
        ),
        h(
          'div',
          null,
          h('h3', { style: 'margin:0 0 8px;font-size:14px' }, 'By criticality (optional)'),
          h(
            'table',
            null,
            h('thead', null, h('tr', null, h('th', null, 'Criticality'), h('th', { class: 'n' }, 'Scans'), h('th', null, 'Model'))),
            h(
              'tbody',
              null,
              S.criticalities.map((c) =>
                h(
                  'tr',
                  null,
                  h('td', null, `${c} ${c === 5 ? '(highest)' : c === 1 ? '(lowest)' : ''}`),
                  h('td', { class: 'n' }, h('input', { type: 'number', min: 0, placeholder: '—', title: 'Empty: not used', value: f.byCriticality?.[c]?.scans ?? '', style: 'max-width:100px;margin-left:auto', oninput: (e) => (set(['fusion', 'byCriticality', c], { ...(f.byCriticality?.[c] || {}), scans: e.target.value === '' ? null : Number(e.target.value) }), schedulePrice()) })),
                  h('td', null, h('select', { onchange: (e) => (set(['fusion', 'byCriticality', c], { ...(f.byCriticality?.[c] || {}), model: e.target.value || null }), schedulePrice()) }, modelOptions(f.byCriticality?.[c]?.model))),
                ),
              ),
            ),
          ),
          h('small', { class: 'muted' }, 'Criticality comes from repository rules below. Which model a repository gets: the one its rule pins, else its change frequency’s (its criticality’s first when criticality wins), else the default model.'),
        ),
      ),
    );
  }
  function renderOverrides() {
    cfg.overrides ||= {};
    const entries = Object.entries(cfg.overrides);
    const rename = (oldKey, newKey) => {
      const next = {};
      for (const [k, v] of Object.entries(cfg.overrides)) next[k === oldKey ? newKey : k] = v;
      cfg.overrides = next;
      markDirty();
    };
    $('#overrides').replaceChildren(
      entries.length
        ? h(
            'table',
            null,
            h('thead', null, h('tr', null, h('th', null, 'Repository or pattern'), h('th', null, 'Criticality'), h('th', { class: 'n' }, 'Scans'), h('th', null, 'Model'), h('th', null, 'Skip'), h('th', null, ''))),
            h(
              'tbody',
              null,
              entries.map(([pattern, o]) =>
                h(
                  'tr',
                  null,
                  h('td', null, h('input', { type: 'text', value: pattern, onchange: (e) => e.target.value.trim() && rename(pattern, e.target.value.trim()) })),
                  h('td', null, h('select', { onchange: (e) => ((o.criticality = e.target.value ? Number(e.target.value) : undefined), markDirty(), schedulePrice()) }, h('option', { value: '' }, '—'), [5, 4, 3, 2, 1].map((c) => h('option', { value: c, selected: o.criticality === c }, String(c))))),
                  h('td', { class: 'n' }, h('input', { type: 'number', min: 0, value: o.scans ?? '', placeholder: 'auto', style: 'max-width:90px;margin-left:auto', oninput: (e) => ((o.scans = e.target.value === '' ? undefined : Number(e.target.value)), markDirty(), schedulePrice()) })),
                  h('td', null, h('select', { onchange: (e) => ((o.model = e.target.value || undefined), markDirty(), schedulePrice()) }, h('option', { value: '' }, '(default)'), (cfg.fusion.models || []).map((m) => h('option', { value: m.id, selected: o.model === m.id }, m.name || m.id)))),
                  h('td', null, h('input', { type: 'checkbox', checked: Boolean(o.exclude), onchange: (e) => ((o.exclude = e.target.checked || undefined), markDirty(), schedulePrice()) })),
                  h('td', { class: 'n' }, h('button', { type: 'button', class: 'sm danger', onclick: () => (delete cfg.overrides[pattern], markDirty(), renderOverrides(), schedulePrice()) }, icon('trash'))),
                ),
              ),
            ),
          )
        : h('p', { class: 'muted', style: 'margin:0 0 10px' }, 'No rules: every repository follows its change frequency.'),
      h('button', { type: 'button', class: 'sm', style: 'margin-top:10px', onclick: () => ((cfg.overrides[`org/repo-${entries.length + 1}`] = { criticality: 5 }), markDirty(), renderOverrides()) }, icon('plus'), 'Add a rule'),
    );
  }

  // ---------- the plan column ----------
  const allSignedIn = () => cfg.connections.length > 0 && cfg.connections.every((c) => status[c.name]?.state === 'ok');
  function renderPlan() {
    if (!cfg) return;
    const box = $('#plan');
    const running = S.scan?.running;
    const okConn = cfg.connections.filter((c) => status[c.name]?.state === 'ok').length;
    const checking = cfg.connections.some((c) => status[c.name]?.state === 'checking');
    const priced = (cfg.fusion.models || []).some((m) => Number(m.creditsPer10k) > 0);
    const limit = h('input', { type: 'number', min: 0, placeholder: 'all', id: 'limit', style: 'max-width:110px' });
    box.replaceChildren(
      h('div', { class: 'eyebrow' }, 'Ready check'),
      h('div', { class: `check${allSignedIn() ? ' ok' : ''}` }, h('i', null, allSignedIn() ? '✓' : '1'), checking ? 'Checking sign-in…' : `${okConn} of ${cfg.connections.length} connection${cfg.connections.length === 1 ? '' : 's'} signed in`),
      h('div', { class: `check${priced ? ' ok' : ''}` }, h('i', null, priced ? '✓' : '2'), priced ? 'Fusion pricing set' : 'Set credits per 10K LOC'),
      h('div', { class: `check${!dirty && S.configExists ? ' ok' : ''}` }, h('i', null, !dirty && S.configExists ? '✓' : '3'), !dirty && S.configExists ? 'Settings saved' : dirty ? 'Unsaved changes (saved when you scan)' : 'Using the defaults (saved when you scan)'),
      h(
        'div',
        { style: 'display:grid;gap:10px;margin-top:14px' },
        running
          ? h('button', { type: 'button', class: 'big danger', onclick: () => api('/api/scan/stop', {}).then(() => toast('Stopping after the repositories in progress…')) }, icon('stop'), 'Stop the scan')
          : h('button', { type: 'button', class: 'golden big', disabled: !allSignedIn(), title: allSignedIn() ? '' : 'Sign in every connection first', onclick: () => startScan(Number($('#limit')?.value) || 0) }, icon('play'), 'Run the Fusion scan'),
        running ? null : h('label', { class: 'row muted', style: 'font-size:12.5px;justify-content:center' }, 'Try with the first', limit, 'repositories'),
      ),
    );
    renderProgress();
  }
  function renderProgress() {
    const box = $('#progress');
    const j = S.scan;
    if (!j) return (box.hidden = true);
    box.hidden = false;
    const pct = j.total ? Math.floor((j.done / j.total) * 100) : j.running ? 0 : 100;
    const problems = (j.log || []).filter((l) => /^\s*✗/.test(l));
    box.replaceChildren(...[
      h('div', { class: 'eyebrow' }, j.running ? 'Scanning' : j.error ? 'Scan stopped' : 'Scan complete'),
      h('div', { class: 'row', style: 'justify-content:space-between;margin:10px 0 8px' }, h('div', { class: 'big-figure', style: 'font-size:30px' }, `${pct}%`), h('div', { class: 'unit' }, `${fmt(j.done)} / ${fmt(j.total)} repositories`)),
      h('div', { class: 'bar' }, h('span', { style: `width:${pct}%` })),
      j.running ? h('div', { class: 'unit', style: 'margin-top:8px' }, h('span', { class: 'spin' }), ` ${j.current || 'discovering repositories…'}${j.phase ? ` · ${j.phase}` : ''}`) : null,
      j.error ? h('div', { class: 'bad', style: 'margin-top:8px' }, j.error) : null,
      !j.running && problems.length ? h('div', { class: 'warn-box' }, `${problems.length} problem${problems.length === 1 ? '' : 's'} while listing or measuring:`, h('ul', null, problems.slice(0, 5).map((l) => h('li', null, l.replace(/^\s*✗\s*/, ''))))) : null,
      h('details', { class: 'more', style: 'margin-top:10px', open: j.running }, h('summary', null, 'Activity'), h('div', { class: 'log', id: 'log' }, (j.log || []).join('\n'))),
    ].filter(Boolean));
    const log = $('#log');
    if (log) log.scrollTop = log.scrollHeight;
  }
  let priceTimer;
  function schedulePrice() {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(async () => {
      if (!S.report) return renderEstimate(null);
      try {
        const r = await api('/api/price', { fusion: cfg.fusion, totals: cfg.totals, overrides: cfg.overrides || {} });
        renderEstimate(r.report);
      } catch {}
    }, 250);
  }
  function countTo(el, to, digits) {
    if (still || !isFinite(to)) return (el.textContent = fmt(to, digits));
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e, p < 1 ? 0 : digits);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function renderEstimate(rep) {
    const box = $('#estimate');
    if (!rep) {
      box.replaceChildren(h('div', { class: 'eyebrow' }, 'Live estimate'), h('p', { class: 'muted', style: 'margin:10px 0 0' }, 'Run a scan: the credits appear here and follow every pricing change instantly.'));
      return;
    }
    const known = rep.credits?.known;
    const fig = h('div', { class: 'big-figure', 'data-v': box.querySelector('.big-figure')?.dataset.v || 0 }, '0');
    const max = Math.max(1, ...rep.byFrequency.map((b) => b.scans));
    box.replaceChildren(
      h('div', { class: 'eyebrow' }, 'Live estimate'),
      h('div', { style: 'margin:12px 0 2px' }, fig),
      h('div', { class: 'unit' }, known ? `Fusion credits · ${rep.periodMonths} months · ${fmt(rep.credits.bundles)} bundle${rep.credits.bundles === 1 ? '' : 's'}` : '10K-unit scans · set a model rate to price'),
      h('div', { class: 'tiles', style: 'margin-top:14px' }, h('div', { class: 'tile' }, h('span', null, 'Repositories'), h('b', null, fmt(rep.counts.measured))), h('div', { class: 'tile' }, h('span', null, 'Lines of code'), h('b', null, fmt(rep.totals.lines))), h('div', { class: 'tile' }, h('span', null, 'Fusion scans'), h('b', null, fmt(rep.totals.scans))), h('div', { class: 'tile' }, h('span', null, 'Commits'), h('b', null, fmt(rep.totals.commits))), h('div', { class: 'tile', style: 'grid-column:1/-1', title: 'Unique across repositories, bots excluded' }, h('span', null, 'Contributing developers · last 90 days'), h('b', null, fmt(rep.developers?.total)))),
      h(
        'div',
        { class: 'mini', style: 'margin-top:14px' },
        rep.byFrequency.filter((b) => b.repos).map((b) => [h('span', null, b.label), h('span', { class: 'muted' }, `${fmt(b.repos)} repos · ${fmt(b.scans)} scans`), h('div', { class: 'bar' }, h('span', { style: `width:${((b.scans / max) * 100).toFixed(1)}%` }))]),
      ),
      h(
        'div',
        { class: 'row', style: 'margin-top:16px' },
        h('a', { class: 'btn primary', href: `/report?k=${boot.key}`, target: '_blank', rel: 'noopener' }, icon('report'), 'Open the full report'),
        h('a', { class: 'btn sm', href: `/report.csv?k=${boot.key}` }, icon('download'), 'CSV'),
        h('a', { class: 'btn sm', href: `/report.json?k=${boot.key}` }, 'JSON'),
        h('a', { class: 'btn sm', href: `/report.md?k=${boot.key}` }, 'Markdown'),
      ),
      h('div', { class: 'unit', style: 'margin-top:10px' }, `Measured ${new Date(rep.generatedAt).toLocaleString()} · cloc-fusion ${rep.version}${rep.partial ? ' · partial' : ''}`),
    );
    countTo(fig, known ? rep.credits.total : rep.totals.unitScans, known && rep.credits.total < 100 ? 1 : 0);
  }

  // ---------- actions ----------
  async function save() {
    try {
      S = await api('/api/config', { config: cfg });
      cfg = clone(S.config);
      markSaved();
      renderAll();
      toast('Settings saved');
      return true;
    } catch (err) {
      toast(err.message, true);
      return false;
    }
  }
  const ensureSaved = async () => (dirty || !S.configExists ? save() : true);
  async function reloadState() {
    S = await api('/api/state');
    if (!dirty) cfg = clone(S.config);
  }
  async function checkOne(name) {
    status[name] = { state: 'checking' };
    renderConnections();
    try {
      const conn = cfg.connections.find((c) => c.name === name);
      const r = await api('/api/connection/test', { connection: conn });
      status[name] = r.ok ? { state: 'ok', who: r.who, orgs: r.orgs } : { state: 'bad', error: r.error };
    } catch (err) {
      status[name] = { state: 'bad', error: err.message };
    }
    renderConnections();
  }
  async function checkAll() {
    for (const c of cfg.connections) status[c.name] = { state: 'checking' };
    renderConnections();
    try {
      const r = await api('/api/connection/status', {});
      for (const [name, v] of Object.entries(r)) status[name] = v.ok ? { state: 'ok', who: v.who, orgs: v.orgs } : { state: 'bad', error: v.error };
    } catch (err) {
      toast(err.message, true);
    }
    renderConnections();
  }
  async function startScan(limit) {
    if (!(await ensureSaved())) return;
    try {
      await api('/api/scan', { limit });
      S.scan = { running: true, done: 0, total: 0, log: [], current: '', phase: 'discovering' };
      renderPlan();
      $('#progress').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    } catch (err) {
      toast(err.message, true);
    }
  }
  function events() {
    const es = new EventSource(`/api/events?k=${boot.key}`);
    es.addEventListener('progress', (e) => {
      Object.assign((S.scan ||= { log: [] }), JSON.parse(e.data), { running: true });
      renderProgress();
    });
    es.addEventListener('log', (e) => {
      (S.scan ||= { log: [] }).log.push(JSON.parse(e.data).line);
      if (S.scan.log.length > 400) S.scan.log.splice(0, 200);
      const log = $('#log');
      if (log) {
        log.append(D.createTextNode(`\n${JSON.parse(e.data).line}`));
        log.scrollTop = log.scrollHeight;
      }
    });
    es.addEventListener('done', (e) => {
      const { summary } = JSON.parse(e.data);
      Object.assign(S.scan, { running: false });
      S.report = summary;
      renderPlan();
      renderEstimate(summary);
      toast('Scan complete: the report is ready');
    });
    es.addEventListener('failed', (e) => {
      Object.assign(S.scan, { running: false, error: JSON.parse(e.data).error });
      renderPlan();
      toast(JSON.parse(e.data).error, true);
    });
    es.addEventListener('auth', async (e) => {
      const a = JSON.parse(e.data);
      auth[a.connection] = a;
      if (a.status === 'code' && a.verificationUri && /^https:\/\//.test(a.verificationUri) && !a.opened) {
        a.opened = true;
      }
      if (a.status === 'done') {
        await reloadState();
        status[a.connection] = { state: 'ok', who: a.who, orgs: a.orgs || [] };
        delete auth[a.connection];
        toast(`Signed in as ${a.who}`);
        renderAll();
        return;
      }
      if (a.status === 'error') status[a.connection] = { state: 'bad', error: a.error };
      renderConnections();
    });
  }

  // ---------- look ----------
  function setTheme(t) {
    if (t === 'auto') D.documentElement.removeAttribute('data-theme');
    else D.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('cf-theme', t);
    } catch {}
  }
  function setAccent(a) {
    D.documentElement.setAttribute('data-accent', a);
    try {
      localStorage.setItem('cf-accent', a);
    } catch {}
  }
  function renderLook() {
    const pop = $('#look-pop');
    let theme = 'dark';
    let accent = 'indigo';
    try {
      theme = localStorage.getItem('cf-theme') || 'dark';
      accent = localStorage.getItem('cf-accent') || 'indigo';
    } catch {}
    const themes = [['auto', 'Auto'], ['light', 'Daylight'], ['dark', 'Obsidian']];
    const accents = [['indigo', '#6366f1', '#06b6d4'], ['cyan', '#06b6d4', '#6366f1'], ['emerald', '#10b981', '#06b6d4'], ['violet', '#8b5cf6', '#6366f1'], ['amber', '#f59e0b', '#f43f5e']];
    pop.replaceChildren(
      h('div', { class: 'field' }, h('span', null, 'Theme'), h('div', { class: 'seg' }, themes.map(([v, l]) => h('button', { type: 'button', class: v === theme ? 'on' : '', onclick: () => (setTheme(v), renderLook()) }, l)))),
      h('div', { class: 'field' }, h('span', null, 'Accent'), h('div', { class: 'swatches' }, accents.map(([v, a, b]) => h('button', { type: 'button', class: v === accent ? 'on' : '', title: v, 'aria-label': v, style: `--a:${a};--b:${b}`, onclick: () => (setAccent(v), renderLook()) })))),
    );
  }

  function renderAll() {
    renderConnections();
    renderSettings();
    renderPricing();
    renderOverrides();
    renderPlan();
  }

  (async function init() {
    try {
      S = await api('/api/state');
    } catch (err) {
      $('#connections').replaceChildren(h('p', { class: 'bad' }, `Could not reach cloc-fusion: ${err.message}. Is it still running?`));
      return;
    }
    cfg = clone(S.config);
    $('#version').textContent = `v${S.version}`;
    $('#path').textContent = S.configFile.split(/[\\/]/).slice(-2).join('/');
    $('#path').title = S.configFile;
    $('#out').textContent = `Reports: ${S.outDir}`;
    markSaved();
    renderLook();
    renderAll();
    renderEstimate(S.report);
    if (S.report) schedulePrice();
    events();
    checkAll();
    $('#save').addEventListener('click', save);
    $('#check').addEventListener('click', checkAll);
    // Settings downloaded from a report's "Tune the plan" (or another configuration file): its
    // Fusion pricing, totals and repository rules replace these; connections stay as they are.
    $('#import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        if (file.size > 1048576) throw new Error('that file is too big for settings');
        const data = JSON.parse(await file.text());
        if (!data || typeof data !== 'object' || !(data.fusion || data.totals || data.overrides)) throw new Error('no Fusion settings in that file');
        if (data.fusion && typeof data.fusion === 'object') cfg.fusion = { ...cfg.fusion, ...data.fusion };
        if (data.totals && typeof data.totals === 'object') cfg.totals = { ...cfg.totals, ...data.totals };
        if (data.overrides && typeof data.overrides === 'object') cfg.overrides = { ...(cfg.overrides || {}), ...data.overrides };
        markDirty();
        renderAll();
        schedulePrice();
        toast('Settings imported: check them, then save');
      } catch (err) {
        toast(`Could not import: ${err.message}`, true);
      }
    });
    addEventListener('beforeunload', (e) => {
      if (dirty) e.preventDefault();
    });
    addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    });
  })();
}

export function uiPage({ key, version }) {
  return `<!doctype html>
<html lang="en" data-theme="dark" data-accent="indigo">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>cloc-fusion · Fusion planner</title>
<script>try{var d=document.documentElement,t=localStorage.getItem('cf-theme'),a=localStorage.getItem('cf-accent');if(t==='auto')d.removeAttribute('data-theme');else if(t==='light')d.setAttribute('data-theme','light');if(/^(indigo|cyan|emerald|violet|amber)$/.test(a||''))d.setAttribute('data-accent',a)}catch(e){}</script>
<style>${NEXTGEN_CSS}${UI_CSS}</style>
</head>
<body>
<div class="aurora" aria-hidden="true"><i></i><i></i></div>
<header class="topbar"><div class="topbar-in">
<div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9"/><path d="M17 3v4.5h-4.5M7 21v-4.5h4.5"/></svg></span><span class="brand-name">cloc·<b>fusion</b></span></div>
<span class="chip" id="version">v${String(version).replace(/[^\w.-]/g, '')}</span>
<span class="chip path" id="path"></span>
<span class="chip" id="save-state">Loading…</span>
<span class="spacer"></span>
<button type="button" id="import" class="sm" title="Use the models and choices saved from a report (Download settings)">Import settings</button><input type="file" id="import-file" accept=".json,application/json" hidden>
<button type="button" id="check" class="sm" title="Check every sign-in again">Check sign-in</button>
<button type="button" id="save" class="primary sm" title="Save settings (Ctrl+S)">Save settings</button>
<details class="look"><summary class="btn icon-btn sm" title="Theme and accent" aria-label="Theme and accent"><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/></svg></summary><div class="look-pop" id="look-pop"></div></details>
</div></header>
<main class="wrap">
<div>
<section class="glass hero">
<div class="eyebrow">Fusion planner</div>
<h1>Size every repository for <span class="grad">Fusion</span>, from one page</h1>
<p>Sign in to your Git platforms, check the settings, and run the scan. cloc-fusion counts the code and the commits of every repository, gives each one its Fusion cadence, and works out the credits.</p>
</section>
<section class="glass card"><div class="card-h"><span class="step">1</span><h2>Connections</h2></div><p class="lede">Every connection must be signed in before a scan. Sign in through your browser; tokens never go into the settings file.</p><div id="connections"></div></section>
<section class="glass card"><div class="card-h"><span class="step">2</span><h2>Fusion pricing</h2></div><p class="lede">Credits = 10K units of code × Fusion scans × the model's credits per 10K LOC. The live estimate follows every change.</p><div id="pricing"></div></section>
<section class="glass card"><div class="card-h"><span class="step">3</span><h2>Scan settings</h2></div><p class="lede">What counts as code, and how far back to look at commits.</p><div id="settings"></div></section>
<section class="glass card"><div class="card-h"><span class="step">4</span><h2>Repository rules</h2></div><p class="lede">Raise the cadence of critical repositories, pin a model, or skip some. Patterns like <code>acme/payments-*</code> work.</p><div id="overrides"></div></section>
</div>
<aside class="side">
<section class="glass plan" id="plan"></section>
<section class="glass plan" id="progress" hidden></section>
<section class="glass plan" id="estimate"></section>
</aside>
<footer><span id="out"></span><span>Runs on this computer only · nothing leaves it except calls to your Git platforms</span></footer>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>(${clientApp.toString()})(${JSON.stringify({ key, version }).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
}

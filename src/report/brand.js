// The Checkmarx brand layer for the standalone page and the HTML report: the Checkmarx logo in
// place of the wordmark, Founders Grotesk (embedded when the licensed files are supplied, see
// assets/fonts/founders-grotesk), and a calm, solid look: one brand colour, no gradients, glows,
// aurora or shimmer. It goes after the theme's CSS and overrides it.
import { BRAND_FONT_FACES } from './brand-fonts.js';

/** The Checkmarx logo (assets/brand/checkmarx-logo.svg), drawn in the current text colour. */
export const CHECKMARX_LOGO = `<svg class="cx-logo" viewBox="0 0 138.95 18" role="img" aria-label="Checkmarx" fill="currentColor"><path d="M137.44,1.18c.45.02.87.23,1.16.58.26.31.38.71.35,1.12-.03.4-.21.77-.49,1.05l-7.71,7.13c-.06.07-.1.17-.1.27s.04.2.11.28l4.21,3.63c.32.31.49.73.5,1.17,0,.46-.17.87-.49,1.17-.15.14-.32.25-.51.32-.18.07-.38.11-.57.11s-.41-.04-.6-.12c-.2-.08-.37-.2-.53-.35l-.02-.02-3.67-4.25c-.14-.13-.4-.13-.55.01l-3.66,4.25c-.16.16-.34.28-.54.36-.37.15-.8.15-1.17,0-.19-.07-.36-.18-.51-.32-.32-.3-.5-.71-.49-1.17,0-.43.18-.86.49-1.16l.02-.02,4.21-3.63c.06-.06.1-.16.1-.27s-.04-.2-.11-.28l-4.21-3.63c-.29-.29-.47-.67-.5-1.06-.03-.41.09-.81.35-1.12.29-.35.71-.56,1.16-.58.45-.02.88.15,1.2.46l.02.02,3.67,4.25c.14.13.41.13.55-.02l7.13-7.72c.31-.31.72-.48,1.14-.48h.07v.02Z"/><path d="M6.31.81c3.94,0,5.84,2.13,6,6.6h-3.25c-.12-2.47-.97-3.61-2.75-3.61-2.09,0-2.92,1.54-2.92,5.58s.78,5.58,2.92,5.58c1.83,0,2.66-1.02,2.8-3.66h3.3c-.19,4.51-2.16,6.64-6.1,6.64C1.92,17.94,0,15.33,0,9.38S1.92.81,6.31.81Z"/><path fill-rule="evenodd" d="M35.23,4.84c4.06,0,5.93,2.18,5.48,7.03h-8.31c.12,2.47,1,3.51,2.85,3.51,1.35,0,2.25-.55,2.47-1.66h2.94c-.28,2.59-2.25,4.08-5.51,4.08-3.87,0-5.91-2.11-5.91-6.48s2.07-6.48,5.98-6.48h.01ZM35.23,7.22c-1.59,0-2.47.83-2.75,2.63h5.29c-.05-1.71-.88-2.63-2.54-2.63Z"/><path fill-rule="evenodd" d="M99.62,4.84c3.42,0,5.06,1.47,5.06,4.51v8.21h-2.47l-.31-1.28h-.69l-.69.69c-.57.57-1.47.83-2.68.83-2.68,0-4.11-1.28-4.11-3.61,0-2.47,1.64-3.77,4.49-3.77h3.25v-.93c0-1.54-.69-2.18-2.11-2.18-1.21,0-2.07.48-2.16,1.64h-2.9c.09-2.59,1.9-4.1,5.32-4.1h0ZM99.03,12.27c-1.35,0-2.04.57-2.04,1.61,0,.92.55,1.52,1.92,1.52,1.64,0,2.56-.85,2.56-2.35v-.78h-2.45.01Z"/><path d="M49.51,4.84c3.56,0,5.44,1.76,5.53,5.01h-3.11c-.14-1.59-.95-2.3-2.42-2.3-1.83,0-2.64,1.09-2.64,3.77s.81,3.77,2.64,3.77c1.49,0,2.33-.71,2.45-2.45h3.16c-.09,3.37-2.02,5.15-5.6,5.15-3.9,0-5.94-2.11-5.94-6.48s2.04-6.48,5.93-6.48h0Z"/><path d="M61.61,9.47h1.45l3.28-4.39h3.66l-4.25,5.82,4.39,6.67h-3.77l-3.35-5.24h-1.4v5.25h-3.2V0h3.2v9.47h-.01Z"/><path d="M87.23,4.84c2.73,0,4.06,1.4,4.06,4.22v8.5h-3.2v-7.64c0-1.54-.67-2.23-2.09-2.23-1.51,0-2.27.75-2.28,2.21l-.03-.03v7.69h-3.2v-7.64c0-1.54-.66-2.23-2.09-2.23-1.52,0-2.28.76-2.28,2.23v7.64h-3.21V5.08h2.37l.33,1.28h.69l.69-.69c.59-.59,1.5-.83,2.63-.83,1.64,0,2.77.51,3.42,1.52h.86l.69-.69c.59-.59,1.5-.83,2.63-.83h0Z"/><path d="M18.47,4.15l-.28,2.04.66.17.69-.69c.59-.59,1.43-.83,2.54-.83,2.68,0,3.96,1.4,3.96,4.22v8.5h-3.2v-7.64c0-1.54-.67-2.23-2.09-2.23-1.52,0-2.28.76-2.28,2.23v7.64h-3.2V0h3.2s0,4.15,0,4.15Z"/><path d="M119.88,7.71h-3.16c-1.52,0-2.3.74-2.3,2.09v5.06h3.99v2.7h-10.63v-2.7h3.44v-7.1h-3.04v-2.68h5.34l.31,1.28h.71l.69-.69c.57-.59,1.47-.83,2.64-.83h2.02v2.87h0Z"/></svg>`;

const faces = BRAND_FONT_FACES.map((f) => `@font-face{font-family:"Founders Grotesk";font-style:normal;font-weight:${f.weight};font-display:swap;src:url(data:${f.mime};base64,${f.data}) format("${f.format}")}`).join('\n');
// Installed copies, under the names the font's files use.
const local = [400, 500, 600, 700]
  .filter((w) => !BRAND_FONT_FACES.some((f) => f.weight === w))
  .map((w) => {
    const name = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }[w];
    return `@font-face{font-family:"Founders Grotesk";font-style:normal;font-weight:${w};font-display:swap;src:local("Founders Grotesk ${name}"),local("FoundersGrotesk-${name}"),local("Founders Grotesk")}`;
  })
  .join('\n');

export const BRAND_CSS = `${faces}
${local}
:root,:root[data-accent]{--ng-from:#6c4bf4;--ng-to:#6c4bf4;--ng-ink-light:#4f2fd6;--ng-ink-dark:#b5a3ff;--ng-glow:transparent;--ng-solid:#5532e6;
--ng-ambient-1:transparent;--ng-ambient-2:transparent;--ng-ambient-3:transparent;--ng-wordmark:linear-gradient(var(--text),var(--text));
--font:"Founders Grotesk","CF Jakarta",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
--mono:var(--font)}
body{font-variant-numeric:tabular-nums}
.log,code{font-family:"CF Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
:root[data-theme="dark"]{--bg:#0a0b14;--surface:#12131f;--surface-2:#171827;--surface-3:#1f2032;--ng-glass:#12131f;--ng-glass-line:rgb(255 255 255/.08)}
:root:not([data-theme="dark"]){--ng-glass:#fff}
body{background-image:none!important}
.aurora,.hero::before,.hero::after,.eyebrow::before,.brand-mark::after,.tune::after{display:none!important}
.glass,.tile,.tune-kpi{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.grad,.hero h1 .grad{background:none!important;color:var(--accent)!important;-webkit-text-fill-color:currentColor;animation:none!important}
.eyebrow{color:var(--ng-head);letter-spacing:.12em}
h1,h2,h3,.hero h1{letter-spacing:-.01em}
.hero h1{font-weight:600}
button.golden{color:#fff!important;border-color:transparent!important;background:var(--ng-solid)!important;box-shadow:none!important;animation:none!important;filter:none}
button.golden:hover:not(:disabled){filter:brightness(1.08)}
button.golden:disabled{background:color-mix(in srgb,var(--text) 18%,transparent)!important;color:var(--muted)!important}
button.primary,.btn.primary{background:var(--ng-solid)!important;box-shadow:none!important}
button:hover:not(:disabled),.btn:hover{box-shadow:none!important;transform:none!important}
.status::before,.check.ok i,.card-h .step,.badge,.toggle input:checked,.tag,.pill.glow,.tile:hover,.method:hover,.conn.ok{box-shadow:none!important}
.card-h .step,.card-h .step.ok,.check.ok i{background:var(--ng-solid)!important}
.in .step.done .step-dot,body:not(.pre) .step.done .step-dot{background:var(--ng-solid)!important;box-shadow:none!important}
.tile:hover,.method:hover{transform:none!important}
.tile::before{opacity:1;height:2px;background:var(--ng-from)}
.tune-kpi.gold b{color:var(--text);text-shadow:none}
.ring .val{filter:none!important}
.cad-bar span,.lang-bar span,.bar span{box-shadow:none!important}
.brand{gap:12px}
.cx-logo{display:block;height:17px;width:auto;color:var(--text)}
.brand-sep{width:1px;height:18px;background:var(--border-strong)}
.brand-product{font-weight:500;font-size:14px;color:var(--muted);letter-spacing:0}
.look fieldset:has(.swatches){display:none}
`;

/** The topbar's brand: the Checkmarx logo. */
export const BRAND_MARK = CHECKMARX_LOGO;

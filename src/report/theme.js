// The next-gen look, from the CxMissionZero / Cx Detection Date Base Reminder app (public/nextgen.css,
// public/look.js): Obsidian (dark) and Daylight (light), glass panels over an ambient glow, the
// accent's indigo → cyan gradient, Plus Jakarta Sans and JetBrains Mono. Same tokens, same accents,
// so a cloc-fusion report sits next to the app's own reports as one family.

/** For each accent: text colour on light, on dark, then the gradient's two ends (look.js). */
export const NEXTGEN_ACCENTS = {
  indigo: ['#4f46e5', '#a5b4fc', '#6366f1', '#06b6d4'],
  cyan: ['#0e7490', '#67e8f9', '#06b6d4', '#6366f1'],
  emerald: ['#047857', '#6ee7b7', '#10b981', '#06b6d4'],
  violet: ['#6d28d9', '#c4b5fd', '#8b5cf6', '#6366f1'],
  amber: ['#b45309', '#fcd34d', '#f59e0b', '#f43f5e'],
};


const accentRules = Object.entries(NEXTGEN_ACCENTS)
  .filter(([name]) => name !== 'indigo')
  .map(([name, [inkL, inkD, from, to]]) => `:root[data-accent="${name}"]{--ng-ink-light:${inkL};--ng-ink-dark:${inkD};--ng-from:${from};--ng-to:${to};--ng-glow:${hexA(from, 0.35)}}`)
  .join('\n');

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

const DARK = `color-scheme:dark;--bg:#06080f;--surface:#0e1422;--surface-2:#121a2b;--surface-3:#1a2335;--border:#1d2638;--border-strong:#2a3449;--text:#e2e8f0;--muted:#94a3b8;--accent:var(--ng-ink-dark);--accent-soft:color-mix(in srgb,var(--ng-from) 16%,transparent);--danger:#fb7185;--ok:#34d399;--warn:#fbbf24;--shadow:0 8px 30px rgb(0 0 0/.35);--shadow-pop:0 0 0 1px rgb(255 255 255/.08),0 20px 48px -12px rgb(0 0 0/.7);--ng-glass:rgb(13 18 30/.72);--ng-glass-line:rgb(255 255 255/.07);--ng-ambient-1:rgb(79 70 229/.16);--ng-ambient-2:rgb(8 145 178/.13);--ng-ambient-3:rgb(5 150 105/.09);--ng-head:#7c8aa5;--ng-wordmark:linear-gradient(90deg,#fff,#cbd5e1 60%,#94a3b8)`;

/** The theme without its embedded fonts (the branded page and report use the system font). */
export const THEME_CSS = `:root{--ng-ink-light:#4f46e5;--ng-ink-dark:#a5b4fc;--ng-from:#6366f1;--ng-to:#06b6d4;--ng-glow:rgb(99 102 241/.35);
--ng-solid:linear-gradient(135deg,var(--ng-ink-light),color-mix(in srgb,var(--ng-to) 60%,#0b1020));
color-scheme:light;--bg:#f3f5fb;--surface:#fff;--surface-2:#f6f7fc;--surface-3:#eceff7;--border:#e2e6f0;--border-strong:#cbd2e1;--text:#0b1020;--muted:#5a6478;--accent:var(--ng-ink-light);--accent-soft:color-mix(in srgb,var(--ng-from) 9%,transparent);--danger:#e11d48;--ok:#059669;--warn:#b45309;
--shadow:0 1px 2px rgb(15 23 42/.04),0 8px 24px -16px rgb(15 23 42/.18);--shadow-pop:0 0 0 1px rgb(15 23 42/.06),0 18px 40px -16px rgb(15 23 42/.28);
--font:"CF Jakarta",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:"CF Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
--ng-glass:rgb(255 255 255/.78);--ng-glass-line:rgb(15 23 42/.08);--ng-ambient-1:rgb(99 102 241/.12);--ng-ambient-2:rgb(6 182 212/.10);--ng-ambient-3:rgb(16 185 129/.07);--ng-head:#64748b;--ng-wordmark:linear-gradient(90deg,var(--text),var(--text));
--ease:cubic-bezier(.22,1,.36,1)}
:root[data-theme="dark"]{${DARK}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}
${accentRules}`;

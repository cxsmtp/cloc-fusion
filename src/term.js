// The terminal in the next-gen look: the accent's indigo → cyan gradient for the banner and the
// progress bar, green ticks, soft greys. Colour only on a terminal, and never with NO_COLOR set
// (https://no-color.org); FORCE_COLOR forces it.
import { VERSION } from './version.js';

const env = process.env;
export const useColor = (stream = process.stderr) => (env.FORCE_COLOR && env.FORCE_COLOR !== '0') || (!env.NO_COLOR && Boolean(stream.isTTY) && env.TERM !== 'dumb');
const truecolor = () => /truecolor|24bit/i.test(env.COLORTERM || '') || env.WT_SESSION || env.TERM_PROGRAM === 'vscode' || process.platform === 'win32';

const FROM = [99, 102, 241]; // indigo #6366f1
const TO = [6, 182, 212]; // cyan #06b6d4

const mix = (t) => FROM.map((a, i) => Math.round(a + (TO[i] - a) * t));
const rgb = ([r, g, b]) => (truecolor() ? `\x1b[38;2;${r};${g};${b}m` : `\x1b[38;5;${16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5)}m`);

/** A painter bound to a stream: plain text when colour is off. */
export function paint(stream = process.stderr) {
  const on = useColor(stream);
  const wrap = (open, close = '\x1b[0m') => (s) => (on ? `${open}${s}${close}` : String(s));
  return {
    on,
    bold: wrap('\x1b[1m', '\x1b[22m'),
    dim: wrap('\x1b[2m', '\x1b[22m'),
    green: wrap('\x1b[32m', '\x1b[39m'),
    red: wrap('\x1b[31m', '\x1b[39m'),
    yellow: wrap('\x1b[33m', '\x1b[39m'),
    accent: (s) => (on ? `${rgb(mix(0.4))}${s}\x1b[39m` : String(s)),
    /** Text in the indigo → cyan gradient, character by character. */
    gradient(s) {
      if (!on) return String(s);
      const chars = [...String(s)];
      return chars.map((c, i) => `${rgb(mix(chars.length > 1 ? i / (chars.length - 1) : 0))}${c}`).join('') + '\x1b[39m';
    },
    ok: on ? '\x1b[32m✓\x1b[39m' : '✓',
    fail: on ? '\x1b[31m✗\x1b[39m' : '✗',
  };
}

/** The banner: the name in the gradient, the version, and what is about to happen. */
export function banner(line = '', stream = process.stderr) {
  const p = paint(stream);
  return `\n  ${p.gradient('◆ cloc·fusion')} ${p.dim(`v${VERSION}`)}${line ? `  ${p.dim('·')}  ${line}` : ''}\n`;
}

/** A progress bar: done/total as a gradient bar, the percentage, and what is in hand. */
export function progressBar({ done, total, current = '', phase = '' }, width = 28, stream = process.stderr) {
  const p = paint(stream);
  const frac = total ? Math.min(1, done / total) : 1;
  const full = Math.round(frac * width);
  let bar = '';
  for (let i = 0; i < width; i++) bar += i < full ? (p.on ? `${rgb(mix(i / Math.max(1, width - 1)))}━` : '━') : p.on ? '\x1b[2m━\x1b[22m' : '·';
  if (p.on) bar += '\x1b[39m';
  const pct = `${String(Math.floor(frac * 100)).padStart(3)}%`;
  const what = current ? ` ${p.dim(`${current}${phase ? ` · ${phase}` : ''}`)}` : '';
  return `  ${bar} ${p.bold(pct)} ${p.dim(`${done}/${total}`)}${what}`;
}

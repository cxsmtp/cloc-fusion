// The version, in one place. package.json, CHANGELOG.md and the git tag (vX.Y.Z) must agree with
// it; test/version.test.js and scripts/release-check.mjs enforce that. The standalone executables
// also carry the build's commit and date and the whole changelog (injected by esbuild at build
// time), so any copy can say exactly what it is.
import { readFileSync } from 'node:fs';

export const VERSION = '1.2.0';

/* global __CLOC_FUSION_BUILD__, __CLOC_FUSION_CHANGELOG__ */
const injected = (name) => {
  try {
    return name === 'build' ? __CLOC_FUSION_BUILD__ : __CLOC_FUSION_CHANGELOG__;
  } catch {
    return undefined; // running from source: not injected
  }
};

/** Where this copy came from: { kind: 'executable' | 'source', commit, date }. */
export function buildInfo() {
  const b = injected('build');
  return b ? { kind: 'executable', ...b } : { kind: 'source', commit: null, date: null };
}

/** The changelog text: built into executables, read from the repository otherwise. */
export function changelogText() {
  const text = injected('changelog');
  if (text) return text;
  try {
    return readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  } catch {
    return '';
  }
}

/** The changelog's releases, newest first: [{ version, date, body }]. */
export function changelogReleases(text = changelogText()) {
  const out = [];
  const re = /^## \[(\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/gm;
  const heads = [...text.matchAll(re)];
  heads.forEach((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    out.push({ version: m[1], date: m[2] || null, body: text.slice(m.index + m[0].length, end).trim() });
  });
  return out;
}

/** -1, 0 or 1 comparing two x.y.z versions (a leading "v" is ignored). */
export function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

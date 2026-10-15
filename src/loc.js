// Counting lines like cloc: per file, code / comment / blank lines by the language's comment syntax.
// Quoted strings are skipped within a line (so a route like '/*' does not open a comment); strings
// spanning lines are not tracked, the usual approximation, which moves totals by well under 1%.
import { languageOf, isExcludedPath, globToRegExp } from './languages.js';

/** Count one file's text. Returns { code, comment, blank }. */
export function countText(text, lang) {
  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlock = null;
  const lineTokens = lang?.line || [];
  const blockTokens = lang?.block || [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) {
      blank++;
      continue;
    }
    let hasCode = false;
    let hasComment = false;
    let i = 0;
    outer: while (i < s.length) {
      if (inBlock) {
        hasComment = true;
        const j = s.indexOf(inBlock[1], i);
        if (j < 0) break;
        i = j + inBlock[1].length;
        inBlock = null;
        continue;
      }
      const ch = s.charCodeAt(i);
      if (ch === 32 || ch === 9) {
        i++;
        continue;
      }
      for (const t of lineTokens) {
        if (s.startsWith(t, i)) {
          hasComment = true;
          break outer;
        }
      }
      for (const b of blockTokens) {
        if (s.startsWith(b[0], i)) {
          inBlock = b;
          hasComment = true;
          i += b[0].length;
          continue outer;
        }
      }
      hasCode = true;
      if (ch === 34 || ch === 39 || ch === 96) {
        // Skip a quoted string to its closing quote on this line (backslash escapes honoured).
        let j = i + 1;
        while (j < s.length && s.charCodeAt(j) !== ch) j += s.charCodeAt(j) === 92 ? 2 : 1;
        i = j + 1;
        continue;
      }
      i++;
    }
    if (hasCode) code++;
    else if (hasComment) comment++;
    else blank++;
  }
  return { code, comment, blank };
}

const looksBinary = (buf) => buf.subarray(0, 8000).includes(0);

/**
 * Which tree entries to count: known languages, not excluded, not too big.
 * `entries` = [{ path, size, oid }]; returns [{ ...entry, lang }].
 */
export function selectFiles(entries, { exclude = [], include = [], maxFileBytes = 2 * 1024 * 1024 } = {}) {
  const ex = exclude.map(globToRegExp);
  const inc = include.map(globToRegExp);
  const out = [];
  for (const e of entries) {
    if (isExcludedPath(e.path)) continue;
    if (ex.some((re) => re.test(e.path))) continue;
    if (inc.length && !inc.some((re) => re.test(e.path))) continue;
    if (e.size > maxFileBytes) continue;
    const lang = languageOf(e.path);
    if (!lang) continue;
    out.push({ ...e, lang });
  }
  return out;
}

/** Accumulates per-language and per-category totals as files are counted. */
export class LocTally {
  constructor() {
    this.languages = {};
    this.files = 0;
  }

  add(lang, buf) {
    if (looksBinary(buf)) return;
    const c = countText(buf.toString('utf8'), lang);
    const t = (this.languages[lang.name] ||= { category: lang.category, files: 0, code: 0, comment: 0, blank: 0 });
    t.files++;
    t.code += c.code;
    t.comment += c.comment;
    t.blank += c.blank;
    this.files++;
  }

  /** Totals for the languages whose category is counted, by basis (code | code+comments | all). */
  summary({ countCategories = ['code', 'markup', 'iac'], locBasis = 'code' } = {}) {
    const cats = new Set(countCategories);
    const byCategory = {};
    let loc = 0;
    let files = 0;
    let code = 0;
    let comment = 0;
    let blank = 0;
    for (const t of Object.values(this.languages)) {
      const bc = (byCategory[t.category] ||= { files: 0, code: 0, comment: 0, blank: 0 });
      bc.files += t.files;
      bc.code += t.code;
      bc.comment += t.comment;
      bc.blank += t.blank;
      if (!cats.has(t.category)) continue;
      files += t.files;
      code += t.code;
      comment += t.comment;
      blank += t.blank;
      loc += locBasis === 'all' ? t.code + t.comment + t.blank : locBasis === 'code+comments' ? t.code + t.comment : t.code;
    }
    const top = Object.entries(this.languages)
      .filter(([, t]) => cats.has(t.category))
      .sort((a, b) => b[1].code - a[1].code);
    return { loc, files, code, comment, blank, byCategory, languages: this.languages, mainLanguage: top[0]?.[0] ?? null };
  }
}

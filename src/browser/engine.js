// Measuring a repository from a web page (the standalone HTML): the same as the API engine
// (src/apiengine.js), on the browser's own streams and decompression. Lines of code come from the
// default branch's archive, read and counted in memory; commits come from the platform's API.
//
// When the platform does not let a page download its archives (GitHub's archive host may refuse
// cross-origin downloads), lines of code are estimated from the platform's per-language byte
// counts instead, and the repository is marked as estimated.
import { TarParser, stripTop, concatBytes } from '../tar.js';
import { makeSelector, LocTally } from '../loc.js';
import { statsFromCommits } from '../commits.js';
import { languageByName } from '../languages.js';

const DAY = 86400000;
/** Bytes of source per counted line, for the estimate (measured on real code: 45–55). */
export const BYTES_PER_LINE = 45;

const tooBig = (limit) => new Error(`the archive is larger than ${Math.round(limit / 1048576)} MB uncompressed (raise the limit, or use the cloc-fusion app)`);

/** Read a .tar.gz response body into the tar parser, bounded by `maxArchiveBytes` uncompressed. */
export async function readTarGzWeb(body, { onEntry, onFile, maxFileBytes, maxArchiveBytes, signal }) {
  const parser = new TarParser({ onEntry, onFile, maxFileBytes });
  const reader = body.pipeThrough(new DecompressionStream('gzip')).getReader();
  let seen = 0;
  try {
    for (;;) {
      if (signal?.aborted) throw new Error('stopped');
      const { value, done } = await reader.read();
      if (done) break;
      seen += value.length;
      if (seen > maxArchiveBytes) throw tooBig(maxArchiveBytes);
      parser.push(value);
      if (parser.done) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return { entries: parser.entries };
}

async function inflateRaw(bytes, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) {
      reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  return concatBytes(parts.length ? parts : [new Uint8Array(0)]);
}

/** Read a .zip held in memory (Azure DevOps). Same callbacks and limits as the CLI's reader. */
export async function readZipBytes(buf, { onEntry, onFile, maxFileBytes, maxArchiveBytes }) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const size = buf.length;
  let eocd = -1;
  for (let i = size - 22; i >= Math.max(0, size - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const count = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('zip64 archives are not supported here: use the cloc-fusion app for this repository');
  if (cdOffset + cdSize > size || count > 1000000) throw new Error('corrupt zip archive');
  const utf8 = new TextDecoder();
  const offsets = new Set();
  let p = cdOffset;
  let entries = 0;
  let inflated = 0;
  for (let n = 0; n < count && p + 46 <= cdOffset + cdSize; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = utf8.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    entries++;
    const e = { path: name, size: usize };
    if (usize > maxFileBytes || !onEntry(e)) continue;
    if (method !== 0 && method !== 8) continue;
    if (csize > maxFileBytes * 2 + 1024 || offsets.has(local)) continue;
    offsets.add(local);
    if (local + 30 > size || dv.getUint32(local, true) !== 0x04034b50) throw new Error('corrupt zip entry');
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    if (start + csize > size) throw new Error('corrupt zip entry');
    const data = buf.subarray(start, start + csize);
    const content = method === 0 ? data : await inflateRaw(data, maxFileBytes);
    if (!content) continue;
    inflated += content.length;
    if (inflated > maxArchiveBytes) throw tooBig(maxArchiveBytes);
    onFile(e, content);
  }
  return { entries };
}

async function readAll(body, limit, signal) {
  const reader = body.getReader();
  const parts = [];
  let n = 0;
  for (;;) {
    if (signal?.aborted) throw new Error('stopped');
    const { value, done } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) {
      reader.cancel().catch(() => {});
      throw tooBig(limit);
    }
    parts.push(value);
  }
  return concatBytes(parts.length ? parts : [new Uint8Array(0)]);
}

/** Lines of code estimated from GitHub's per-language bytes (when its archive can't be read here). */
export async function estimateFromLanguages(api, repo, { countCategories = ['code', 'markup', 'iac'] } = {}) {
  const bytes = (await api.get(`/repos/${repo.fullName}/languages`, { allow404: true })) || {};
  const cats = new Set(countCategories);
  const languages = Object.create(null);
  let loc = 0;
  let top = null;
  for (const [name, b] of Object.entries(bytes)) {
    const lang = languageByName(name);
    if (!lang || !Number.isFinite(b)) continue;
    const code = Math.round(b / BYTES_PER_LINE);
    const t = (languages[lang.name] ||= { category: lang.category, files: 0, code: 0, comment: 0, blank: 0 });
    t.code += code;
    if (!cats.has(lang.category)) continue;
    loc += code;
    if (!top || code > languages[top].code) top = lang.name;
  }
  return { loc, files: 0, code: loc, comment: 0, blank: 0, byCategory: {}, languages, mainLanguage: top };
}

/**
 * Measure one repository from the page. `session` is { provider, api }; options as the API engine's.
 * Returns the same shape as the CLI engines, plus `locEstimated` when lines are an estimate.
 */
export async function measureRepo(repo, { session, conn, windowDays = 365, includeMerges = false, exclude = [], include = [], maxFileBytes = 2 * 1024 * 1024, maxArchiveBytes = 1024 ** 3, countCategories, locBasis, now = Date.now(), signal, onPhase = () => {} }) {
  const { provider, api } = session;
  if (!provider.archive || !api) throw new Error(`${provider.label} is not supported in the standalone page`);
  if (!repo.defaultBranch) return { empty: true, commits: 0, authors: 0, windowDays, weekly: [], loc: 0, files: 0, code: 0, comment: 0, blank: 0, languages: {}, mainLanguage: null, engine: 'browser' };
  const since = new Date(now - windowDays * DAY).toISOString();

  onPhase('history');
  const history = await provider.commits(api, repo, since, conn);
  const stats = statsFromCommits(history.commits, { now, sinceT: Date.parse(since), includeMerges });
  stats.lastCommitAt ??= history.lastCommitAt ? new Date(history.lastCommitAt).toISOString() : null;
  let effectiveWindow = windowDays;
  if (repo.createdAt) {
    const age = (now - Date.parse(repo.createdAt)) / DAY;
    if (Number.isFinite(age) && age > 0) effectiveWindow = Math.min(windowDays, Math.max(1, age));
  }

  onPhase('files');
  const tally = new LocTally();
  let treeFiles = 0;
  const select = makeSelector({ exclude, include, maxFileBytes });
  const { url, format } = provider.archive(repo, conn);
  const onEntry = (e) => {
    treeFiles++;
    e.path = format === 'zip' ? e.path : stripTop(e.path);
    e.lang = select(e.path, e.size);
    return Boolean(e.lang);
  };
  const onFile = (e, content) => tally.add(e.lang, content);
  let sum;
  let locEstimated = false;
  try {
    if (session.archiveBlocked) throw new Error('could not reach the archive host');
    // A refused download fails the same way every time: one retry, not five.
    const res = await api.download(url, { retries: 1 });
    session.archiveTried = true;
    onPhase('count');
    if (format === 'zip') await readZipBytes(await readAll(res.body, maxArchiveBytes, signal), { onEntry, onFile, maxFileBytes, maxArchiveBytes });
    else await readTarGzWeb(res.body, { onEntry, onFile, maxFileBytes, maxArchiveBytes, signal });
    sum = tally.summary({ countCategories, locBasis });
  } catch (err) {
    // A download the browser refused (cross-origin) shows as "could not reach". GitHub has a
    // per-language byte count to fall back on; the other platforms allow their archives.
    if (provider.id !== 'github' || !/could not reach/.test(err.message)) throw err;
    if (!session.archiveTried) session.archiveBlocked = true;
    sum = await estimateFromLanguages(api, repo, { countCategories });
    locEstimated = true;
  }
  return {
    headSha: null,
    branch: repo.defaultBranch,
    commits: stats.commits,
    authors: stats.authors,
    weekly: stats.weekly,
    lastCommitAt: stats.lastCommitAt,
    windowDays: Math.round(effectiveWindow * 10) / 10,
    treeFiles,
    engine: locEstimated ? 'estimate' : 'browser',
    locEstimated,
    ...sum,
  };
}

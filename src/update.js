// Staying on the latest version: what the newest release is, a quiet daily notice when one is out,
// and `cloc-fusion update`, which replaces a standalone executable with the latest one for this
// platform after checking it against the release's SHA-256 checksums.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rename, rm, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { ApiClient } from './http.js';
import { VERSION, buildInfo, compareVersions } from './version.js';

const run = promisify(execFile);
// Overridable for forks; only an owner/name pair is accepted.
const repoOverride = process.env.CLOC_FUSION_UPDATE_REPO;
export const UPDATE_REPO = repoOverride && /^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(repoOverride) ? repoOverride : 'cxsmtp/cloc-fusion';
const DAY = 86400000;

/** This platform's executable name in a release, as scripts/build-binary.mjs names it. */
export function assetName(platform = process.platform, arch = process.arch) {
  const os = { win32: 'windows', darwin: 'macos', linux: 'linux' }[platform] || platform;
  return `cloc-fusion-${os}-${arch}${platform === 'win32' ? '.exe' : ''}`;
}

/** A GitHub token for a private repository: GITHUB_TOKEN / GH_TOKEN, else the GitHub CLI's. */
async function githubToken() {
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  try {
    const { stdout } = await run('gh', ['auth', 'token'], { timeout: 5000, windowsHide: true });
    return stdout.trim();
  } catch {
    return '';
  }
}

function client(token, timeoutMs) {
  return new ApiClient({
    name: 'GitHub releases',
    baseUrl: 'https://api.github.com',
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    retries: 1,
    timeoutMs,
  });
}

/** The newest release: { version, tag, url, notes, publishedAt, assets }. Tries without a token first. */
export async function latestRelease({ timeoutMs = 15000 } = {}) {
  const path = `/repos/${UPDATE_REPO}/releases/latest`;
  let rel;
  try {
    rel = await client('', timeoutMs).get(path);
  } catch (err) {
    if (![401, 403, 404].includes(err.status)) throw err;
    const token = await githubToken();
    if (!token) throw new Error(`could not read the releases of ${UPDATE_REPO} (a private repository needs GITHUB_TOKEN, or "gh auth login")`);
    try {
      rel = await client(token, timeoutMs).get(path);
    } catch (e) {
      if (e.status === 404) throw new Error(`no release of ${UPDATE_REPO} has been published yet (or this token cannot see it)`);
      throw e;
    }
  }
  return {
    version: String(rel.tag_name || '').replace(/^v/, ''),
    tag: rel.tag_name,
    url: rel.html_url,
    notes: rel.body || '',
    publishedAt: rel.published_at,
    assets: (rel.assets || []).map((a) => ({ name: a.name, id: a.id, size: a.size, api: a.url })),
  };
}

/** { current, latest, newer, url } — or null when the check could not be made. */
export async function checkForUpdate(options) {
  const rel = await latestRelease(options);
  return { current: VERSION, latest: rel.version, newer: compareVersions(rel.version, VERSION) > 0, url: rel.url, release: rel };
}

/**
 * A quiet daily check, for the end of a command: resolves to a one-line notice when a newer release
 * exists, else ''. Never throws, never waits more than ~2.5 s, skipped in CI or when turned off
 * (CLOC_FUSION_NO_UPDATE_CHECK=1).
 */
export async function updateNotice({ cacheDir = join(homedir(), '.cloc-fusion') } = {}) {
  if (process.env.CLOC_FUSION_NO_UPDATE_CHECK || process.env.CI) return '';
  const cache = join(cacheDir, 'update-check.json');
  try {
    let state = null;
    try {
      state = JSON.parse(await readFile(cache, 'utf8'));
    } catch {}
    if (!state || Date.now() - state.checkedAt > DAY) {
      const rel = await latestRelease({ timeoutMs: 2500 });
      state = { checkedAt: Date.now(), latest: rel.version };
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cache, JSON.stringify(state), { mode: 0o600 });
    }
    return state.latest && compareVersions(state.latest, VERSION) > 0 ? `cloc-fusion ${state.latest} is available (you have ${VERSION}): run "cloc-fusion update", or see "cloc-fusion changelog".` : '';
  } catch {
    return '';
  }
}

/** SHA-256 of a buffer, hex. */
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** "hash  name" lines → { name: hash }. */
export function parseChecksums(text) {
  const out = Object.create(null);
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (m) out[m[2].trim()] = m[1].toLowerCase();
  }
  return out;
}

async function downloadAsset(api, asset) {
  const res = await api.send(asset.api, { accept: 'application/octet-stream', timeoutMs: 30 * 60000 });
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Replace this executable with the latest release. Returns a message. Source installs are told how
 * to update instead (git pull), since there is no executable to replace.
 */
export async function selfUpdate({ log = () => {}, force = false } = {}) {
  const info = buildInfo();
  const rel = await latestRelease();
  const newer = compareVersions(rel.version, VERSION) > 0;
  if (!newer && !force) return `You have the latest version (${VERSION}).`;
  if (info.kind !== 'executable') return `cloc-fusion ${rel.version} is available (you have ${VERSION}). You run it from source: update with "git pull" in its folder, or download the executable from ${rel.url}.`;

  const name = assetName();
  const asset = rel.assets.find((a) => a.name === name);
  const sums = rel.assets.find((a) => a.name === 'SHA256SUMS.txt');
  if (!asset) throw new Error(`release ${rel.tag} has no ${name}`);
  if (!sums) throw new Error(`release ${rel.tag} has no SHA256SUMS.txt: refusing to install an unverified file`);
  const token = await githubToken();
  const api = client(token, 30 * 60000);
  log(`Downloading ${name} ${rel.version}…`);
  const [bin, sumText] = await Promise.all([downloadAsset(api, asset), downloadAsset(api, sums)]);
  const expected = parseChecksums(sumText.toString('utf8'))[name];
  if (!expected) throw new Error(`SHA256SUMS.txt has no entry for ${name}`);
  if (sha256(bin) !== expected) throw new Error(`checksum mismatch for ${name}: the download is corrupt or was tampered with; nothing was changed`);
  log('Checksum verified.');

  const target = process.execPath;
  const dir = dirname(target);
  const fresh = join(dir, `.${basename(target)}.new`);
  const old = join(dir, `.${basename(target)}.old`);
  await writeFile(fresh, bin, { mode: 0o755 });
  await chmod(fresh, 0o755).catch(() => {});
  // The new file must run and report the version it claims before it replaces this one.
  try {
    const { stdout } = await run(fresh, ['--version'], { timeout: 30000, windowsHide: true, env: { ...process.env, CLOC_FUSION_NO_UPDATE_CHECK: '1' } });
    if (stdout.trim() !== rel.version) throw new Error(`it reports ${stdout.trim()}`);
  } catch (err) {
    await rm(fresh, { force: true });
    throw new Error(`the downloaded executable did not start correctly (${err.message}); nothing was changed`);
  }
  // A running executable can be renamed (Windows forbids overwriting it, but not moving it).
  await rm(old, { force: true }).catch(() => {});
  await rename(target, old);
  try {
    await rename(fresh, target);
  } catch (err) {
    await rename(old, target).catch(() => {});
    throw err;
  }
  await rm(old, { force: true }).catch(() => {}); // fails on Windows while running: removed next update
  return `Updated cloc-fusion ${VERSION} → ${rel.version}. See what changed: cloc-fusion changelog`;
}

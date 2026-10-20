// Commit statistics from a platform's commit list. Pure, shared by the API engine and the
// standalone HTML page.

const DAY = 86400000;

/** Contributing developers are counted over this many days (the usual licensing window). */
export const DEV_WINDOW_DAYS = 90;
const BOT = /\[bot\]|^(dependabot|renovate|github-actions|snyk-bot|greenkeeper|azure-pipelines|gitlab-bot)\b|^noreply@github\.com$|^action@github\.com$/i;

/** Is this commit author an automation account (dependabot, renovate, github-actions…)? */
export const isBot = (email) => BOT.test(String(email || '').trim());

/**
 * A short one-way id for a commit author (lower-cased email), so developers can be counted once
 * across repositories without the report holding anyone's email. Synchronous and identical in Node
 * and the browser (two 32-bit FNV-1a hashes).
 */
export function devId(email) {
  const s = String(email || '').trim().toLowerCase();
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0').slice(0, 4);
}

/** Developers (authors, bots aside) of the commits in the last DEV_WINDOW_DAYS: { devs90, devIds90 }. */
export function developersOf(commits, now = Date.now()) {
  const since = now - DEV_WINDOW_DAYS * DAY;
  const ids = new Set();
  for (const { t, email } of commits) if (t >= since && email && !isBot(email)) ids.add(devId(email));
  return { devs90: ids.size, devIds90: [...ids].sort() };
}

/** Commit stats from [{ t, email, merge }]: count, authors, last commit, weekly series. */
export function statsFromCommits(list, { now = Date.now(), sinceT = 0, includeMerges = false, weeks = 52 } = {}) {
  const weekly = new Array(weeks).fill(0);
  const authors = new Set();
  const counted = [];
  let commits = 0;
  let last = null;
  for (const c of list) {
    if (!Number.isFinite(c.t) || c.t < sinceT) continue;
    if (c.merge && !includeMerges) continue;
    commits++;
    counted.push(c);
    if (c.email) authors.add(String(c.email).toLowerCase());
    if (last === null || c.t > last) last = c.t;
    const w = Math.floor((now - c.t) / (7 * DAY));
    if (w >= 0 && w < weeks) weekly[weeks - 1 - w]++;
  }
  return { commits, authors: authors.size, weekly, lastCommitAt: last ? new Date(last).toISOString() : null, ...developersOf(counted, now) };
}

// Commit statistics from a platform's commit list. Pure, shared by the API engine and the
// standalone HTML page.

const DAY = 86400000;

/** Commit stats from [{ t, email, merge }]: count, authors, last commit, weekly series. */
export function statsFromCommits(list, { now = Date.now(), sinceT = 0, includeMerges = false, weeks = 52 } = {}) {
  const weekly = new Array(weeks).fill(0);
  const authors = new Set();
  let commits = 0;
  let last = null;
  for (const c of list) {
    if (!Number.isFinite(c.t) || c.t < sinceT) continue;
    if (c.merge && !includeMerges) continue;
    commits++;
    if (c.email) authors.add(String(c.email).toLowerCase());
    if (last === null || c.t > last) last = c.t;
    const w = Math.floor((now - c.t) / (7 * DAY));
    if (w >= 0 && w < weeks) weekly[weeks - 1 - w]++;
  }
  return { commits, authors: authors.size, weekly, lastCommitAt: last ? new Date(last).toISOString() : null };
}

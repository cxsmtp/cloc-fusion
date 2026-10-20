// Contributing developers in the last 90 days: per repository, unique across the estate and per
// organization, bots excluded, the same from the git engine, the API engine and the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statsFromCommits, developersOf, devId, isBot, DEV_WINDOW_DAYS } from '../src/commits.js';
import { commitStats } from '../src/git.js';
import { buildReport, reprice } from '../src/report/build.js';
import { normalizeConfig } from '../src/config.js';
import { toHtml } from '../src/report/html.js';
import { toCsv } from '../src/report/csv.js';
import { toMarkdown } from '../src/report/text.js';

const DAY = 86400000;
const now = Date.parse('2026-10-20T12:00:00Z');
const commits = [
  { t: now - 1 * DAY, email: 'Ana@Acme.test' },
  { t: now - 2 * DAY, email: 'ana@acme.test' }, // same person, other case
  { t: now - 10 * DAY, email: 'ben@acme.test' },
  { t: now - 89 * DAY, email: 'cy@acme.test' },
  { t: now - 91 * DAY, email: 'old@acme.test' }, // outside the 90 days
  { t: now - 3 * DAY, email: '49699333+dependabot[bot]@users.noreply.github.com' },
  { t: now - 3 * DAY, email: 'github-actions@github.com' },
  { t: now - 4 * DAY, email: 'renovate@whitesourcesoftware.com' },
  { t: now - 4 * DAY, email: '12345+dana@users.noreply.github.com' }, // a real person's GitHub noreply address
];

test('developers in the last 90 days: case-insensitive, bots excluded, older commits out', () => {
  assert.equal(DEV_WINDOW_DAYS, 90);
  const d = developersOf(commits, now);
  assert.equal(d.devs90, 4); // ana, ben, cy, dana
  assert.equal(d.devIds90.length, 4);
  assert.ok(d.devIds90.includes(devId('ANA@acme.test')));
  assert.ok(!d.devIds90.includes(devId('old@acme.test')));
  assert.ok(isBot('49699333+dependabot[bot]@users.noreply.github.com'));
  assert.ok(isBot('github-actions@github.com'));
  assert.ok(!isBot('12345+dana@users.noreply.github.com'));
  // Ids are short and do not contain the email.
  assert.match(devId('ana@acme.test'), /^[0-9a-f]{12}$/);
  assert.equal(devId(' Ana@ACME.test '), devId('ana@acme.test'));
});

test('the API engine, the browser and the git engine count the same developers', () => {
  const api = statsFromCommits(commits.map((c) => ({ ...c, merge: false })), { now, sinceT: now - 365 * DAY });
  const log = commits.map((c) => `${Math.floor(c.t / 1000)}\t${c.email}`).join('\n');
  const git = commitStats(log, { now });
  assert.equal(api.devs90, 4);
  assert.equal(git.devs90, 4);
  assert.deepEqual(api.devIds90, git.devIds90);
  // Merge commits that are not counted do not add developers.
  const merges = statsFromCommits([{ t: now - DAY, email: 'merger@acme.test', merge: true }], { now });
  assert.equal(merges.devs90, 0);
});

test('the report counts each developer once across repositories and per organization', () => {
  const id = (e) => devId(e);
  const repos = [
    { fullName: 'acme/api', org: 'acme', connection: 'gh', provider: 'github', analyzedAt: 'x', loc: 12000, commits: 40, devs90: 2, devIds90: [id('ana@x'), id('ben@x')] },
    { fullName: 'acme/web', org: 'acme', connection: 'gh', provider: 'github', analyzedAt: 'x', loc: 5000, commits: 9, devs90: 2, devIds90: [id('ana@x'), id('cy@x')] },
    { fullName: 'beta/app', org: 'beta', connection: 'gh', provider: 'github', analyzedAt: 'x', loc: 800, commits: 3, devs90: 1, devIds90: [id('ana@x')] },
    { fullName: 'beta/old', org: 'beta', connection: 'gh', provider: 'github', analyzedAt: 'x', loc: 800, commits: 0, devs90: 0, devIds90: [] },
  ];
  const cfg = normalizeConfig({ fusion: { models: [{ id: 'm', name: 'M', creditsPer10k: 1 }] } });
  const report = buildReport(cfg, repos);
  assert.equal(report.developers.total, 3); // ana, ben, cy
  assert.equal(report.developers.windowDays, 90);
  assert.deepEqual(report.byOrg.map((o) => [o.org, o.devs90]), [['acme', 3], ['beta', 1]]);
  // Re-pricing keeps the count.
  assert.equal(reprice(report, { fusion: cfg.fusion, totals: { extraPercent: 10 } }).developers.total, 3);
  // Everywhere the report goes.
  const html = toHtml(report);
  assert.match(html, /Developers · 90 days/);
  assert.match(html, /3 contributing developers in the last 90 days/);
  assert.match(html, /data-k="dv"/);
  assert.ok(!html.includes('ana@x'), 'no emails in the report');
  assert.match(toCsv(report).split('\n')[0], /Developers \(90 days\)/);
  assert.match(toMarkdown(report), /Contributing developers \(90 days\) \| 3 \|/);
  assert.ok(!JSON.stringify(report).includes('ana@x'));
});

test('a commit window shorter than 90 days is flagged in the report', () => {
  const report = buildReport(normalizeConfig({ windowDays: 30 }), [{ fullName: 'a/b', org: 'a', connection: 'c', analyzedAt: 'x', loc: 10, commits: 1, devs90: 1, devIds90: ['abc'] }]);
  assert.equal(report.developers.coveredDays, 30);
  assert.match(toHtml(report), /only 30 days of commits were read/);
});

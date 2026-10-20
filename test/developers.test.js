// Contributors in the last 90 days, from the commit history: people and bots, per repository and
// across the estate, the same from the git engine, the API engine and the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statsFromCommits, contributorsOf, isBot, DEV_WINDOW_DAYS } from '../src/commits.js';
import { commitStats } from '../src/git.js';
import { buildReport, reprice } from '../src/report/build.js';
import { normalizeConfig } from '../src/config.js';
import { toHtml } from '../src/report/html.js';
import { toCsv, toContributorsCsv } from '../src/report/csv.js';
import { toMarkdown } from '../src/report/text.js';

const DAY = 86400000;
const now = Date.parse('2026-10-20T12:00:00Z');
const commits = [
  { t: now - 1 * DAY, email: 'Ana@Acme.test', name: 'Ana Ruiz' },
  { t: now - 2 * DAY, email: 'ana@acme.test', name: 'Ana R' }, // same person, other case
  { t: now - 10 * DAY, email: 'ben@acme.test', name: 'Ben' },
  { t: now - 89 * DAY, email: 'cy@acme.test', name: 'Cy' },
  { t: now - 91 * DAY, email: 'old@acme.test', name: 'Old' }, // outside the 90 days
  { t: now - 3 * DAY, email: '49699333+dependabot[bot]@users.noreply.github.com', name: 'dependabot[bot]' },
  { t: now - 3 * DAY, email: '41898282+github-actions[bot]@users.noreply.github.com', name: 'github-actions[bot]' },
  { t: now - 4 * DAY, email: 'bot@renovateapp.com', name: 'Renovate Bot' },
  { t: now - 4 * DAY, email: '12345+dana@users.noreply.github.com', name: 'Dana' }, // a real person's GitHub noreply address
];

test('contributors in the last 90 days: one per email, bots listed as bots, older commits out', () => {
  assert.equal(DEV_WINDOW_DAYS, 90);
  const c = contributorsOf(commits, now);
  assert.equal(c.devs90, 4); // ana, ben, cy, dana
  assert.equal(c.bots90, 3);
  const ana = c.contributors90.find((x) => x.email.toLowerCase() === 'ana@acme.test');
  assert.equal(ana.commits, 2);
  assert.equal(ana.name, 'Ana Ruiz'); // the name on the latest commit
  assert.equal(ana.bot, false);
  assert.ok(!c.contributors90.some((x) => x.email === 'old@acme.test'));
  assert.deepEqual(c.contributors90.filter((x) => x.bot).map((x) => x.name).sort(), ['Renovate Bot', 'dependabot[bot]', 'github-actions[bot]']);
  assert.ok(isBot('49699333+dependabot[bot]@users.noreply.github.com'));
  assert.ok(isBot('x@y', 'renovate[bot]'));
  assert.ok(!isBot('12345+dana@users.noreply.github.com', 'Dana'));
});

test('the API engine, the browser and the git engine find the same contributors', () => {
  const api = statsFromCommits(commits.map((c) => ({ ...c, merge: false })), { now, sinceT: now - 365 * DAY });
  const log = commits.map((c) => `${Math.floor(c.t / 1000)}\t${c.email}\t${c.name}`).join('\n');
  const git = commitStats(log, { now });
  assert.equal(api.devs90, 4);
  assert.equal(git.devs90, 4);
  assert.equal(git.bots90, 3);
  assert.deepEqual(api.contributors90, git.contributors90);
  // Merge commits that are not counted add nobody.
  assert.equal(statsFromCommits([{ t: now - DAY, email: 'merger@acme.test', merge: true }], { now }).contributors90.length, 0);
});

test('the report lists everyone once with their repositories, and counts developers once', () => {
  const C = (email, name, commitsN = 1) => ({ email, name, commits: commitsN, lastCommitAt: new Date(now - DAY).toISOString(), bot: isBot(email, name) });
  const repo = (fullName, list) => ({ fullName, org: fullName.split('/')[0], connection: 'gh', provider: 'github', analyzedAt: 'x', loc: 12000, commits: 40, contributors90: list });
  const repos = [
    repo('acme/api', [C('ana@x', 'Ana', 5), C('ben@x', 'Ben'), C('1+dependabot[bot]@users.noreply.github.com', 'dependabot[bot]', 3)]),
    repo('acme/web', [C('ANA@x', 'Ana'), C('cy@x', 'Cy'), C('svc-build@x', 'Build')]),
    repo('beta/app', [C('ana@x', 'Ana'), C('1+dependabot[bot]@users.noreply.github.com', 'dependabot[bot]')]),
  ];
  const cfg = normalizeConfig({ fusion: { models: [{ id: 'm', name: 'M', creditsPer10k: 1 }] } });
  const report = buildReport(cfg, repos);
  assert.equal(report.developers.total, 4); // ana, ben, cy, build
  assert.equal(report.developers.bots, 1); // dependabot, once
  const ana = report.contributors.find((c) => c.email === 'ana@x');
  assert.deepEqual(ana.repos, ['acme/api', 'acme/web', 'beta/app']);
  assert.equal(ana.commits, 7);
  const bot = report.contributors.find((c) => c.bot);
  assert.deepEqual(bot.repos, ['acme/api', 'beta/app']);
  assert.equal(report.contributors.at(-1).bot, true, 'bots are listed after the people');
  assert.deepEqual(report.byOrg.map((o) => [o.org, o.devs90]), [['acme', 4], ['beta', 1]]);
  assert.deepEqual(report.repos.map((r) => [r.fullName, r.devs90, r.bots90]), [['acme/api', 2, 1], ['acme/web', 3, 0], ['beta/app', 1, 1]]);
  // A service account named in the settings is a bot too, and re-pricing applies it (both ways).
  const withBots = reprice(report, { fusion: cfg.fusion, bots: ['svc-*'] });
  assert.equal(withBots.developers.total, 3);
  assert.equal(withBots.developers.bots, 2);
  assert.equal(reprice(withBots, { fusion: cfg.fusion, bots: [] }).developers.total, 4);
  // Everywhere the report goes.
  const html = toHtml(report);
  assert.match(html, /Contributors · last 90 days/);
  assert.match(html, /4 developers · 1 bot/);
  assert.match(html, /<script id="contrib" type="application\/json">/);
  const csv = toContributorsCsv(report).split('\r\n');
  assert.match(csv[0], /Name,Email,Type,Repositories,Commits \(90 days\),Last commit,Repository list/);
  assert.match(csv[1], /^Ana,ana@x,Developer,3,7,/);
  assert.ok(csv.some((l) => /^dependabot\[bot\],.*,Bot,2,4,/.test(l)));
  assert.match(toCsv(report).split('\n')[0], /Developers \(90 days\)/);
  assert.match(toMarkdown(report), /## Contributors, last 90 days \(4 developers, 1 bots\)/);
});

test('a commit window shorter than 90 days is flagged in the report', () => {
  const report = buildReport(normalizeConfig({ windowDays: 30 }), [{ fullName: 'a/b', org: 'a', connection: 'c', analyzedAt: 'x', loc: 10, commits: 1, contributors90: [{ email: 'a@x', name: 'A', commits: 1, lastCommitAt: '2026-10-01T00:00:00Z', bot: false }] }]);
  assert.equal(report.developers.coveredDays, 30);
  assert.match(toHtml(report), /only 30 days of commits were read/);
});

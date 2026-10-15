import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frequencyOf, suggestedScans, unitsOf, fusionEstimate, creditSummary, fusionSettings } from '../src/fusion.js';

test('commit frequency buckets follow the calculator thresholds', () => {
  assert.equal(frequencyOf(0, 365).id, 'rare');
  assert.equal(frequencyOf(300, 365).id, 'more-5-week'); // ~5.75 a week
  assert.equal(frequencyOf(5 * 52, 365).id, '1-5-week'); // exactly 5 a week is not "more than 5"
  assert.equal(frequencyOf(52, 365).id, '1-5-week'); // once a week
  assert.equal(frequencyOf(26, 365).id, '2-weeks');
  assert.equal(frequencyOf(12, 365).id, 'month');
  assert.equal(frequencyOf(6, 365).id, '2-months');
  assert.equal(frequencyOf(4, 365).id, '3-months');
  assert.equal(frequencyOf(2, 365).id, '6-months');
  assert.equal(frequencyOf(1, 365).id, 'year');
  // A 30-day-old repository with 10 commits changes more than twice a week.
  assert.equal(frequencyOf(10, 30).id, '1-5-week');
  assert.ok(Math.abs(frequencyOf(52, 364).perWeek - 1) < 1e-9);
});

test('suggested Fusion scans: weekly for the busiest, scaled to the period', () => {
  assert.equal(suggestedScans('more-5-week', 12), 52);
  assert.equal(suggestedScans('1-5-week', 12), 26);
  assert.equal(suggestedScans('month', 12), 6);
  assert.equal(suggestedScans('rare', 12), 1);
  assert.equal(suggestedScans('more-5-week', 6), 26);
  assert.equal(suggestedScans('year', 3), 1); // never below one
});

test('10K units round up per repository', () => {
  assert.equal(unitsOf(0), 0);
  assert.equal(unitsOf(1), 1);
  assert.equal(unitsOf(10000), 1);
  assert.equal(unitsOf(12000), 2);
  assert.equal(unitsOf(null), 0);
});

test('credits = units × scans × rate, with overrides and criticality', () => {
  const repos = [
    { fullName: 'a', connection: 'c', org: 'o', loc: 12000, frequency: 'more-5-week' }, // 2 × 52
    { fullName: 'b', connection: 'c', org: 'o', loc: 5000, frequency: 'month' }, // 1 × 6
    { fullName: 'c', connection: 'c', org: 'o', loc: 5000, frequency: 'year', criticality: 5 }, // criticality wins: 1 × 12
    { fullName: 'd', connection: 'c', org: 'o', loc: 5000, frequency: 'month', scansOverride: 2 }, // 1 × 2
    { fullName: 'e', connection: 'c', org: 'o', loc: 0, frequency: 'month' }, // no lines, not counted
    { fullName: 'f', connection: 'c', org: 'o', loc: 9000, frequency: 'month', error: 'boom' },
  ];
  const est = fusionEstimate(repos, { models: [{ id: 'm', name: 'M', creditsPer10k: 2 }], byCriticality: { 5: { scans: 12 } } });
  const by = Object.fromEntries(est.rows.map((r) => [r.fullName, r]));
  assert.equal(by.a.credits, 2 * 52 * 2);
  assert.equal(by.b.credits, 1 * 6 * 2);
  assert.equal(by.c.scans, 12);
  assert.equal(by.c.scansFrom, 'criticality');
  assert.equal(by.d.scans, 2);
  assert.equal(by.e.credits, 0);
  assert.equal(by.f.included, false);
  assert.equal(est.totals.repos, 4);
  assert.equal(est.totals.credits, 208 + 12 + 24 + 4);
  assert.equal(est.rows[0].fullName, 'a', 'busiest first');
});

test('a model without a rate leaves credits unknown', () => {
  const est = fusionEstimate([{ fullName: 'a', loc: 100, frequency: 'month' }], { models: [{ id: 'm', name: 'M' }] });
  assert.equal(est.rows[0].credits, null);
  assert.equal(est.totals.unknownRate, 1);
});

test('saved per-frequency scans are kept, the rest suggested', () => {
  const s = fusionSettings({ periodMonths: 12, byFrequency: { month: { scans: 3 } } });
  assert.equal(s.byFrequency.month.scans, 3);
  assert.equal(s.byFrequency['more-5-week'].scans, 52);
});

test('credit summary adds the extra % and rounds bundles up', () => {
  const s = creditSummary(10500, { extraPercent: 10, bundleCredits: 10000 });
  assert.equal(s.total, 11550);
  assert.equal(s.bundles, 2);
  assert.equal(creditSummary(10000, {}).bundles, 1);
  assert.equal(creditSummary(0, {}).bundles, 0);
});

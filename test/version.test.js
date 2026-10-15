// The version is one fact: src/version.js, package.json, the newest CHANGELOG entry and the CLI
// must all say the same thing, and the changelog must read as a clean history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VERSION, changelogReleases, compareVersions } from '../src/version.js';
import { parseChecksums, assetName } from '../src/update.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

test('package.json, src/version.js and the CLI agree', () => {
  assert.equal(pkg.version, VERSION);
  const out = execFileSync(process.execPath, [new URL('../bin/cloc-fusion.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '--version'], { env: { ...process.env, HTTPS_PROXY: '', HTTP_PROXY: '', https_proxy: '', http_proxy: '' } });
  assert.equal(out.toString().trim(), VERSION);
});

test('the newest CHANGELOG entry is this version, and the history is in order', () => {
  const releases = changelogReleases(changelog);
  assert.ok(releases.length >= 1);
  assert.equal(releases[0].version, VERSION, 'add a "## [x.y.z] - date" entry at the top of CHANGELOG.md for this version');
  for (const r of releases) {
    assert.match(r.date || '', /^\d{4}-\d{2}-\d{2}$/, `release ${r.version} needs a date`);
    assert.match(r.body, /^### (Added|Changed|Fixed|Security|Removed|Deprecated)/m, `release ${r.version} needs at least one section`);
  }
  for (let i = 1; i < releases.length; i++) assert.equal(compareVersions(releases[i - 1].version, releases[i].version), 1, 'newest first, no duplicates');
});

test('version comparison', () => {
  assert.equal(compareVersions('1.2.0', '1.10.0'), -1);
  assert.equal(compareVersions('v2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.2.3', 'v1.2.3'), 0);
});

test('release checksums and asset names', () => {
  const sums = parseChecksums(`${'a'.repeat(64)}  cloc-fusion-linux-x64\n${'B'.repeat(64)} *cloc-fusion-windows-x64.exe\njunk line\n`);
  assert.equal(sums['cloc-fusion-linux-x64'], 'a'.repeat(64));
  assert.equal(sums['cloc-fusion-windows-x64.exe'], 'b'.repeat(64));
  assert.equal(Object.keys(sums).length, 2);
  assert.equal(assetName('win32', 'x64'), 'cloc-fusion-windows-x64.exe');
  assert.equal(assetName('darwin', 'arm64'), 'cloc-fusion-macos-arm64');
  assert.equal(assetName('linux', 'arm64'), 'cloc-fusion-linux-arm64');
});

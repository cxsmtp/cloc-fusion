#!/usr/bin/env node
// Run by the release workflow on a v* tag: the tag must be v<src/version.js>, CHANGELOG.md must
// have that version as its newest entry, and that entry becomes the release notes.
//
//   node scripts/release-check.mjs v1.2.0 > RELEASE_NOTES.md
import { readFileSync } from 'node:fs';
import { VERSION, changelogReleases } from '../src/version.js';

const tag = process.argv[2] || process.env.GITHUB_REF_NAME || '';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const fail = (msg) => {
  console.error(`release check failed: ${msg}`);
  process.exit(1);
};
if (tag !== `v${VERSION}`) fail(`tag ${tag || '(none)'} does not match src/version.js (v${VERSION})`);
if (pkg.version !== VERSION) fail(`package.json says ${pkg.version}, src/version.js says ${VERSION}`);
const releases = changelogReleases(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
if (releases[0]?.version !== VERSION) fail(`CHANGELOG.md's newest entry is ${releases[0]?.version}, not ${VERSION}`);
const r = releases[0];
process.stdout.write(`${r.body}\n\n---\nDownload the file for your system below, check it against SHA256SUMS.txt, and run it. Already have cloc-fusion? Run \`cloc-fusion update\`.\nFull history: [CHANGELOG.md](https://github.com/${process.env.GITHUB_REPOSITORY || 'cxsmtp/cloc-fusion'}/blob/${tag}/CHANGELOG.md)\n`);

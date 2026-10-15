#!/usr/bin/env node
// Build a standalone executable for the current platform: one file with Node.js and cloc-fusion
// inside (Node's single executable applications). Run on each OS (CI does: see release.yml).
//
//   node scripts/build-binary.mjs     → dist/cloc-fusion-<os>-<arch>[.exe]
//
// Build-time tools only (esbuild to bundle, postject to inject); the result needs nothing.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync, readFileSync, chmodSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const os = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform] || process.platform;
const exe = process.platform === 'win32' ? '.exe' : '';
const out = join('dist', `cloc-fusion-${os}-${process.arch}${exe}`);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

// 1. One CommonJS file with everything (the optional Claude SDK included), plus what this build is:
//    its commit and date, and the changelog, read by src/version.js.
let commit = process.env.GITHUB_SHA || '';
try {
  commit ||= execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
} catch {}
const build = { commit: commit.slice(0, 12) || 'unknown', date: new Date().toISOString().slice(0, 10) };
writeFileSync('dist/build-globals.mjs', `globalThis.__CLOC_FUSION_BUILD__ = ${JSON.stringify(build)};\nglobalThis.__CLOC_FUSION_CHANGELOG__ = ${JSON.stringify(readFileSync('CHANGELOG.md', 'utf8'))};\n`);
writeFileSync('dist/entry.mjs', "import './build-globals.mjs';\nimport '../bin/cloc-fusion.js';\n");
run(npx, ['--yes', 'esbuild@0.25.10', 'dist/entry.mjs', '--bundle', '--platform=node', '--format=cjs', '--target=node22', '--outfile=dist/cloc-fusion.cjs', '--log-level=warning', '--legal-comments=none']);

// 2. The SEA blob.
writeFileSync('dist/sea-config.json', JSON.stringify({ main: 'dist/cloc-fusion.cjs', output: 'dist/sea-prep.blob', disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: true }));
run(process.execPath, ['--experimental-sea-config', 'dist/sea-config.json']);

// 3. A copy of this node binary with the blob injected.
copyFileSync(process.execPath, out);
chmodSync(out, 0o755);
if (process.platform === 'darwin') run('codesign', ['--remove-signature', out]);
const inject = [out, 'NODE_SEA_BLOB', 'dist/sea-prep.blob', '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') inject.push('--macho-segment-name', 'NODE_SEA');
run(npx, ['--yes', 'postject@1.0.0-alpha.6', ...inject]);
if (process.platform === 'darwin') run('codesign', ['--sign', '-', out]);

rmSync('dist/sea-prep.blob', { force: true });
rmSync('dist/sea-config.json', { force: true });
console.log(`\nBuilt ${out} (${Math.round(statSync(out).size / 1048576)} MB)`);

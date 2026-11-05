import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countText, selectFiles, LocTally, adjustedLoc } from '../src/loc.js';
import { TarParser } from '../src/tar.js';
import { tar } from '../bench/mock-github.js';
import { languageOf, globToRegExp, isExcludedPath } from '../src/languages.js';

const js = languageOf('a.js');
const py = languageOf('a.py');

test('C-style code, comments and blanks', () => {
  const src = ['// header', 'const a = 1; // trailing', '', '/* block', '   still comment', '*/', 'app.get("/*", f);', 'x(); /* inline */ y();', '/* one */ z();', ''].join('\n');
  assert.deepEqual(countText(src, js), { code: 4, comment: 4, blank: 1 });
});

test('a quoted /* does not open a comment', () => {
  assert.deepEqual(countText("route('/*');\nnext();\n", js), { code: 2, comment: 0, blank: 0 });
});

test('Python hash comments and docstrings', () => {
  const src = ['"""Module doc', 'more doc', '"""', '# comment', 'def f():', '    return 1  # trailing', ''].join('\n');
  assert.deepEqual(countText(src, py), { code: 2, comment: 4, blank: 0 });
});

test('CRLF line endings', () => {
  assert.deepEqual(countText('a();\r\n\r\n// c\r\n', js), { code: 1, comment: 1, blank: 1 });
});

test('language detection', () => {
  assert.equal(languageOf('src/Main.java').name, 'Java');
  assert.equal(languageOf('infra/main.tf').category, 'iac');
  assert.equal(languageOf('Dockerfile').name, 'Dockerfile');
  assert.equal(languageOf('Dockerfile.prod').name, 'Dockerfile');
  assert.equal(languageOf('README.md').category, 'docs');
  assert.equal(languageOf('image.png'), null);
  assert.equal(languageOf('.gitignore'), null);
});

test('dependencies, build output and generated files are excluded', () => {
  assert.ok(isExcludedPath('node_modules/x/index.js'));
  assert.ok(isExcludedPath('web/dist/app.js'));
  assert.ok(isExcludedPath('static/jquery.min.js'));
  assert.ok(isExcludedPath('package-lock.json'));
  assert.ok(!isExcludedPath('packages/core/src/index.js'));
  assert.ok(!isExcludedPath('src/build.js'));
});

test('globs', () => {
  assert.ok(globToRegExp('**/test/**').test('a/b/test/c.js'));
  assert.ok(globToRegExp('**/*.spec.ts').test('src/x.spec.ts'));
  assert.ok(globToRegExp('**/*.spec.ts').test('x.spec.ts'));
  assert.ok(!globToRegExp('src/*.js').test('src/a/b.js'));
  assert.ok(globToRegExp('acme/legacy-*').test('acme/legacy-app'));
});

test('file selection and tally by category', () => {
  const files = selectFiles(
    [
      { path: 'src/a.js', oid: '1', size: 10 },
      { path: 'docs/a.md', oid: '2', size: 10 },
      { path: 'node_modules/b.js', oid: '3', size: 10 },
      { path: 'test/a.test.js', oid: '4', size: 10 },
      { path: 'logo.png', oid: '5', size: 10 },
    ],
    { exclude: ['test/**'] },
  );
  assert.deepEqual(files.map((f) => f.path), ['src/a.js', 'docs/a.md']);
  const t = new LocTally();
  t.add(files[0].lang, Buffer.from('a();\nb();\n'));
  t.add(files[1].lang, Buffer.from('# Title\ntext\n'));
  t.add(files[0].lang, Buffer.from([0x61, 0, 0x62])); // binary: ignored
  const s = t.summary();
  assert.equal(s.loc, 2);
  assert.equal(s.files, 1);
  assert.equal(s.byCategory.docs.code, 2);
  assert.equal(s.mainLanguage, 'JavaScript');
  assert.equal(t.summary({ locBasis: 'all', countCategories: ['code', 'docs'] }).loc, 4);
});

test('dense files (minified, generated): 64 KB or more and over 512 bytes per line count as ceil(bytes / 40)', () => {
  const KB64 = 64 * 1024;
  assert.equal(adjustedLoc(KB64 - 1, 1), 1, 'under 64 KB: lines as counted');
  assert.equal(adjustedLoc(KB64, 1), Math.ceil(KB64 / 40));
  assert.equal(adjustedLoc(KB64, 128), 128, 'exactly 512 bytes per line is not dense');
  assert.equal(adjustedLoc(KB64, 127), Math.ceil(KB64 / 40));
  assert.equal(adjustedLoc(KB64, 0), Math.ceil(KB64 / 40), 'no code line at all');

  const t = new LocTally();
  // A minified bundle: the whole program on one line, 100,000 bytes.
  const minified = 'var a=' + 'x+'.repeat(49_995) + '12;\n';
  assert.equal(Buffer.byteLength(minified), 100_000);
  t.add(js, Buffer.from(minified));
  // Ordinary code of the same size keeps its own line count.
  const normal = 'const value = compute(input);\n'.repeat(3334).slice(0, 100_000);
  t.add(js, Buffer.from(normal));
  const s = t.summary();
  assert.equal(t.languages.JavaScript.denseFiles, 1);
  assert.equal(s.denseFiles, 1);
  assert.equal(s.code, 2500 + countText(normal, js).code);
});

test('a file too big to read is counted from its size, not dropped', () => {
  const t = new LocTally();
  t.addBySize(js, 5 * 1024 * 1024);
  assert.equal(t.summary().code, Math.ceil((5 * 1024 * 1024) / 40));
  assert.equal(t.summary().denseFiles, 1);
  // Archive readers still offer an oversized entry (so it can be counted by size) but never hand over its content.
  const offered = [];
  const read = [];
  const p = new TarParser({ onEntry: (e) => (offered.push(e.path), true), onFile: (e) => read.push(e.path), maxFileBytes: 1024 });
  p.push(new Uint8Array(tar([{ path: 'top/big.js', content: 'x'.repeat(4096) }, { path: 'top/small.js', content: 'y();\n' }])));
  assert.deepEqual(offered, ['top/big.js', 'top/small.js']);
  assert.deepEqual(read, ['top/small.js']);
});

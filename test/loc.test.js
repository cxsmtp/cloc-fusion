import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countText, selectFiles, LocTally } from '../src/loc.js';
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

// Security regressions: each test pins one protection from SECURITY.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeRepo, gitEnv, safeBranch } from '../src/git.js';
import { buildReport } from '../src/scan.js';
import { normalizeConfig, redactConfig } from '../src/config.js';
import { toHtml } from '../src/report/html.js';
import { toCsv } from '../src/report/csv.js';
import { toMarkdown } from '../src/report/text.js';
import { ApiClient } from '../src/http.js';

test('clone URLs cannot inject git options or use other transports', async (t) => {
  const work = await mkdtemp(join(tmpdir(), 'cf-sec-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  const base = { name: 'x', connection: 'c' };
  await assert.rejects(analyzeRepo({ ...base, cloneUrl: '--upload-pack=touch /tmp/pwned' }, { workDir: work }), /not a clone URL/);
  await assert.rejects(analyzeRepo({ ...base, cloneUrl: 'ext::sh -c touch% /tmp/pwned' }, { workDir: work }), /not a clone URL|unsupported/);
  await assert.rejects(analyzeRepo({ ...base, cloneUrl: 'ssh://host/repo.git' }, { workDir: work }), /unsupported clone URL scheme/);
  await assert.rejects(analyzeRepo({ ...base, cloneUrl: 'https://evil.test/r.git' }, { workDir: work, allowedHosts: (h) => h === 'github.com' }), /refusing to clone from evil\.test/);
  await assert.rejects(analyzeRepo({ ...base, cloneUrl: 'https://github.com/a/b.git', defaultBranch: '--upload-pack=x' }, { workDir: work, allowedHosts: () => true }), /unsafe branch name/);
});

test('branch names are validated', () => {
  assert.equal(safeBranch('main'), 'main');
  assert.equal(safeBranch('release/2026.10'), 'release/2026.10');
  for (const bad of ['-x', 'a..b', 'a b', 'a~1', 'x.lock', 'a\nb', '/a']) assert.throws(() => safeBranch(bad), /unsafe/);
});

test('the git auth header is scoped to the repository origin and protocols are restricted', () => {
  const env = gitEnv('Basic abc', { origin: 'https://github.com', base: { PATH: '/bin', GIT_SSH_COMMAND: 'evil' } });
  const keys = Object.keys(env).filter((k) => k.startsWith('GIT_CONFIG_KEY_')).map((k) => env[k]);
  assert.ok(keys.includes('http.https://github.com/.extraHeader'));
  assert.ok(!keys.includes('http.extraHeader'));
  assert.equal(env.GIT_ALLOW_PROTOCOL, 'https');
  assert.equal(env.GIT_SSH_COMMAND, undefined);
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
});

test('a crafted report file cannot pollute prototypes', () => {
  const cfg = normalizeConfig({});
  const repos = [{ fullName: 'a', connection: 'c', org: 'o', analyzedAt: 'x', loc: 1, languages: JSON.parse('{"__proto__":{"category":"code","files":1,"code":1,"comment":0,"blank":0}}') }];
  buildReport(cfg, repos);
  assert.equal({}.repos, undefined);
  assert.equal(Object.prototype.files, undefined);
});

test('reports escape repository data and drop non-http links', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const report = buildReport(normalizeConfig({}), [{ fullName: evil, name: evil, org: evil, connection: 'c', provider: 'github', webUrl: 'javascript:alert(1)', analyzedAt: 'x', loc: 10, mainLanguage: evil, commits: 0 }]);
  const html = toHtml(report);
  assert.ok(!html.includes(evil));
  assert.ok(!html.includes('javascript:alert'));
  assert.ok(!html.includes('</script><img'));
  assert.match(toCsv({ settings: { fusion: { models: [] } }, repos: [{ fullName: '@SUM(A1)', provider: 'x' }] }), /'@SUM/);
  assert.ok(!toMarkdown(report).includes('<img'));
});

test('secrets never reach the report settings', () => {
  const cfg = normalizeConfig({ connections: [{ name: 'g', provider: 'github', auth: { method: 'pat', username: 'u', token: { value: 'ghp_SECRET' } } }] });
  assert.ok(!JSON.stringify(redactConfig(cfg)).includes('ghp_SECRET'));
  const report = buildReport(cfg, []);
  assert.ok(!JSON.stringify(report).includes('ghp_SECRET'));
});

test('an oversized API answer is refused, not buffered', async () => {
  const big = new ReadableStream({
    start(c) {
      const chunk = new Uint8Array(1024 * 1024).fill(32);
      for (let i = 0; i < 70; i++) c.enqueue(chunk);
      c.close();
    },
  });
  const api = new ApiClient({ name: 'X', baseUrl: 'https://api.test', retries: 0, fetchImpl: async () => new Response(big, { status: 200 }) });
  await assert.rejects(api.get('/huge'), /larger than 64 MB/);
});

test('http redirects never downgrade from https', async () => {
  const api = new ApiClient({ name: 'X', baseUrl: 'https://api.test', retries: 0, fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://api.test/plain' } }) });
  await assert.rejects(api.get('/x'), /refusing a redirect/);
});

test('git never follows redirects and never sends credentials over plain http', async (t) => {
  const env = gitEnv('Basic abc', { origin: 'https://gitlab.acme.test' });
  const pairs = Object.fromEntries(Object.keys(env).filter((k) => k.startsWith('GIT_CONFIG_KEY_')).map((k) => [env[k], env[k.replace('KEY', 'VALUE')]]));
  assert.equal(pairs['http.followRedirects'], 'false');
  const work = await mkdtemp(join(tmpdir(), 'cf-sec-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  await assert.rejects(analyzeRepo({ name: 'x', connection: 'c', cloneUrl: 'http://github.com/a/b.git' }, { workDir: work, authHeader: 'Basic x', allowedHosts: () => true }), /plain http/);
});

test('clone URLs holding credentials are refused at load time', () => {
  assert.throws(() => normalizeConfig({ connections: [{ name: 'g', provider: 'generic', repos: ['https://user:tok@git.acme.test/r.git'] }] }), /holds credentials/);
});

test('CSV guard has no numeric-prefix bypass', () => {
  const csv = toCsv({ settings: { fusion: { models: [] } }, repos: [{ fullName: "-2+3+cmd|' /C calc'!A0", provider: 'x' }, { fullName: '-12.5', provider: 'x' }] });
  assert.match(csv, /'-2\+3\+cmd/);
  assert.match(csv, /,-12\.5,/);
});

test('hostile path lengths are skipped before any glob runs', async () => {
  const { makeSelector } = await import('../src/loc.js');
  const select = makeSelector({ exclude: ['**/test/**/*.js'] });
  const t0 = performance.now();
  assert.equal(select(`${'test/'.repeat(20000)}x.js`), null);
  assert.ok(performance.now() - t0 < 50);
  assert.ok(select('src/app.js'));
});

test('the HTML report script renders rows with safe links (run in a stub DOM)', async () => {
  const vm = await import('node:vm');
  const report = buildReport(normalizeConfig({}), [
    { fullName: 'acme/api', name: 'api', org: 'acme', connection: 'c', provider: 'github', webUrl: 'https://github.com/acme/api', analyzedAt: 'x', loc: 10, commits: 3, weekly: [0, 1, 2] },
    { fullName: 'acme/evil', name: 'evil', org: 'acme', connection: 'c', provider: 'github', webUrl: 'javascript:alert(1)', analyzedAt: 'x', loc: 5, commits: 0 },
  ]);
  const html = toHtml(report);
  const data = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  const script = html.match(/<script id="app">\n([\s\S]*?)<\/script>/)[1];
  const el = () => ({ value: '', textContent: '', hidden: false, innerHTML: '', addEventListener() {}, setAttribute() {}, dataset: {} });
  const els = { data: { textContent: data }, q: el(), fq: el(), st: el(), count: el(), more: el(), all: el() };
  const tbody = el();
  const document = { getElementById: (id) => els[id], querySelector: (sel) => (sel === '#repos tbody' ? tbody : null), querySelectorAll: () => [] };
  vm.runInNewContext(script, { document, Intl, JSON, Math, Number, String, setTimeout, clearTimeout });
  assert.match(tbody.innerHTML, /<a href="https:\/\/github\.com\/acme\/api" target="_blank" rel="noopener">acme\/api<\/a>/);
  assert.ok(!tbody.innerHTML.includes('javascript:'));
  assert.match(tbody.innerHTML, />acme\/evil</);
  assert.match(els.count.textContent, /2 of 2/);
});

test("a download's Accept header wins over the client's default media type", async () => {
  const seen = [];
  const api = new ApiClient({ name: 'X', baseUrl: 'https://api.test', headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer t' }, retries: 0, fetchImpl: async (url, init) => (seen.push(init.headers.Accept), new Response('x', { status: 200 })) });
  await api.send('/asset', { accept: 'application/octet-stream' });
  await api.get('/json').catch(() => {});
  assert.deepEqual(seen, ['application/octet-stream', 'application/vnd.github+json']);
});

test('a GitHub host that is not a plain host name never reaches the gh command line (Windows shell)', async () => {
  const { cliBrowserLogin } = await import('../src/auth.js');
  for (const apiUrl of ['https://ghe.acme.test&calc.exe/api/v3', 'https://a$(id).test/api/v3', 'https://x|y.test/']) {
    let host;
    try {
      host = new URL(apiUrl).host;
    } catch {
      continue; // the URL parser already refuses it
    }
    if (/^[a-z0-9.-]+(:\d+)?$/i.test(host)) continue;
    await assert.rejects(cliBrowserLogin('gh', { apiUrl }), /not a valid GitHub host/);
  }
});

test('the token page link is only ever an http(s) URL', async () => {
  const { tokenPageUrl } = await import('../src/tokenpages.js');
  assert.equal(tokenPageUrl({ provider: 'github', apiUrl: 'https://ghe.acme.test/api/v3' }), 'https://ghe.acme.test/settings/tokens/new?scopes=repo,read:org&description=cloc-fusion');
  for (const apiUrl of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
    assert.equal(tokenPageUrl({ provider: 'github', apiUrl }), '', apiUrl);
    assert.equal(tokenPageUrl({ provider: 'bitbucket-server', apiUrl }), '', apiUrl);
  }
});

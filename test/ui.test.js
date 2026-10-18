// The web app's local server, and the HTML report's "Tune the plan" against the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { request } from 'node:http';
import { startUi } from '../src/ui/server.js';
import { UI_DEFAULTS } from '../src/ui/defaults.js';
import { saveToken, savedToken } from '../src/credentials.js';
import { buildReport, reprice } from '../src/scan.js';
import { normalizeConfig } from '../src/config.js';
import { toHtml } from '../src/report/html.js';

/** A raw request, so the Host header can be anything. */
function call(url, { method = 'GET', headers = {}, body } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers } }, (res) => {
      let text = '';
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

async function withUi(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'cf-ui-'));
  const home = process.env.CLOC_FUSION_HOME;
  process.env.CLOC_FUSION_HOME = join(dir, 'home');
  const ui = await startUi({ configFile: join(dir, 'cloc-fusion.config.json'), outDir: join(dir, 'out'), port: 0, open: false, log: () => {} });
  try {
    await fn(ui, dir);
  } finally {
    await ui.close();
    if (home === undefined) delete process.env.CLOC_FUSION_HOME;
    else process.env.CLOC_FUSION_HOME = home;
    await rm(dir, { recursive: true, force: true });
  }
}

test('the web app listens on 127.0.0.1 only, and refuses other hosts and calls without its key', async () => {
  await withUi(async (ui) => {
    const u = new URL(ui.url);
    assert.equal(u.hostname, '127.0.0.1');
    const page = await call(ui.url);
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /default-src 'none'/);
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    // DNS rebinding: a page on another name that resolves here is refused.
    assert.equal((await call(ui.url, { headers: { host: `evil.test:${u.port}` } })).status, 403);
    assert.equal((await call(`${ui.url}api/state`)).status, 403);
    assert.equal((await call(`${ui.url}api/state`, { headers: { 'x-cf-key': 'wrong' } })).status, 403);
    assert.equal((await call(`${ui.url}report.json?k=wrong`)).status, 403);
    // A form post from another site cannot send JSON with the key.
    assert.equal((await call(`${ui.url}api/config`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: {} })).status, 403);
  });
});

test('the web app starts from the default settings, and saves without exposing tokens', async () => {
  await withUi(async (ui, dir) => {
    const key = { 'x-cf-key': ui.key };
    const s = (await call(`${ui.url}api/state`, { headers: key })).json();
    assert.equal(s.configExists, false);
    assert.deepEqual(s.config.fusion.models.map((m) => [m.name, m.creditsPer10k]), UI_DEFAULTS.fusion.models.map((m) => [m.name, m.creditsPer10k]));
    assert.equal(s.config.totals.extraPercent, 20);
    assert.equal(s.config.totals.bundleCredits, 10000);
    assert.equal(s.config.windowDays, 365);
    assert.deepEqual(s.config.connections.map((c) => [c.name, c.provider, c.auth.method]), [['cxsmtp-git', 'github', 'gh-cli']]);

    const config = structuredClone(s.config);
    config.connections.push({ name: 'gl', provider: 'gitlab', orgs: ['acme'], auth: { method: 'pat', token: { value: 'glpat-secret' } } });
    config.fusion.byFrequency = { 'more-5-week': { scans: 52, model: 'model-2' } };
    const saved = (await call(`${ui.url}api/config`, { method: 'POST', headers: key, body: { config } })).json();
    assert.equal(saved.configExists, true);
    const back = saved.config.connections.find((c) => c.name === 'gl');
    assert.notEqual(back.auth.token.value, 'glpat-secret');
    // Saving the masked copy again keeps the real token.
    await call(`${ui.url}api/config`, { method: 'POST', headers: key, body: { config: saved.config } });
    const file = JSON.parse(await readFile(join(dir, 'cloc-fusion.config.json'), 'utf8'));
    assert.equal(file.connections.find((c) => c.name === 'gl').auth.token.value, 'glpat-secret');
    assert.equal(file.fusion.byFrequency['more-5-week'].model, 'model-2');
    // Settings that do not check out are refused, and nothing is written.
    const bad = await call(`${ui.url}api/config`, { method: 'POST', headers: key, body: { config: { ...config, connections: [{ name: '', provider: 'nope' }] } } });
    assert.equal(bad.status, 400);
  });
});

test('sign-in options: a token page with the right scopes, for saved and unsaved connections', async () => {
  await withUi(async (ui) => {
    const key = { 'x-cf-key': ui.key };
    const gh = (await call(`${ui.url}api/connection/signin`, { method: 'POST', headers: key, body: { connection: { provider: 'github', orgs: [] } } })).json();
    assert.equal(gh.tokenUrl, 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=cloc-fusion');
    const ghe = (await call(`${ui.url}api/connection/signin`, { method: 'POST', headers: key, body: { connection: { provider: 'github', apiUrl: 'https://ghe.acme.test/api/v3' } } })).json();
    assert.match(ghe.tokenUrl, /^https:\/\/ghe\.acme\.test\/settings\/tokens\/new/);
    const ado = (await call(`${ui.url}api/connection/signin`, { method: 'POST', headers: key, body: { connection: { provider: 'azure', orgs: ['contoso'] } } })).json();
    assert.equal(ado.tokenUrl, 'https://dev.azure.com/contoso/_usersSettings/tokens');
    assert.equal(ado.device, false);
  });
});

test('tokens saved from the page are owner-only and kept out of the settings file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cf-cred-'));
  const home = process.env.CLOC_FUSION_HOME;
  process.env.CLOC_FUSION_HOME = dir;
  try {
    await saveToken('gh', 'ghp_x');
    assert.equal(await savedToken('gh'), 'ghp_x');
    assert.equal(await savedToken('__proto__'), '');
    if (process.platform !== 'win32') assert.equal((await stat(join(dir, 'credentials.json'))).mode & 0o777, 0o600);
    await saveToken('gh', '');
    assert.equal(await savedToken('gh'), '');
  } finally {
    if (home === undefined) delete process.env.CLOC_FUSION_HOME;
    else process.env.CLOC_FUSION_HOME = home;
    await rm(dir, { recursive: true, force: true });
  }
});

// ---- The report's "Tune the plan" -------------------------------------------------------------

function fakeDom(data) {
  const els = {};
  const el = (id) =>
    els[id] ||
    (els[id] = {
      id,
      innerHTML: '',
      textContent: id === 'data' ? data : '',
      value: '',
      hidden: false,
      dataset: {},
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      setAttribute() {},
      removeAttribute() {},
      querySelector: () => null,
      querySelectorAll: () => [],
    });
  const tbody = el('tbody');
  return {
    els,
    document: {
      documentElement: el('html'),
      body: el('body'),
      getElementById: (id) => el(id),
      querySelector: (sel) => (sel === '#repos tbody' ? tbody : null),
      querySelectorAll: () => [],
      createElement: () => el(`new-${Math.random()}`),
    },
  };
}

test('the HTML report recomputes credits in the page exactly as the engine does', async () => {
  const cfg = normalizeConfig({ ...structuredClone(UI_DEFAULTS), connections: [] });
  const repos = Array.from({ length: 60 }, (_, i) => ({ provider: 'github', connection: 'c', org: `o${i % 3}`, name: `r${i}`, fullName: `o${i % 3}/r${i}`, analyzedAt: 'x', loc: 1000 + i * 7919, commits: (i * 37) % 700 }));
  const report = buildReport(cfg, repos);
  const html = toHtml(report);
  const data = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  const script = html.match(/<script id="app">\n([\s\S]*?)<\/script>/)[1];
  const key = script.match(/var BASE=(\{.*?\}),T=null;/)[1];
  const base = JSON.parse(key);

  // What a customer picked on the page: opus for the busiest, criticality 5 → 52 scans on opus,
  // one repository made criticality 5, one pinned to haiku, one at 3 scans, 18 months, 10% extra.
  const picked = { period: 18, combine: 'higher', def: 'model-1', defScans: 1, extra: 10, bundle: 5000, models: base.models, freq: {}, crit: {}, repo: { 'o0/r0': { c: 5 }, 'o1/r1': { m: 'model-1' }, 'o2/r2': { s: 3 } } };
  for (const f of base.freqs) picked.freq[f.id] = { s: null, m: f.id === 'more-5-week' ? 'model-2' : null };
  for (const c of base.crits) picked.crit[c] = c === 5 ? { s: 52, m: 'model-2' } : { s: null, m: null };
  const store = { [`cf-tune:${base.key}`]: JSON.stringify(picked) };
  const W = { localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] } };
  const { document, els } = fakeDom(data);
  vm.runInNewContext(script, { document, window: W, Intl, JSON, Math, Number, String, Object, Array, Boolean, Date, setTimeout, clearTimeout, isFinite });
  const pageTotal = els['tune-kpis'].innerHTML.match(/<b>([\d,.]+)<\/b>/)[1];

  const engine = reprice(report, {
    fusion: { ...cfg.fusion, periodMonths: 18, byFrequency: { 'more-5-week': { model: 'model-2' } }, byCriticality: { 5: { scans: 52, model: 'model-2' } } },
    totals: { extraPercent: 10, bundleCredits: 5000 },
    overrides: { 'o0/r0': { criticality: 5 }, 'o1/r1': { model: 'model-1' }, 'o2/r2': { scans: 3 } },
  });
  assert.equal(pageTotal, engine.credits.total.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  assert.notEqual(engine.credits.total, report.credits.total);
  assert.match(els['hero-pills'].innerHTML, new RegExp(`${engine.credits.bundles.toLocaleString('en-US')} bundles of 5,000`));
  // The repository table offers the model, scans and criticality per repository.
  assert.match(els.tbody.innerHTML, /data-pick="m"/);
  assert.match(els.tbody.innerHTML, /data-pick="s"/);
  assert.match(els.tbody.innerHTML, /data-pick="c"/);
  // Names typed into the page are escaped.
  const evil = buildReport(normalizeConfig({ fusion: { models: [{ id: 'x', name: '<img src=x onerror=alert(1)>', creditsPer10k: 1 }] } }), repos.slice(0, 2));
  const h2 = toHtml(evil);
  const dom2 = fakeDom(h2.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  vm.runInNewContext(h2.match(/<script id="app">\n([\s\S]*?)<\/script>/)[1], { document: dom2.document, window: {}, Intl, JSON, Math, Number, String, Object, Array, Boolean, Date, setTimeout, clearTimeout, isFinite });
  assert.ok(!dom2.els['tune-models'].innerHTML.includes('<img'));
  assert.ok(!dom2.els.tbody.innerHTML.includes('<img'));
  assert.ok(!h2.includes('<img src=x'));
});

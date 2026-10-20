// The web app: a small server on this machine (127.0.0.1 only) that serves one page and runs what a
// browser can't: platform sign-in (CLI browser login, OAuth device flow), connection tests, and the
// scan itself, with live progress over server-sent events.
//
// Locked down: it listens on the loopback interface only; it answers only requests whose Host is
// itself (no DNS rebinding); every API call must carry a random per-run key that only the page
// knows (other sites can neither read the page nor send the custom header); bodies are capped.
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { normalizeConfig, saveConfig, loadConfig } from '../config.js';
import { PROVIDERS, providerOf } from '../providers/index.js';
import { connect, scan, reprice, chooseEngine } from '../scan.js';
import { writeReports } from '../report/index.js';
import { VERSION } from '../version.js';
import { saveToken } from '../credentials.js';
import { hasTool, tokenPageUrl, deviceFlowOf, deviceFlow, cliBrowserLogin } from '../auth.js';
import { suggestedScans, FREQUENCIES, CRITICALITIES } from '../fusion.js';
import { UI_DEFAULTS } from './defaults.js';
import { uiPage } from './page.js';

const MAX_BODY = 1024 * 1024;
const MASK = '••••••••';

/** Connection auth with stored secret values hidden (the page never sees a token). */
function maskConfig(cfg) {
  return {
    ...cfg,
    connections: (cfg.connections || []).map((c) => (c.auth?.token?.value ? { ...c, auth: { ...c.auth, token: { value: MASK } } } : c)),
  };
}

/** The page's configuration with hidden secrets restored from the current one. */
function unmaskConfig(next, current) {
  const byName = new Map((current.connections || []).map((c) => [c.name, c]));
  return {
    ...next,
    connections: (next.connections || []).map((c) => (c.auth?.token?.value === MASK ? { ...c, auth: { ...c.auth, token: byName.get(c.name)?.auth?.token } } : c)),
  };
}

/** The token method each platform uses for a token saved from the page. */
function pastedMethod(provider, username) {
  return { github: 'pat', gitlab: 'pat', azure: 'pat', bitbucket: username ? 'api-token' : 'access-token', 'bitbucket-server': 'http-token', generic: username ? 'basic' : 'bearer' }[provider] || 'pat';
}

function summarize(report) {
  if (!report) return null;
  return {
    generatedAt: report.generatedAt,
    version: report.version,
    partial: report.partial,
    durationSeconds: report.durationSeconds,
    counts: report.counts,
    totals: report.totals,
    credits: report.credits,
    developers: report.developers,
    byFrequency: report.byFrequency,
    periodMonths: report.settings?.fusion?.periodMonths,
    top: (report.repos || [])
      .filter((r) => r.included && r.units)
      .sort((a, b) => (b.credits || 0) - (a.credits || 0))
      .slice(0, 8)
      .map((r) => ({ name: r.fullName, loc: r.lines ?? r.loc, perWeek: r.commitsPerWeek, frequency: r.frequencyLabel, scans: r.scans, credits: r.credits })),
  };
}

export async function startUi({ configFile, outDir, port = 4747, open = true, log = () => {} } = {}) {
  configFile = resolve(configFile || 'cloc-fusion.config.json');
  outDir = resolve(outDir || join(dirname(configFile), 'cloc-fusion-output'));
  const key = randomBytes(24).toString('hex');
  // Compared in constant time, so the key can't be guessed from response timings.
  const keyOk = (given) => typeof given === 'string' && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key));
  let config;
  let configExists = existsSync(configFile);
  try {
    config = configExists ? await loadConfig(configFile) : normalizeConfig(structuredClone(UI_DEFAULTS));
  } catch (err) {
    log(`Could not read ${configFile} (${err.message}); starting from the default settings.`);
    config = normalizeConfig(structuredClone(UI_DEFAULTS));
    configExists = false;
  }
  let lastReport = null;
  try {
    lastReport = JSON.parse(await readFile(join(outDir, 'cloc-fusion-report.json'), 'utf8'));
  } catch {}
  const tools = { gh: await hasTool('gh'), az: await hasTool('az') };
  const engine = await chooseEngine(config.engine === 'git' ? 'auto' : config.engine).catch(() => 'api');

  // Live events (scan progress, sign-in steps) to every open page.
  const clients = new Set();
  const emit = (type, data) => {
    const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  };

  let job = null; // the running or last scan
  const authJobs = new Map();

  const signInOptions = (conn) => ({
    gh: conn.provider === 'github' && tools.gh,
    az: conn.provider === 'azure' && tools.az && !/^https?:\/\/(?!dev\.azure\.com)/.test(conn.apiUrl || ''),
    device: Boolean(deviceFlowOf(conn)),
    tokenUrl: tokenPageUrl(conn),
  });

  const providersMeta = PROVIDERS.map((p) => ({ id: p.id, label: p.label, defaultApiUrl: p.defaultApiUrl, apiUrlHint: p.apiUrlHint, orgNoun: p.orgNoun, authMethods: p.authMethods.map((m) => ({ id: m.id, label: m.label, needsUsername: m.needsUsername || null, help: m.help, browser: Boolean(m.tokenCommand) })) }));

  const state = () => ({
    version: VERSION,
    configFile,
    configExists,
    outDir,
    engine,
    tools,
    config: maskConfig(config),
    providers: providersMeta,
    frequencies: FREQUENCIES.map((f) => ({ id: f.id, label: f.label, suggested: suggestedScans(f.id, config.fusion.periodMonths) })),
    criticalities: CRITICALITIES,
    signIn: Object.fromEntries(config.connections.map((c) => [c.name, signInOptions(c)])),
    report: summarize(lastReport),
    scan: job && { running: job.running, done: job.done, total: job.total, current: job.current, phase: job.phase, log: job.log.slice(-200), error: job.error, summary: job.summary },
  });

  async function testConnection(conn) {
    try {
      const session = await withTimeout(connect(conn), 30000);
      let orgs = [];
      if (conn.provider !== 'generic') orgs = await withTimeout(session.provider.listOrgs(session.api, conn), 30000).catch(() => []);
      return { ok: true, who: session.who || 'signed in', orgs };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async function persist(next) {
    config = normalizeConfig(next);
    await saveConfig(configFile, config);
    configExists = true;
  }

  function startScan({ limit = 0 } = {}) {
    if (job?.running) throw Object.assign(new Error('a scan is already running'), { status: 409 });
    const controller = new AbortController();
    job = { running: true, done: 0, total: 0, current: '', phase: 'discovering', log: [], controller, error: null, summary: null };
    const j = job;
    const push = (line) => {
      j.log.push(String(line).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, ''));
      if (j.log.length > 2000) j.log.splice(0, 1000);
      emit('log', { line: j.log[j.log.length - 1] });
    };
    let last = 0;
    (async () => {
      try {
        const report = await scan(config, {
          limit,
          outDir,
          signal: controller.signal,
          log: push,
          progress: (p) => {
            Object.assign(j, { done: p.done, total: p.total, current: p.current || j.current, phase: p.phase || (p.done === p.total ? 'finishing' : 'measuring') });
            if (Date.now() - last > 120 || p.done === p.total) {
              last = Date.now();
              emit('progress', { done: j.done, total: j.total, current: j.current, phase: j.phase });
            }
          },
        });
        await writeReports(report, outDir);
        lastReport = report;
        j.summary = summarize(report);
        push(`Done: ${report.counts.measured} repositories measured${report.partial ? ' (stopped early)' : ''}.`);
        emit('done', { summary: j.summary });
      } catch (err) {
        j.error = err.message;
        push(`Error: ${err.message}`);
        emit('failed', { error: err.message });
      } finally {
        j.running = false;
      }
    })();
  }

  function startAuth(conn, method) {
    const id = randomBytes(8).toString('hex');
    const controller = new AbortController();
    const a = { id, connection: conn.name, method, status: 'starting', userCode: null, verificationUri: null, error: null, who: null, controller };
    authJobs.set(id, a);
    const update = (patch) => {
      Object.assign(a, patch);
      emit('auth', publicAuth(a));
    };
    (async () => {
      try {
        let auth;
        if (method === 'device') {
          const flow = deviceFlowOf(conn);
          const token = await deviceFlow(flow, { signal: controller.signal, onCode: (c) => update({ status: 'code', ...c }) });
          await saveToken(conn.name, token, { via: 'device' });
          auth = { method: 'pat', token: { saved: true } };
        } else if (method === 'gh' || method === 'az') {
          update({ status: 'waiting' });
          await cliBrowserLogin(method, conn, { signal: controller.signal, onCode: (c) => update({ status: 'code', userCode: c.userCode || a.userCode, verificationUri: c.verificationUri || a.verificationUri }) });
          auth = method === 'gh' ? { method: 'gh-cli' } : { method: 'entra' };
        } else throw new Error(`unknown sign-in method ${method}`);
        const next = { ...config, connections: config.connections.map((c) => (c.name === conn.name ? { ...c, auth } : c)) };
        await persist(next);
        const test = await testConnection(config.connections.find((c) => c.name === conn.name));
        update(test.ok ? { status: 'done', who: test.who, orgs: test.orgs } : { status: 'error', error: test.error });
      } catch (err) {
        update({ status: 'error', error: err.message });
      }
    })();
    return publicAuth(a);
  }
  const publicAuth = (a) => ({ id: a.id, connection: a.connection, method: a.method, status: a.status, userCode: a.userCode, verificationUri: a.verificationUri, error: a.error, who: a.who, orgs: a.orgs });

  const routes = {
    'GET /api/state': async () => state(),
    'POST /api/config': async (body) => {
      const next = unmaskConfig(body.config || {}, config);
      try {
        await persist(next);
      } catch (err) {
        throw Object.assign(err, { status: 400 });
      }
      return state();
    },
    'POST /api/connection/test': async (body) => {
      const given = unmaskConfig({ connections: [body.connection] }, config).connections[0];
      return testConnection(normalizeConfig({ connections: [given] }).connections[0]);
    },
    'POST /api/connection/signin': async (body) => {
      const c = body.connection || {};
      return signInOptions({ provider: String(c.provider || ''), apiUrl: typeof c.apiUrl === 'string' ? c.apiUrl : '', orgs: Array.isArray(c.orgs) ? c.orgs.map(String) : [], oauth: c.oauth && typeof c.oauth.clientId === 'string' ? { clientId: c.oauth.clientId } : undefined });
    },
    'POST /api/connection/status': async () => {
      const out = {};
      await Promise.all(config.connections.map(async (c) => (out[c.name] = await testConnection(c))));
      return out;
    },
    'POST /api/auth/start': async (body) => {
      const conn = config.connections.find((c) => c.name === body.connection);
      if (!conn) throw Object.assign(new Error('save the connection first'), { status: 400 });
      return startAuth(conn, body.method);
    },
    'POST /api/auth/cancel': async (body) => {
      authJobs.get(body.id)?.controller.abort();
      return { ok: true };
    },
    'POST /api/auth/token': async (body) => {
      const conn = config.connections.find((c) => c.name === body.connection);
      if (!conn) throw Object.assign(new Error('save the connection first'), { status: 400 });
      const token = String(body.token || '').trim();
      if (!token || token.length > 4096 || /\s/.test(token)) throw Object.assign(new Error('paste the token (one line, no spaces)'), { status: 400 });
      const username = String(body.username || '').trim().slice(0, 254);
      await saveToken(conn.name, token, { via: 'pasted' });
      const auth = { method: pastedMethod(conn.provider, username), token: { saved: true }, ...(username ? { username } : {}) };
      await persist({ ...config, connections: config.connections.map((c) => (c.name === conn.name ? { ...c, auth } : c)) });
      return testConnection(config.connections.find((c) => c.name === conn.name));
    },
    'POST /api/auth/signout': async (body) => {
      await saveToken(String(body.connection || ''), '');
      return { ok: true };
    },
    'POST /api/scan': async (body) => {
      startScan({ limit: Math.max(0, Math.floor(Number(body.limit) || 0)) });
      return { started: true };
    },
    'POST /api/scan/stop': async () => {
      job?.controller.abort();
      return { stopping: Boolean(job?.running) };
    },
    'POST /api/price': async (body) => {
      if (!lastReport) return { report: null };
      const priced = reprice(lastReport, { fusion: body.fusion || config.fusion, totals: body.totals || config.totals, overrides: body.overrides && typeof body.overrides === 'object' ? normalizeConfig({ overrides: body.overrides }).overrides : config.overrides });
      return { report: summarize(priced) };
    },
  };

  const hostsOk = (req, actualPort) => [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(String(req.headers.host || '').toLowerCase());

  const server = http.createServer(async (req, res) => {
    const actualPort = server.address().port;
    const send = (status, body, type = 'application/json; charset=utf-8', extra = {}) => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
      res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
    };
    try {
      if (!hostsOk(req, actualPort)) return send(403, { error: 'forbidden host' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/') {
        // The page's one script runs by a nonce made for this response; no other script can.
        const nonce = randomBytes(16).toString('base64');
        return send(200, uiPage({ key, version: VERSION, nonce }), 'text/html; charset=utf-8', { 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` });
      }
      const reportFile = { '/report': ['cloc-fusion-report.html', 'text/html; charset=utf-8'], '/report.csv': ['cloc-fusion-report.csv', 'text/csv; charset=utf-8'], '/report.json': ['cloc-fusion-report.json', 'application/json'], '/report.md': ['cloc-fusion-report.md', 'text/markdown; charset=utf-8'], '/contributors.csv': ['cloc-fusion-contributors.csv', 'text/csv; charset=utf-8'] }[url.pathname];
      if (req.method === 'GET' && reportFile) {
        if (!keyOk(url.searchParams.get('k'))) return send(403, { error: 'forbidden' });
        const path = join(outDir, reportFile[0]);
        if (!(await stat(path).catch(() => null))) return send(404, { error: 'no report yet: run a scan' });
        const disposition = reportFile[0].endsWith('.html') ? {} : { 'Content-Disposition': `attachment; filename="${reportFile[0]}"` };
        return send(200, await readFile(path), reportFile[1], disposition);
      }
      if (url.pathname === '/api/events' && req.method === 'GET') {
        if (!keyOk(url.searchParams.get('k'))) return send(403, { error: 'forbidden' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(': connected\n\n');
        clients.add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 25000);
        req.on('close', () => {
          clearInterval(ping);
          clients.delete(res);
        });
        return;
      }
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) return send(404, { error: 'not found' });
      if (!keyOk(req.headers['x-cf-key'])) return send(403, { error: 'forbidden' });
      let body = {};
      if (req.method === 'POST') {
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(415, { error: 'JSON only' });
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY) return send(413, { error: 'too large' });
          chunks.push(chunk);
        }
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      }
      return send(200, await route(body));
    } catch (err) {
      return send(err.status || 500, { error: err.message });
    }
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && port !== 0) {
        server.listen(0, '127.0.0.1', resolveListen); // the usual port is taken: any free one
      } else reject(err);
    });
    server.listen(port, '127.0.0.1', resolveListen);
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  if (open) openBrowser(url);
  return {
    url,
    key,
    close: () =>
      new Promise((r) => {
        for (const c of clients) c.end();
        job?.controller.abort();
        server.closeAllConnections?.();
        server.close(r);
      }),
  };
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([promise, new Promise((_, reject) => (t = setTimeout(() => reject(new Error('timed out')), ms)))]).finally(() => clearTimeout(t));
}

/** Open the page in the default browser (no shell: the URL is passed as an argument). */
export function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch {}
}


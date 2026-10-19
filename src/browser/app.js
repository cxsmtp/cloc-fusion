// The standalone page: cloc-fusion as one HTML file, opened straight from disk. It signs in to the
// platforms with a token, discovers and measures every repository from the browser
// (src/browser/engine.js), prices Fusion with the same code as the CLI, and builds the same report.
// Nothing is installed or hosted; tokens stay in this page's memory and are gone when it closes.
import { PROVIDERS, providerOf } from '../providers/index.js';
import { tokenPageUrl } from '../tokenpages.js';
import { overrideMatcher, buildReport, reprice } from '../report/build.js';
import { classifyRepos, dedupeRepos } from '../discover.js';
import { measureRepo } from './engine.js';
import { pool } from '../pool.js';
import { toHtml } from '../report/html.js';
import { toCsv } from '../report/csv.js';
import { FREQUENCIES, CRITICALITIES, suggestedScans } from '../fusion.js';
import { UI_DEFAULTS } from '../ui/defaults.js';
import { VERSION } from '../version.js';

const D = document;
const $ = (s) => D.querySelector(s);
const STORE = 'cloc-fusion:standalone';
const SUPPORTED = ['github', 'gitlab', 'azure', 'bitbucket', 'bitbucket-server'];
const PLATFORMS = PROVIDERS.filter((p) => SUPPORTED.includes(p.id));
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmt = (n, d = 0) => (n === null || n === undefined || n === '' || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }));
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const ICON = {
  plus: 'M12 5v14M5 12h14',
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M7 7h10v10H7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  key: 'M15 7a4 4 0 1 1-3.5 6L5 19.5V22H2v-3l7-7A4 4 0 0 1 15 7Z',
  report: 'M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14',
  upload: 'M12 20V9m0 0-4.5 4.5M12 9l4.5 4.5M5 5h14',
};
function icon(name) {
  const s = D.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'i');
  s.setAttribute('aria-hidden', 'true');
  const p = D.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICON[name]);
  s.append(p);
  return s;
}
// A tiny element builder: properties, events, and children as nodes or text (never HTML).
function h(tag, props, ...kids) {
  const el = D.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'disabled', 'hidden', 'selected', 'open'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : D.createTextNode(String(kid)));
  return el;
}
let toastTimer;
function toast(text, err = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = `toast show${err ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 4200);
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  D.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * A render that may be asked for again while it runs: replacing a focused field fires its change
 * handler, which renders again. The inner request waits for the outer render to finish.
 */
function guarded(fn) {
  let busy = false;
  let again = false;
  const run = () => {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      fn();
    } finally {
      busy = false;
    }
    if (again) {
      again = false;
      queueMicrotask(run);
    }
  };
  return run;
}

// ---------- settings ----------
/** The page's settings: the defaults, the file's own settings, or what was saved in this browser. */
function startingSettings() {
  const base = clone(UI_DEFAULTS);
  base.maxArchiveBytes = 1024 ** 3; // held in the page's memory
  base.concurrency = 6;
  for (const c of base.connections) c.auth = { method: 'pat' };
  try {
    const saved = JSON.parse(store.get(STORE) || 'null');
    if (saved && Array.isArray(saved.connections) && saved.fusion) return { ...base, ...saved };
  } catch {}
  return base;
}
let cfg = startingSettings();
const secrets = {}; // connection name → { token, username }, in memory only
const sessions = {}; // connection name → { provider, api, who }
const status = {}; // connection name → { state: 'checking'|'ok'|'bad', who, error, orgs }
const open = {};
let job = null; // { running, done, total, log, abort, current }
let report = null; // the last report
function save() {
  store.set(STORE, JSON.stringify(cfg));
}
function set(path, value) {
  let o = cfg;
  for (let i = 0; i < path.length - 1; i++) o = o[path[i]] ??= typeof path[i + 1] === 'number' ? [] : {};
  o[path[path.length - 1]] = value;
  save();
}
const get = (path) => path.reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), cfg);
const field = (label, control, note) => h('label', { class: 'field' }, h('span', null, label), control, note ? h('small', null, note) : null);
const num = (path, opts = {}) =>
  h('input', {
    type: 'number',
    min: opts.min ?? 0,
    max: opts.max,
    step: opts.step ?? 1,
    value: get(path) ?? '',
    placeholder: opts.placeholder,
    oninput: (e) => {
      set(path, e.target.value === '' ? null : Number(e.target.value));
      opts.after?.();
    },
  });
const toggle = (path, label, after) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: Boolean(get(path)), onchange: (e) => (set(path, e.target.checked), after?.()) }), label);
function seg(path, options, after) {
  const box = h('div', { class: 'seg', role: 'group' });
  const draw = () => box.replaceChildren(...options.map(([v, label]) => h('button', { type: 'button', class: get(path) === v ? 'on' : '', 'aria-pressed': String(get(path) === v), onclick: () => (set(path, v), draw(), after?.()) }, label)));
  draw();
  return box;
}
const methodOf = (conn) => (conn.provider === 'bitbucket' ? (secrets[conn.name]?.username ? 'api-token' : 'access-token') : conn.provider === 'bitbucket-server' ? 'http-token' : 'pat');

// ---------- connections ----------
async function signIn(conn, token, username) {
  const name = conn.name;
  if (!token) return toast('Paste the token first', true);
  status[name] = { state: 'checking' };
  renderConnections();
  try {
    secrets[name] = { token: token.trim(), username: (username || '').trim() };
    conn.auth = { method: methodOf(conn), ...(conn.provider === 'bitbucket' && username ? { username: username.trim() } : {}) };
    const provider = providerOf(conn.provider);
    const api = provider.client(conn, secrets[name]);
    let who;
    try {
      who = await provider.whoami(api, conn);
    } catch (err) {
      // Azure DevOps' profile service may refuse a web page: listing one organization's projects proves the token too.
      if (conn.provider !== 'azure' || !Array.isArray(conn.orgs) || !conn.orgs[0] || conn.orgs[0] === '@me') throw err;
      await api.get(`/${encodeURIComponent(conn.orgs[0])}/_apis/projects?$top=1&api-version=7.1`);
      who = 'signed in';
    }
    sessions[name] = { provider, api, who };
    status[name] = { state: 'ok', who };
    save();
    provider
      .listOrgs(api, conn)
      .then((orgs) => {
        if (status[name]?.state === 'ok') status[name].orgs = orgs;
        renderConnections();
      })
      .catch(() => {});
  } catch (err) {
    delete sessions[name];
    status[name] = { state: 'bad', error: /could not reach/.test(err.message) ? `${err.message}. The platform may not allow sign-in from a page opened from disk (CORS); use the cloc-fusion app for it.` : err.message };
  }
  renderConnections();
  renderPlan();
}
function signOut(conn) {
  delete secrets[conn.name];
  delete sessions[conn.name];
  delete status[conn.name];
  renderConnections();
  renderPlan();
}
function statusPill(name) {
  const st = status[name];
  if (st?.state === 'checking') return h('span', { class: 'status wait' }, 'Checking…');
  if (st?.state === 'ok') return h('span', { class: 'status ok' }, `Signed in${st.who ? ` as ${st.who}` : ''}`);
  if (st?.state === 'bad') return h('span', { class: 'status bad', title: st.error || '' }, 'Sign-in failed');
  return h('span', { class: 'status bad' }, 'Not signed in');
}
function orgsEditor(conn, i) {
  const p = providerOf(conn.provider);
  const all = conn.orgs === 'all';
  const list = Array.isArray(conn.orgs) ? conn.orgs : [];
  const input = h('input', {
    type: 'text',
    'data-focus': `orgs-${i}`,
    placeholder: list.length ? 'add another…' : `type ${/^[aeiou]/i.test(p.orgNoun) ? 'an' : 'a'} ${p.orgNoun} and press Enter`,
    onkeydown: (e) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const v = e.target.value.trim();
      if (v && !list.includes(v)) set(['connections', i, 'orgs'], [...list, v]);
      renderConnections();
    },
  });
  const found = status[conn.name]?.orgs || [];
  return h(
    'div',
    { class: 'field' },
    h('span', null, `${p.orgNoun}s to scan`),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: all, onchange: (e) => (set(['connections', i, 'orgs'], e.target.checked ? 'all' : []), renderConnections()) }), `Every ${p.orgNoun} this token can see`),
    all ? null : h('div', { class: 'tags' }, list.map((o) => h('span', { class: 'tag' }, o === '@me' ? 'my own' : o, h('button', { type: 'button', 'aria-label': `Remove ${o}`, onclick: () => (set(['connections', i, 'orgs'], list.filter((x) => x !== o)), renderConnections()) }, '×'))), input),
    !all && found.length
      ? h(
          'div',
          { class: 'pills' },
          h('small', { class: 'muted' }, 'Found: '),
          found.map((o) => {
            const on = list.includes(o.id);
            return h('button', { type: 'button', class: `pill-btn${on ? ' on' : ''}`, title: o.label, onclick: () => (set(['connections', i, 'orgs'], on ? list.filter((x) => x !== o.id) : [...list, o.id]), renderConnections()) }, o.id === '@me' ? 'My own repositories' : o.id);
          }),
        )
      : null,
  );
}
function signInPanel(conn) {
  const p = providerOf(conn.provider);
  const url = tokenPageUrl(conn);
  const needsUser = conn.provider === 'bitbucket';
  const user = h('input', { type: 'text', placeholder: 'Atlassian email (for an API token); empty for an access token', autocomplete: 'off', value: conn.auth?.username || '' });
  const tok = h('input', { type: 'password', placeholder: 'Paste the token', autocomplete: 'off', spellcheck: 'false', onkeydown: (e) => e.key === 'Enter' && signIn(conn, tok.value, user.value) });
  const scopes = { github: 'repo and read:org', gitlab: 'read_api and read_repository', azure: 'Code (Read)', bitbucket: 'read:repository, read:workspace, read:user', 'bitbucket-server': 'Project read and Repository read' }[conn.provider];
  return h(
    'div',
    { class: 'method' },
    h('h4', null, `Sign in to ${p.label.replace(/ \(.*/, '')}`),
    h('p', null, `Create a token with ${scopes}, then paste it here. It stays in this page's memory only: nothing is saved, and it is gone when you close the page.`),
    h('div', { class: 'row' }, url ? h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('ext'), 'Create a token') : null),
    needsUser ? user : null,
    tok,
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => signIn(conn, tok.value, user.value) }, icon('key'), 'Sign in'), status[conn.name]?.state === 'ok' ? h('button', { type: 'button', class: 'ghost', onclick: () => signOut(conn) }, 'Sign out') : null),
    status[conn.name]?.state === 'bad' ? h('div', { class: 'warn-box' }, status[conn.name].error) : null,
  );
}
const renderConnections = guarded(function renderConnections() {
  const box = $('#connections');
  // A focused field fires its change handler when it is removed: let it fire first, then put the
  // focus back on the same field in the new rendering.
  const active = box.contains(D.activeElement) ? D.activeElement : null;
  const refocus = active?.dataset?.focus;
  active?.blur();
  box.replaceChildren(
    ...cfg.connections.map((conn, i) => {
      const p = providerOf(conn.provider);
      const isOpen = open[i] ?? status[conn.name]?.state !== 'ok';
      const orgs = conn.orgs === 'all' ? `every ${p.orgNoun}` : Array.isArray(conn.orgs) && conn.orgs.length ? conn.orgs.map((o) => (o === '@me' ? 'my own repositories' : o)).join(', ') : `no ${p.orgNoun}s yet`;
      return h(
        'div',
        { class: `conn${status[conn.name]?.state === 'ok' ? ' ok' : ''}` },
        h(
          'div',
          { class: 'conn-top' },
          h('span', { class: 'badge' }, { github: 'GH', gitlab: 'GL', azure: 'AZ', bitbucket: 'BB', 'bitbucket-server': 'BS' }[conn.provider] || 'G'),
          h('div', { style: 'flex:1;min-width:180px' }, h('div', { class: 'conn-name' }, conn.name), h('div', { class: 'conn-sub' }, `${p.label} · ${orgs}`)),
          statusPill(conn.name),
          h('button', { type: 'button', class: 'sm', onclick: () => ((open[i] = !isOpen), renderConnections()) }, icon('edit'), isOpen ? 'Close' : 'Edit'),
          h('button', { type: 'button', class: 'sm danger', 'aria-label': 'Remove connection', onclick: () => (signOut(conn), cfg.connections.splice(i, 1), save(), renderConnections(), renderPlan()) }, icon('trash')),
        ),
        isOpen
          ? h(
              'div',
              { class: 'editor' },
              h(
                'div',
                { class: 'grid' },
                field('Name', h('input', { type: 'text', value: conn.name, onchange: (e) => {
                  const v = e.target.value.trim();
                  if (!v || cfg.connections.some((c, j) => j !== i && c.name === v)) return toast('Pick a unique name', true);
                  for (const m of [secrets, sessions, status]) if (m[conn.name]) (m[v] = m[conn.name]), delete m[conn.name];
                  set(['connections', i, 'name'], v);
                  renderConnections();
                } })),
                field('Platform', h('select', { onchange: (e) => (signOut(conn), set(['connections', i, 'provider'], e.target.value), set(['connections', i, 'apiUrl'], undefined), set(['connections', i, 'orgs'], []), renderConnections()) }, PLATFORMS.map((x) => h('option', { value: x.id, selected: x.id === conn.provider }, x.label)))),
                field('API address', h('input', { type: 'url', value: conn.apiUrl || '', placeholder: p.defaultApiUrl || 'https://bitbucket.example.com', onchange: (e) => (signOut(conn), set(['connections', i, 'apiUrl'], e.target.value.trim() || undefined), renderConnections()) }), p.apiUrlHint),
              ),
              orgsEditor(conn, i),
              signInPanel(conn),
            )
          : null,
      );
    }),
    h(
      'button',
      {
        type: 'button',
        onclick: () => {
          let n = cfg.connections.length + 1;
          while (cfg.connections.some((c) => c.name === `connection-${n}`)) n++;
          cfg.connections.push({ name: `connection-${n}`, provider: 'github', auth: { method: 'pat' }, orgs: [] });
          open[cfg.connections.length - 1] = true;
          save();
          renderConnections();
          renderPlan();
        },
      },
      icon('plus'),
      'Add a connection',
    ),
  );
  if (refocus) box.querySelector(`[data-focus="${refocus}"]`)?.focus();
});

// ---------- pricing ----------
const renderPricing = guarded(function renderPricing() {
  const f = cfg.fusion;
  f.models ||= [];
  const after = () => (renderPlan(), repriceNow());
  const defaultName = () => {
    const m = f.models.find((x) => x.id === (f.defaultModel || f.models[0]?.id));
    return m ? `Default: ${m.name || 'unnamed'}${m.creditsPer10k != null && m.creditsPer10k !== '' ? ` · ${m.creditsPer10k}` : ''}` : '(default model)';
  };
  const modelOptions = (selected) => [h('option', { value: '' }, defaultName()), ...f.models.map((m) => h('option', { value: m.id, selected: m.id === selected }, `${m.name || m.id}${m.creditsPer10k != null && m.creditsPer10k !== '' ? ` · ${m.creditsPer10k}` : ''}`))];
  const repos = (id, key) => report?.[key]?.find((b) => String(b.id) === String(id))?.repos;
  $('#pricing').replaceChildren(
    h(
      'div',
      { class: 'grid' },
      field('Projection period (months)', num(['fusion', 'periodMonths'], { min: 1, max: 60, after: () => (renderPricing(), after()) })),
      field('If cadences disagree', seg(['fusion', 'combine'], [['higher', 'Higher wins'], ['frequency', 'Frequency'], ['criticality', 'Criticality']], after)),
      field('Extra credits on top (%)', num(['totals', 'extraPercent'], { max: 500, step: 0.5, after })),
      field('Credits per bundle', num(['totals', 'bundleCredits'], { min: 1, after })),
    ),
    h('h3', { style: 'margin:22px 0 8px;font-size:14px' }, 'Fusion models'),
    h(
      'table',
      null,
      h('thead', null, h('tr', null, h('th', null, 'Model'), h('th', { class: 'n' }, 'Credits per 10K LOC'), h('th', { class: 'n' }, 'Default'), h('th', null, ''))),
      h(
        'tbody',
        null,
        f.models.map((m, i) =>
          h(
            'tr',
            null,
            h('td', null, h('input', { type: 'text', value: m.name || '', placeholder: 'Model name, as Checkmarx One shows it', oninput: (e) => (set(['fusion', 'models', i, 'name'], e.target.value), after()), onchange: renderPricing })),
            h('td', { class: 'n' }, h('input', { type: 'number', min: 0, step: 0.01, value: m.creditsPer10k ?? '', style: 'max-width:140px;margin-left:auto', oninput: (e) => (set(['fusion', 'models', i, 'creditsPer10k'], e.target.value === '' ? null : Number(e.target.value)), after()), onchange: renderPricing })),
            h('td', { class: 'n' }, h('input', { type: 'radio', name: 'default-model', checked: (f.defaultModel || f.models[0]?.id) === m.id, onchange: () => (set(['fusion', 'defaultModel'], m.id), renderPricing(), after()) })),
            h('td', { class: 'n' }, h('button', { type: 'button', class: 'sm danger', 'aria-label': 'Remove model', onclick: () => (f.models.splice(i, 1), f.defaultModel === m.id && (f.defaultModel = f.models[0]?.id), save(), renderPricing(), after()) }, icon('trash'))),
          ),
        ),
      ),
    ),
    h('button', { type: 'button', class: 'sm', style: 'margin-top:10px', onclick: () => (f.models.push({ id: `model-${Date.now().toString(36)}`, name: '', creditsPer10k: null }), save(), renderPricing()) }, icon('plus'), 'Add a model'),
    h(
      'div',
      { class: 'rules-grid', style: 'margin-top:22px' },
      h(
        'div',
        null,
        h('h3', { style: 'margin:0 0 8px;font-size:14px' }, 'Fusion scans and model by change frequency'),
        h(
          'table',
          null,
          h('thead', null, h('tr', null, h('th', null, 'Commits on the default branch'), report ? h('th', { class: 'n' }, 'Repos') : null, h('th', { class: 'n' }, `Scans / ${f.periodMonths || 12} mo`), h('th', null, 'Model'))),
          h(
            'tbody',
            null,
            FREQUENCIES.map((fr) => {
              const own = f.byFrequency?.[fr.id]?.scans;
              const sug = suggestedScans(fr.id, f.periodMonths || 12);
              return h(
                'tr',
                null,
                h('td', null, fr.label, own === undefined || own === null ? h('span', { class: 'suggested' }, 'suggested') : null),
                report ? h('td', { class: 'n muted' }, String(repos(fr.id, 'byFrequency') ?? 0)) : null,
                h('td', { class: 'n' }, h('input', { type: 'number', min: 0, value: own ?? sug, style: 'max-width:110px;margin-left:auto', oninput: (e) => (set(['fusion', 'byFrequency', fr.id], { ...(f.byFrequency?.[fr.id] || {}), scans: e.target.value === '' ? null : Number(e.target.value) }), after()) })),
                h('td', null, h('select', { 'aria-label': `Model for ${fr.label}`, onchange: (e) => (set(['fusion', 'byFrequency', fr.id], { ...(f.byFrequency?.[fr.id] || {}), model: e.target.value || null }), after()) }, modelOptions(f.byFrequency?.[fr.id]?.model))),
              );
            }),
          ),
        ),
      ),
      h(
        'div',
        null,
        h('h3', { style: 'margin:0 0 8px;font-size:14px' }, 'By criticality (optional)'),
        h(
          'table',
          null,
          h('thead', null, h('tr', null, h('th', null, 'Criticality'), h('th', { class: 'n' }, 'Scans'), h('th', null, 'Model'))),
          h(
            'tbody',
            null,
            CRITICALITIES.map((c) =>
              h(
                'tr',
                null,
                h('td', null, `${c} ${c === 5 ? '(highest)' : c === 1 ? '(lowest)' : ''}`),
                h('td', { class: 'n' }, h('input', { type: 'number', min: 0, placeholder: '—', title: 'Empty: not used', value: f.byCriticality?.[c]?.scans ?? '', style: 'max-width:100px;margin-left:auto', oninput: (e) => (set(['fusion', 'byCriticality', c], { ...(f.byCriticality?.[c] || {}), scans: e.target.value === '' ? null : Number(e.target.value) }), after()) })),
                h('td', null, h('select', { onchange: (e) => (set(['fusion', 'byCriticality', c], { ...(f.byCriticality?.[c] || {}), model: e.target.value || null }), after()) }, modelOptions(f.byCriticality?.[c]?.model))),
              ),
            ),
          ),
        ),
        h('small', { class: 'muted' }, 'Criticality comes from repository rules below. Which model a repository gets: the one its rule pins, else its change frequency’s (its criticality’s first when criticality wins), else the default model.'),
      ),
    ),
  );
});

// ---------- scan settings and rules ----------
const renderSettings = guarded(function renderSettings() {
  const cats = [['code', 'Code'], ['markup', 'Markup (HTML, templates)'], ['iac', 'Infrastructure as code'], ['data', 'Data (JSON, YAML, XML)'], ['docs', 'Docs']];
  const chosen = new Set(cfg.countCategories || []);
  $('#settings').replaceChildren(
    h('div', { class: 'grid' }, field('Commit history window (days)', num(['windowDays'], { min: 1, max: 3650 })), field('Lines of code count', seg(['locBasis'], [['code', 'Code'], ['code+comments', '+ comments'], ['all', 'All lines']])), field('Repositories at once', num(['concurrency'], { min: 1, max: 12 }), 'Browsers open about 6 connections per site.')),
    h('div', { class: 'row', style: 'margin-top:14px;gap:22px' }, toggle(['includeArchived'], 'Include archived repositories'), toggle(['includeForks'], 'Include forks'), toggle(['includeMerges'], 'Count merge commits')),
    h('div', { class: 'field', style: 'margin-top:14px' }, h('span', null, 'File types that count'), h('div', { class: 'pills' }, cats.map(([id, label]) => h('button', { type: 'button', class: `pill-btn${chosen.has(id) ? ' on' : ''}`, onclick: () => (chosen.has(id) ? chosen.delete(id) : chosen.add(id), set(['countCategories'], [...chosen]), renderSettings()) }, label)))),
  );
});
const renderOverrides = guarded(function renderOverrides() {
  cfg.overrides ||= {};
  const entries = Object.entries(cfg.overrides);
  const after = () => (save(), repriceNow());
  $('#overrides').replaceChildren(
    entries.length
      ? h(
          'table',
          null,
          h('thead', null, h('tr', null, h('th', null, 'Repository or pattern'), h('th', null, 'Criticality'), h('th', { class: 'n' }, 'Scans'), h('th', null, 'Model'), h('th', null, 'Skip'), h('th', null, ''))),
          h(
            'tbody',
            null,
            entries.map(([pattern, o]) =>
              h(
                'tr',
                null,
                h('td', null, h('input', { type: 'text', value: pattern, onchange: (e) => {
                  const v = e.target.value.trim();
                  if (!v) return;
                  const next = {};
                  for (const [k, val] of Object.entries(cfg.overrides)) next[k === pattern ? v : k] = val;
                  cfg.overrides = next;
                  after();
                  renderOverrides();
                } })),
                h('td', null, h('select', { onchange: (e) => ((o.criticality = e.target.value ? Number(e.target.value) : undefined), after()) }, h('option', { value: '' }, '—'), CRITICALITIES.map((c) => h('option', { value: c, selected: o.criticality === c }, String(c))))),
                h('td', { class: 'n' }, h('input', { type: 'number', min: 0, value: o.scans ?? '', placeholder: 'auto', style: 'max-width:90px;margin-left:auto', oninput: (e) => ((o.scans = e.target.value === '' ? undefined : Number(e.target.value)), after()) })),
                h('td', null, h('select', { onchange: (e) => ((o.model = e.target.value || undefined), after()) }, h('option', { value: '' }, '(default)'), (cfg.fusion.models || []).map((m) => h('option', { value: m.id, selected: o.model === m.id }, m.name || m.id)))),
                h('td', null, h('input', { type: 'checkbox', checked: Boolean(o.exclude), onchange: (e) => ((o.exclude = e.target.checked || undefined), save()) })),
                h('td', { class: 'n' }, h('button', { type: 'button', class: 'sm danger', onclick: () => (delete cfg.overrides[pattern], after(), renderOverrides()) }, icon('trash'))),
              ),
            ),
          ),
        )
      : h('p', { class: 'muted', style: 'margin:0 0 10px' }, 'No rules: every repository follows its change frequency.'),
    h('button', { type: 'button', class: 'sm', style: 'margin-top:10px', onclick: () => ((cfg.overrides[`org/repo-${entries.length + 1}`] = { criticality: 5 }), save(), renderOverrides()) }, icon('plus'), 'Add a rule'),
  );
});

// ---------- the scan ----------
const keyOf = (r) => `${r.connection}|${r.fullName}`;
async function runScan(limit) {
  const started = Date.now();
  const abort = new AbortController();
  job = { running: true, done: 0, total: 0, log: [], current: 'discovering repositories', abort, estimated: 0 };
  const log = (line) => {
    job.log.push(line);
    if (job.log.length > 400) job.log.splice(0, job.log.length - 400);
    renderProgress();
  };
  renderPlan();
  renderProgress();
  const problems = [];
  const found = [];
  const overrideFor = overrideMatcher(cfg);
  for (const conn of cfg.connections) {
    const session = sessions[conn.name];
    if (!session) continue;
    let orgs = conn.orgs;
    try {
      if (orgs === 'all' || !Array.isArray(orgs) || !orgs.length) orgs = (await session.provider.listOrgs(session.api, conn)).map((o) => o.id).filter((id) => id !== '@me');
    } catch (err) {
      problems.push({ connection: conn.name, error: `could not list ${session.provider.orgNoun}s: ${err.message}` });
      log(`✗ ${conn.name}: ${err.message}`);
      continue;
    }
    await pool(orgs, 4, async (org) => {
      try {
        const list = classifyRepos(cfg, conn, org, await session.provider.listRepos(session.api, org, conn), overrideFor);
        found.push(...list);
        log(`${conn.name} · ${org}: ${list.length} repositories (${list.filter((r) => !r.skip).length} to measure)`);
      } catch (err) {
        problems.push({ connection: conn.name, org, error: err.message });
        log(`✗ ${conn.name} · ${org}: ${err.message}`);
      }
    });
  }
  let repos = dedupeRepos(found);
  let toMeasure = repos.filter((r) => !r.skip);
  if (limit > 0 && toMeasure.length > limit) {
    toMeasure = toMeasure.slice(0, limit);
    const keep = new Set(toMeasure.map(keyOf));
    repos = repos.filter((r) => r.skip || keep.has(keyOf(r)));
  }
  job.total = toMeasure.length;
  job.current = '';
  renderProgress();
  const results = new Map();
  const opts = { windowDays: cfg.windowDays, includeMerges: cfg.includeMerges, exclude: cfg.exclude, include: cfg.include, maxFileBytes: cfg.maxFileBytes, maxArchiveBytes: Math.min(cfg.maxArchiveBytes || 1024 ** 3, 2 * 1024 ** 3), countCategories: cfg.countCategories, locBasis: cfg.locBasis, signal: abort.signal };
  await pool(toMeasure, Math.max(1, Math.min(12, cfg.concurrency || 6)), async (repo) => {
    if (abort.signal.aborted) return;
    const session = sessions[repo.connection];
    job.current = repo.fullName;
    try {
      const m = await measureRepo(repo, { ...opts, session, conn: cfg.connections.find((c) => c.name === repo.connection) });
      results.set(keyOf(repo), { ...repo, ...m, analyzedAt: new Date().toISOString() });
      if (m.locEstimated) job.estimated++;
    } catch (err) {
      results.set(keyOf(repo), { ...repo, error: err.message });
      log(`✗ ${repo.fullName}: ${err.message}`);
    }
    job.done++;
    renderProgress();
  });
  report = buildReport(cfg, repos.map((r) => results.get(keyOf(r)) || r), problems, { started, partial: abort.signal.aborted });
  report.estimatedRepos = report.repos.filter((r) => r.locEstimated).length;
  job.running = false;
  log(`Done: ${report.counts.measured} repositories measured${report.estimatedRepos ? ` (${report.estimatedRepos} with estimated lines)` : ''}.`);
  renderAll();
  toast(abort.signal.aborted ? 'Scan stopped: the report covers what was measured' : 'Scan complete: the report is ready');
}
function repriceNow() {
  if (!report || job?.running) return renderEstimate();
  const estimated = report.estimatedRepos;
  report = reprice(report, { fusion: cfg.fusion, totals: cfg.totals, overrides: cfg.overrides });
  report.estimatedRepos = estimated;
  renderEstimate();
}

// ---------- the side column ----------
const allSignedIn = () => cfg.connections.length > 0 && cfg.connections.every((c) => status[c.name]?.state === 'ok');
function renderPlan() {
  const box = $('#plan');
  const ok = cfg.connections.filter((c) => status[c.name]?.state === 'ok').length;
  const priced = (cfg.fusion.models || []).some((m) => Number(m.creditsPer10k) > 0);
  const limit = h('input', { type: 'number', min: 0, placeholder: 'all', id: 'limit', style: 'max-width:110px' });
  const running = job?.running;
  box.replaceChildren(
    h('div', { class: 'eyebrow' }, 'Ready check'),
    h('div', { class: `check${allSignedIn() ? ' ok' : ''}` }, h('i', null, allSignedIn() ? '✓' : '1'), `${ok} of ${cfg.connections.length} connection${cfg.connections.length === 1 ? '' : 's'} signed in`),
    h('div', { class: `check${priced ? ' ok' : ''}` }, h('i', null, priced ? '✓' : '2'), priced ? 'Fusion pricing set' : 'Set credits per 10K LOC'),
    h(
      'div',
      { style: 'display:grid;gap:10px;margin-top:14px' },
      running
        ? h('button', { type: 'button', class: 'big danger', onclick: () => (job.abort.abort(), toast('Stopping after the repositories in progress…')) }, icon('stop'), 'Stop the scan')
        : h('button', { type: 'button', class: 'golden big', disabled: !allSignedIn(), title: allSignedIn() ? '' : 'Sign in to every connection first', onclick: () => runScan(Number(limit.value) || 0).catch((err) => ((job.running = false), toast(err.message, true), renderPlan())) }, icon('play'), 'Run the Fusion scan'),
      running ? null : h('div', { class: 'row', style: 'justify-content:center' }, h('span', { class: 'unit' }, 'Try with the first'), limit, h('span', { class: 'unit' }, 'repositories')),
    ),
  );
}
function renderProgress() {
  const box = $('#progress');
  if (!job) return (box.hidden = true);
  box.hidden = false;
  const pct = job.total ? Math.floor((job.done / job.total) * 100) : job.running ? 0 : 100;
  const problems = job.log.filter((l) => /^\s*✗/.test(l));
  box.replaceChildren(
    ...[
      h('div', { class: 'eyebrow' }, job.running ? 'Scanning' : 'Scan complete'),
      h('div', { class: 'row', style: 'justify-content:space-between;margin:10px 0 8px' }, h('div', { class: 'big-figure', style: 'font-size:30px' }, `${pct}%`), h('div', { class: 'unit' }, `${fmt(job.done)} / ${fmt(job.total)} repositories`)),
      h('div', { class: 'bar' }, h('span', { style: `width:${pct}%` })),
      job.running ? h('div', { class: 'unit', style: 'margin-top:8px' }, h('span', { class: 'spin' }), ` ${job.current || 'measuring…'}`) : null,
      !job.running && problems.length ? h('div', { class: 'warn-box' }, `${problems.length} problem${problems.length === 1 ? '' : 's'} while listing or measuring:`, h('ul', null, problems.slice(0, 5).map((l) => h('li', null, l.replace(/^\s*✗\s*/, ''))))) : null,
      h('details', { class: 'more', style: 'margin-top:10px', open: job.running }, h('summary', null, 'Activity'), h('div', { class: 'log', id: 'log' }, job.log.join('\n'))),
    ].filter(Boolean),
  );
  const log = $('#log');
  if (log) log.scrollTop = log.scrollHeight;
}
function renderEstimate() {
  const box = $('#estimate');
  if (!report) {
    box.replaceChildren(h('div', { class: 'eyebrow' }, 'Live estimate'), h('p', { class: 'unit', style: 'margin:10px 0 0' }, 'Run a scan: the credits appear here and follow every pricing change instantly.'));
    return;
  }
  const r = report;
  const known = r.credits.known;
  const name = `cloc-fusion-report-${r.generatedAt.slice(0, 10)}`;
  box.replaceChildren(
    h('div', { class: 'eyebrow' }, 'Live estimate'),
    h('div', { class: 'big-figure', style: 'margin:10px 0 4px' }, known ? fmt(r.credits.total, r.credits.total < 100 ? 1 : 0) : fmt(r.totals.unitScans)),
    h('div', { class: 'unit' }, known ? `Fusion credits · ${r.settings.fusion.periodMonths} months · ${fmt(r.credits.bundles)} bundle${r.credits.bundles === 1 ? '' : 's'}` : '10K-unit Fusion scans (set credits per 10K LOC)'),
    h('div', { class: 'tiles', style: 'margin-top:14px' }, h('div', { class: 'tile' }, h('span', null, 'Repositories'), h('b', null, fmt(r.counts.measured))), h('div', { class: 'tile' }, h('span', null, 'Lines of code'), h('b', null, fmt(r.totals.lines))), h('div', { class: 'tile' }, h('span', null, 'Fusion scans'), h('b', null, fmt(r.totals.scans))), h('div', { class: 'tile' }, h('span', null, 'Commits'), h('b', null, fmt(r.totals.commits)))),
    r.estimatedRepos ? h('div', { class: 'warn-box' }, `Lines of code for ${fmt(r.estimatedRepos)} repositor${r.estimatedRepos === 1 ? 'y are' : 'ies are'} estimated from GitHub's language statistics, because GitHub does not let a page opened from disk download its archives. For exact counts, run the cloc-fusion app on those repositories.`) : null,
    h(
      'div',
      { class: 'row', style: 'margin-top:14px' },
      h('button', { type: 'button', class: 'primary', onclick: () => openReport() }, icon('report'), 'Open the full report'),
      h('button', { type: 'button', class: 'sm', onclick: () => download(`${name}.html`, toHtml(report), 'text/html') }, icon('download'), 'HTML'),
      h('button', { type: 'button', class: 'sm', onclick: () => download(`${name}.csv`, `﻿${toCsv(report)}`, 'text/csv') }, 'CSV'),
      h('button', { type: 'button', class: 'sm', onclick: () => download(`${name}.json`, JSON.stringify(report, null, 2), 'application/json') }, 'JSON'),
    ),
    h('div', { class: 'unit', style: 'margin-top:10px' }, `Measured ${new Date(r.generatedAt).toLocaleString()} · cloc-fusion ${r.version}${r.partial ? ' · partial' : ''}`),
  );
}
function openReport() {
  const url = URL.createObjectURL(new Blob([toHtml(report)], { type: 'text/html' }));
  const w = window.open(url, '_blank', 'noopener');
  if (!w) download(`cloc-fusion-report-${report.generatedAt.slice(0, 10)}.html`, toHtml(report), 'text/html');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function renderAll() {
  renderConnections();
  renderPricing();
  renderSettings();
  renderOverrides();
  renderPlan();
  renderProgress();
  renderEstimate();
}

// ---------- settings files ----------
function exportSettings() {
  const out = clone(cfg);
  for (const c of out.connections) c.auth = { method: c.auth?.method || 'pat', ...(c.auth?.username ? { username: c.auth.username } : {}) };
  download('cloc-fusion.config.json', JSON.stringify(out, null, 2), 'application/json');
}
async function importSettings(file) {
  try {
    if (file.size > 1048576) throw new Error('that file is too big for settings');
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object') throw new Error('not a settings file');
    const src = data.tool === 'cloc-fusion' && data.settings ? data.settings : data; // a report's settings work too
    if (src.fusion && typeof src.fusion === 'object') cfg.fusion = { ...cfg.fusion, ...src.fusion };
    if (src.totals && typeof src.totals === 'object') cfg.totals = { ...cfg.totals, ...src.totals };
    if (src.overrides && typeof src.overrides === 'object') cfg.overrides = { ...(cfg.overrides || {}), ...src.overrides };
    for (const k of ['windowDays', 'includeArchived', 'includeForks', 'includeMerges', 'locBasis', 'countCategories', 'exclude', 'include', 'maxFileBytes']) if (src[k] !== undefined) cfg[k] = src[k];
    if (Array.isArray(src.connections)) {
      for (const c of src.connections) {
        if (!c || !SUPPORTED.includes(c.provider) || !c.name || cfg.connections.some((x) => x.name === c.name)) continue;
        cfg.connections.push({ name: String(c.name), provider: c.provider, apiUrl: typeof c.apiUrl === 'string' ? c.apiUrl : undefined, orgs: c.orgs === 'all' ? 'all' : Array.isArray(c.orgs) ? c.orgs.map(String) : [], include: c.include, exclude: c.exclude, auth: { method: 'pat' } });
      }
    }
    save();
    renderAll();
    repriceNow();
    toast('Settings imported');
  } catch (err) {
    toast(`Could not import: ${err.message}`, true);
  }
}

// ---------- start ----------
function setTheme(t) {
  if (t === 'light') D.documentElement.setAttribute('data-theme', 'light');
  else D.documentElement.setAttribute('data-theme', 'dark');
  store.set('cf-theme', t);
}
export function start() {
  $('#version').textContent = `v${VERSION}`;
  setTheme(store.get('cf-theme') === 'light' ? 'light' : 'dark');
  $('#theme').addEventListener('click', () => setTheme(D.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
  $('#export').addEventListener('click', exportSettings);
  $('#import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) importSettings(f);
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm('Reset every setting to the defaults? Connections you added are removed too.')) return;
    for (const c of cfg.connections) signOut(c);
    try {
      localStorage.removeItem(STORE);
    } catch {}
    cfg = startingSettings();
    report = null;
    job = null;
    renderAll();
  });
  addEventListener('beforeunload', (e) => {
    if (job?.running) e.preventDefault();
  });
  renderAll();
}

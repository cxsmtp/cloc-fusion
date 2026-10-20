// Signing in through the browser, for the web app.
//   - OAuth 2.0 device authorization (RFC 8628) for GitHub and GitLab, when an OAuth application
//     id is configured: the page shows a code, the person approves it on the platform's own page.
//   - The platform CLIs' own browser sign-in: `gh auth login --web` (GitHub) and `az login`
//     (Microsoft Entra ID, so Okta-federated SSO works too).
//   - Otherwise the platform's token page, opened with the right scopes ticked where the platform
//     allows it, and the token pasted once into the page.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ApiClient } from './http.js';

const run = promisify(execFile);

/** Is a command-line tool installed? (gh, az) */
export async function hasTool(cmd) {
  try {
    await run(cmd, ['--version'], { timeout: 15000, windowsHide: true, shell: process.platform === 'win32' && /^[\w.-]+$/.test(cmd) });
    return true;
  } catch {
    return false;
  }
}

export { tokenPageUrl } from './tokenpages.js';
import { webOf } from './tokenpages.js';

/** The device-flow endpoints of a connection, when it can use one. */
export function deviceFlowOf(conn) {
  const clientId = conn.oauth?.clientId || (conn.provider === 'github' ? process.env.CLOC_FUSION_GITHUB_CLIENT_ID : conn.provider === 'gitlab' ? process.env.CLOC_FUSION_GITLAB_CLIENT_ID : '');
  if (!clientId) return null;
  if (conn.provider === 'github') {
    const web = webOf(conn, 'https://api.github.com');
    return { clientId, scope: 'repo read:org', codeUrl: `${web}/login/device/code`, tokenUrl: `${web}/login/oauth/access_token`, origin: web };
  }
  if (conn.provider === 'gitlab') {
    const web = webOf(conn, 'https://gitlab.com');
    return { clientId, scope: 'read_api read_repository', codeUrl: `${web}/oauth/authorize_device`, tokenUrl: `${web}/oauth/token`, origin: web };
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * RFC 8628 device authorization. `onCode({ userCode, verificationUri })` is called once the code is
 * issued; resolves to the access token when the person approves, rejects on denial or expiry.
 */
export async function deviceFlow(flow, { onCode, signal, fetchImpl } = {}) {
  const api = new ApiClient({ name: 'Sign-in', baseUrl: flow.origin, retries: 2, fetchImpl });
  const form = (o) => ({ method: 'POST', body: o });
  const start = await api.get(flow.codeUrl, form({ client_id: flow.clientId, scope: flow.scope }));
  if (!start?.device_code) throw new Error('the platform did not start a sign-in (is the application id right, and device flow enabled for it?)');
  onCode?.({ userCode: start.user_code, verificationUri: start.verification_uri_complete || start.verification_uri, expiresIn: start.expires_in });
  let interval = Math.max(1, Number(start.interval) || 5) * 1000;
  const deadline = Date.now() + (Number(start.expires_in) || 900) * 1000;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('sign-in cancelled');
    await sleep(interval);
    const res = await api.request(flow.tokenUrl, { ...form({ client_id: flow.clientId, device_code: start.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }), emptyOn: [400, 401] });
    const body = res.data || {};
    if (body.access_token) return body.access_token;
    if (body.error === 'slow_down') interval += 5000;
    else if (body.error === 'access_denied') throw new Error('sign-in was declined');
    else if (body.error === 'expired_token') throw new Error('the code expired; start again');
    else if (body.error && body.error !== 'authorization_pending') throw new Error(body.error_description || body.error);
  }
  throw new Error('the code expired; start again');
}

/**
 * Run a CLI's browser sign-in (gh, az) and report what it prints: a one-time code and the URL
 * to open. Resolves when the CLI finishes signing in.
 */
export function cliBrowserLogin(kind, conn, { onCode, onLine, signal } = {}) {
  let cmd;
  let args;
  if (kind === 'gh') {
    let host = 'github.com';
    try {
      const h = new URL(conn.apiUrl || 'https://api.github.com').host;
      host = h === 'api.github.com' ? 'github.com' : h;
    } catch {}
    // Only a plain host name (and port) reaches the command line: on Windows it goes through the
    // shell, where characters a URL host may still hold (such as &) would start another command.
    if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/i.test(host)) return Promise.reject(new Error(`not a valid GitHub host: ${host.slice(0, 80)}`));
    cmd = 'gh';
    args = ['auth', 'login', '--web', '--hostname', host, '--git-protocol', 'https', '--skip-ssh-key', '--scopes', 'repo,read:org'];
  } else {
    cmd = 'az';
    args = ['login', '--allow-no-subscriptions', '--only-show-errors', '--output', 'none'];
  }
  return new Promise((resolve, reject) => {
    const env = { ...process.env, GH_PROMPT_DISABLED: '', NO_COLOR: '1' };
    delete env.GH_TOKEN; // an environment token would make gh refuse to sign in
    delete env.GITHUB_TOKEN;
    const child = spawn(cmd, args, { env, windowsHide: true, shell: process.platform === 'win32' });
    let done = false;
    const seen = (chunk) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        const l = line.trim();
        if (!l) continue;
        onLine?.(l);
        const code = l.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i) || l.match(/enter the code\s+([A-Z0-9-]{6,12})/i);
        const url = l.match(/https:\/\/\S+/);
        if (code || url) onCode?.({ userCode: code?.[1] || null, verificationUri: url?.[0]?.replace(/[.,)]+$/, '') || (kind === 'gh' ? 'https://github.com/login/device' : null) });
        // gh waits for Enter before opening the browser.
        if (/press enter/i.test(l)) child.stdin.write('\n');
      }
    };
    child.stdout.on('data', seen);
    child.stderr.on('data', seen);
    child.on('error', (err) => {
      done = true;
      reject(err.code === 'ENOENT' ? new Error(`${cmd} is not installed`) : err);
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      code === 0 ? resolve() : reject(new Error(`${cmd} sign-in did not complete (exit ${code})`));
    });
    signal?.addEventListener('abort', () => child.kill());
  });
}

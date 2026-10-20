#!/usr/bin/env node
// Run a Checkmarx One Fusion scan on an application and fetch its results, from the Fusion
// Dispatcher and Fusion Results APIs. Needs only a Checkmarx One API key: the tenant, the sign-in
// host and the API host are read from the key itself.
//
//   CX_APIKEY=… node scripts/fusion-scan.mjs --app <application id> [--out fusion-results.json]
//
// Options (or environment variables):
//   --app        CX_FUSION_APP          the Checkmarx One application to correlate
//   --base       CX_BASE_URI            API host, e.g. https://deu.ast.checkmarx.net (default: from the key)
//   --dispatcher CX_FUSION_DISPATCHER   path of the Fusion Dispatcher service (default /api/fusion-dispatcher)
//   --results    CX_FUSION_RESULTS      path of the Fusion Results service (default /api/fusion-results)
//   --timeout    minutes to wait for the scan (default 60)
//   --no-start   only read the status and results of the latest Fusion scan
import { writeFile } from 'node:fs/promises';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((out, a, i, all) => {
    if (!a.startsWith('--')) return out;
    const next = all[i + 1];
    out.push([a.slice(2), next && !next.startsWith('--') ? next : true]);
    return out;
  }, []),
);
const fail = (msg) => {
  console.error(`Error: ${msg}`);
  process.exit(1);
};
const key = process.env.CX_APIKEY;
if (!key) fail('set CX_APIKEY to a Checkmarx One API key');
const app = args.app || process.env.CX_FUSION_APP;
if (!app || !/^[0-9a-f-]{36}$/i.test(app)) fail('pass --app <application id> (a UUID)');

// The API key is a refresh token; its issuer names the sign-in host and the tenant.
let iss;
try {
  iss = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).iss;
} catch {
  fail('CX_APIKEY is not a Checkmarx One API key');
}
const issuer = new URL(iss);
const tenant = issuer.pathname.split('/').filter(Boolean).pop();
// deu.iam.checkmarx.net → deu.ast.checkmarx.net; iam.checkmarx.net → ast.checkmarx.net
const astHost = issuer.host.replace(/(^|\.)iam\./, '$1ast.');
const base = String(args.base || process.env.CX_BASE_URI || `${issuer.protocol}//${astHost}`).replace(/\/+$/, '');
const dispatcher = String(args.dispatcher || process.env.CX_FUSION_DISPATCHER || '/api/fusion-dispatcher').replace(/\/+$/, '');
const results = String(args.results || process.env.CX_FUSION_RESULTS || '/api/fusion-results').replace(/\/+$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token() {
  const res = await fetch(`${iss}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: 'ast-app', refresh_token: key }),
  });
  if (!res.ok) fail(`could not sign in to ${issuer.host} (HTTP ${res.status})`);
  return (await res.json()).access_token;
}

let access = await token();
async function call(method, path, { allow = [] } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${access}`, Accept: 'application/json; version=1.0' } });
    if (res.status === 401 && attempt === 0) {
      access = await token();
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    if (!res.ok && !allow.includes(res.status)) fail(`${method} ${path} → HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
    try {
      return { status: res.status, data: text ? JSON.parse(text) : null };
    } catch {
      return { status: res.status, data: text };
    }
  }
}

console.error(`Tenant ${tenant} · ${base} · application ${app}`);
if (!args['no-start']) {
  await call('POST', `${dispatcher}/${app}/correlate`);
  console.error('Fusion scan started.');
}
const deadline = Date.now() + Number(args.timeout || 60) * 60000;
let status;
for (;;) {
  status = (await call('GET', `${dispatcher}/${app}/scan-status`, { allow: [404] })).data;
  const s = status?.scanStatus || 'Unknown';
  console.error(`  ${new Date().toLocaleTimeString()}  ${s}${status?.stage !== undefined ? ` · stage ${status.stage}%` : ''}${status?.stageDescription ? ` · ${status.stageDescription}` : ''}`);
  if (s === 'Completed' || s === 'Failed' || args['no-start']) break;
  if (Date.now() > deadline) fail('timed out waiting for the Fusion scan (raise --timeout)');
  await sleep(Number(process.env.CX_FUSION_POLL_MS) || 15000);
}
if (status?.scanStatus === 'Failed') fail(`the Fusion scan failed${status.errorMessage ? `: ${status.errorMessage}` : ''}`);

const [summary, microservices, resources, riskScores] = await Promise.all(
  ['summary', 'microservices', 'resources', 'risk-scores'].map(async (part) => (await call('GET', `${results}/applications/${app}/${part}`, { allow: [404] })).data),
);
const out = { tenant, application: app, fusionScan: status, summary, microservices, resources, riskScores };
const file = args.out || 'fusion-results.json';
await writeFile(file, JSON.stringify(out, null, 2));
console.log(`Fusion: ${summary?.microservices?.count ?? 0} microservices, ${summary?.cloudResources?.count ?? 0} cloud resources, ${riskScores?.totalCount ?? 0} re-scored results.`);
for (const r of (riskScores?.results || []).slice(0, 20)) console.log(`  ${r.vulnerabilityEngine || ''}${r.correlatedEngine ? ` × ${r.correlatedEngine}` : ''}: risk ${r.oldRiskValue} → ${r.newRiskValue}${r.resultInfo ? ` (${r.resultInfo})` : ''}`);
console.log(`Saved ${file}`);

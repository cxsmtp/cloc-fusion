// A GitHub-compatible mock API for tests and benchmarks: any number of organizations and
// repositories, paginated like GitHub (Link headers, 100 per page), commit lists, and tarballs
// served through a redirect to a second "codeload" origin (which must never see the token).
// Optional fault injection: a share of URLs answered 429 (Retry-After: 0) or 502 on their first attempt.
import http from 'node:http';
import { gzipSync } from 'node:zlib';

const DAY = 86400000;

/** A minimal ustar writer: [{ path, content }] → tar Buffer. */
export function tar(files) {
  const blocks = [];
  for (const f of files) {
    const body = Buffer.from(f.content);
    const h = Buffer.alloc(512);
    h.write(f.path.slice(0, 100), 0);
    h.write('0000644\0', 100);
    h.write('0000000\0', 108);
    h.write('0000000\0', 116);
    h.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
    h.write('00000000000\0', 136);
    h.write('        ', 148);
    h.write('0', 156);
    h.write('ustar\0', 257);
    h.write('00', 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

/** A synthetic repository's files: `n` JavaScript files of `lines` code lines (+1 comment) each. */
function repoFiles(top, n, lines) {
  const files = [];
  for (let i = 0; i < n; i++) files.push({ path: `${top}/src/mod${i}.js`, content: '// module\n' + 'const x = 1;\n'.repeat(lines) });
  files.push({ path: `${top}/node_modules/dep/index.js`, content: 'x();\n'.repeat(5000) });
  files.push({ path: `${top}/README.md`, content: '# Readme\n' });
  return files;
}

/**
 * Start the mock. Returns { url, close, stats }. Repository i of organization o is
 * `org{o}/repo{i}`; its size and activity cycle through a few profiles so totals are predictable.
 */
export async function startMockGitHub({ orgs = 2, reposPerOrg = 3, faultRate = 0, latencyMs = 0, token = 'test-token', cors = false, codeloadCors = true } = {}) {
  const PROFILES = [
    { files: 5, lines: 100, commitsPerWeek: 7 },
    { files: 20, lines: 600, commitsPerWeek: 2 },
    { files: 2, lines: 50, commitsPerWeek: 0 },
  ];
  const now = Date.now();
  const tarballs = PROFILES.map((p, i) => gzipSync(tar(repoFiles(`acme-repo-p${i}`, p.files, p.lines))));
  const stats = { requests: 0, faults: 0, tokenLeaks: 0, unauthorized: 0 };
  const profileOf = (o, i) => PROFILES[(o * reposPerOrg + i) % PROFILES.length];
  let codeloadUrl = '';
  const faulted = new Set();
  // A stable pseudo-random number in [0, 1) for a string (FNV-1a).
  const hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967296;
  };

  const commitsFor = (p, sinceT) => {
    const out = [];
    const weeks = 52;
    for (let w = 0; w < weeks; w++) for (let k = 0; k < p.commitsPerWeek; k++) {
      const t = now - w * 7 * DAY - (k + 1) * 3600000;
      if (t >= sinceT) out.push({ sha: `${w}-${k}`, commit: { author: { email: `dev${k % 3}@acme.test`, name: `Developer ${k % 3}`, date: new Date(t).toISOString() }, committer: { date: new Date(t).toISOString() } }, parents: [{}] });
    }
    // A dependency bot on the busy repositories, as on real ones.
    if (p.commitsPerWeek > 0) {
      const t = now - 5 * DAY;
      if (t >= sinceT) out.push({ sha: 'bot', commit: { author: { email: '49699333+dependabot[bot]@users.noreply.github.com', name: 'dependabot[bot]', date: new Date(t).toISOString() }, committer: { date: new Date(t).toISOString() } }, parents: [{}] });
    }
    return out;
  };

  const page = (res, url, items) => {
    const per = Math.min(100, Number(url.searchParams.get('per_page')) || 30);
    const pageNo = Number(url.searchParams.get('page')) || 1;
    const slice = items.slice((pageNo - 1) * per, pageNo * per);
    const headers = { 'content-type': 'application/json' };
    if (pageNo * per < items.length) {
      const next = new URL(url);
      next.searchParams.set('page', String(pageNo + 1));
      headers.link = `<${next}>; rel="next"`;
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify(slice));
  };

  // A web page (the standalone HTML) calls the API cross-origin, as it does api.github.com.
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, accept, content-type, x-github-api-version', 'access-control-expose-headers': 'link, x-ratelimit-remaining, x-ratelimit-reset' };
  const api = http.createServer(async (req, res) => {
    stats.requests++;
    if (cors) {
      for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
    }
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    // Faults: a share of URLs fail on their first attempt (429 or 502), then succeed, so retries
    // are exercised on every run without a run ever being unlucky enough to exhaust them.
    if (faultRate && !faulted.has(req.url) && hash(req.url) < faultRate) {
      faulted.add(req.url);
      stats.faults++;
      if (hash(`${req.url}#kind`) < 0.5) res.writeHead(429, { 'retry-after': '0' });
      else res.writeHead(502);
      return res.end();
    }
    if (req.headers.authorization !== `Bearer ${token}`) {
      stats.unauthorized++;
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end('{"message":"Bad credentials"}');
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    let m;
    if (p === '/user') return res.end(JSON.stringify({ login: 'bench' }));
    if (p === '/user/orgs') return page(res, url, Array.from({ length: orgs }, (_, o) => ({ login: `org${o}` })));
    if ((m = p.match(/^\/orgs\/org(\d+)\/repos$/))) {
      const o = Number(m[1]);
      const list = Array.from({ length: reposPerOrg }, (_, i) => ({
        id: o * 1e6 + i,
        name: `repo${i}`,
        full_name: `org${o}/repo${i}`,
        clone_url: `https://git.invalid/org${o}/repo${i}.git`,
        html_url: `https://github.invalid/org${o}/repo${i}`,
        default_branch: 'main',
        size: 100,
        created_at: new Date(now - 800 * DAY).toISOString(),
      }));
      return page(res, url, list);
    }
    if ((m = p.match(/^\/repos\/org(\d+)\/repo(\d+)\/commits$/))) {
      const prof = profileOf(Number(m[1]), Number(m[2]));
      const since = url.searchParams.get('since');
      return page(res, url, commitsFor(prof, since ? Date.parse(since) : 0));
    }
    if ((m = p.match(/^\/repos\/org(\d+)\/repo(\d+)\/languages$/))) {
      const prof = profileOf(Number(m[1]), Number(m[2]));
      return res.end(JSON.stringify({ JavaScript: prof.files * prof.lines * 45, Markdown: 400 }));
    }
    if ((m = p.match(/^\/repos\/org(\d+)\/repo(\d+)\/tarball\/main$/))) {
      const idx = PROFILES.indexOf(profileOf(Number(m[1]), Number(m[2])));
      res.writeHead(302, { location: `${codeloadUrl}/p${idx}.tar.gz?token=signed` });
      return res.end();
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"message":"Not Found"}');
  });

  // The download host: like codeload.github.com, a different origin that gets no Authorization.
  const codeload = http.createServer((req, res) => {
    stats.requests++;
    if (cors && codeloadCors) res.setHeader('access-control-allow-origin', '*');
    if (req.headers.authorization) stats.tokenLeaks++;
    const m = req.url.match(/^\/p(\d)\.tar\.gz/);
    if (!m) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': 'application/x-gzip' });
    res.end(tarballs[Number(m[1])]);
  });

  const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${srv.address().port}`)));
  const url = await listen(api);
  codeloadUrl = await listen(codeload);
  api.keepAliveTimeout = codeload.keepAliveTimeout = 60000;
  return {
    url,
    stats,
    profiles: PROFILES,
    // Idle keep-alive connections are closed too, at once: Node 18 would otherwise wait for them.
    close: () =>
      Promise.all(
        [api, codeload].map(
          (srv) =>
            new Promise((r) => {
              srv.close(r);
              srv.closeAllConnections?.();
            }),
        ),
      ),
  };
}

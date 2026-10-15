import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerOf } from '../src/providers/index.js';
import { ApiClient } from '../src/http.js';

/** A fetch that answers from a table of URL → { body, headers, status }. */
function fakeFetch(routes, seen = []) {
  return async (url, init) => {
    seen.push({ url, headers: init.headers });
    const r = routes[url];
    if (!r) return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    return new Response(JSON.stringify(r.body), { status: r.status || 200, headers: r.headers || {} });
  };
}

function withFetch(provider, conn, secret, fetchImpl) {
  const api = provider.client(conn, secret);
  api.fetch = fetchImpl;
  api.retries = 0;
  return api;
}

test('GitHub: organizations and repositories, following Link pagination', async () => {
  const gh = providerOf('github');
  const seen = [];
  const repo = (id, extra = {}) => ({ id, name: `r${id}`, full_name: `acme/r${id}`, clone_url: `https://github.com/acme/r${id}.git`, html_url: `https://github.com/acme/r${id}`, default_branch: 'main', size: 10, ...extra });
  const api = withFetch(gh, {}, { token: 'T' }, fakeFetch({
    'https://api.github.com/user': { body: { login: 'me' } },
    'https://api.github.com/user/orgs?per_page=100': { body: [{ login: 'acme' }, { login: 'beta', description: 'Beta org' }] },
    'https://api.github.com/orgs/acme/repos?type=all&per_page=100': { body: [repo(1), repo(2, { archived: true })], headers: { link: '<https://api.github.com/orgs/acme/repos?type=all&per_page=100&page=2>; rel="next", <x>; rel="last"' } },
    'https://api.github.com/orgs/acme/repos?type=all&per_page=100&page=2': { body: [repo(3, { fork: true, size: 0 })] },
  }, seen));
  assert.equal(await gh.whoami(api), 'me');
  const orgs = await gh.listOrgs(api);
  assert.deepEqual(orgs.map((o) => o.id), ['@me', 'acme', 'beta']);
  const repos = await gh.listRepos(api, 'acme');
  assert.equal(repos.length, 3);
  assert.equal(repos[1].archived, true);
  assert.equal(repos[2].fork, true);
  assert.equal(repos[2].empty, true);
  assert.equal(seen[0].headers.Authorization, 'Bearer T');
  assert.equal(gh.gitAuthHeader({}, { token: 'T' }), `Basic ${Buffer.from('x-access-token:T').toString('base64')}`);
});

test('GitLab: top-level groups and projects with subgroups', async () => {
  const gl = providerOf('gitlab');
  const api = withFetch(gl, {}, { token: 'T' }, fakeFetch({
    'https://gitlab.com/api/v4/groups?top_level_only=true&min_access_level=10&per_page=100&order_by=name': { body: [{ full_path: 'acme', name: 'Acme' }] },
    'https://gitlab.com/api/v4/groups/acme/projects?include_subgroups=true&with_shared=false&per_page=100': { body: [{ id: 7, path: 'api', path_with_namespace: 'acme/backend/api', http_url_to_repo: 'https://gitlab.com/acme/backend/api.git', default_branch: 'main', visibility: 'private', empty_repo: false }] },
  }));
  assert.deepEqual((await gl.listOrgs(api)).map((o) => o.id), ['@me', 'acme']);
  const [p] = await gl.listRepos(api, 'acme');
  assert.equal(p.fullName, 'acme/backend/api');
  assert.equal(gl.gitAuthHeader({}, { token: 'T' }), `Basic ${Buffer.from('oauth2:T').toString('base64')}`);
});

test('Azure DevOps: organizations via the profile, repositories across projects', async () => {
  const az = providerOf('azure');
  const seen = [];
  const api = withFetch(az, { auth: { method: 'pat' } }, { token: 'PAT' }, fakeFetch({
    'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1': { body: { id: 'u1', emailAddress: 'me@acme.com' } },
    'https://app.vssps.visualstudio.com/_apis/accounts?memberId=u1&api-version=7.1': { body: { value: [{ accountName: 'acme' }] } },
    'https://dev.azure.com/acme/_apis/git/repositories?api-version=7.1': { body: { value: [{ id: 'g1', name: 'web', project: { name: 'Shop' }, remoteUrl: 'https://acme@dev.azure.com/acme/Shop/_git/web', defaultBranch: 'refs/heads/main', size: 2048 }, { id: 'g2', name: 'blank', project: { name: 'Shop' }, remoteUrl: 'https://acme@dev.azure.com/acme/Shop/_git/blank', size: 0 }] } },
  }, seen));
  assert.equal(await az.whoami(api, {}), 'me@acme.com');
  assert.deepEqual((await az.listOrgs(api, {})).map((o) => o.id), ['acme']);
  const repos = await az.listRepos(api, 'acme', {});
  assert.equal(repos[0].fullName, 'acme/Shop/web');
  assert.equal(repos[0].cloneUrl, 'https://dev.azure.com/acme/Shop/_git/web');
  assert.equal(repos[0].defaultBranch, 'main');
  assert.equal(repos[1].empty, true);
  assert.equal(seen[0].headers.Authorization, `Basic ${Buffer.from(':PAT').toString('base64')}`);
  assert.equal(az.authHeader({ auth: { method: 'entra' } }, { token: 'JWT' }), 'Bearer JWT');
});

test('Bitbucket Cloud: workspaces with fallback, repositories by next link', async () => {
  const bb = providerOf('bitbucket');
  const conn = { auth: { method: 'api-token' } };
  const seen = [];
  const api = withFetch(bb, conn, { username: 'me@acme.com', token: 'T' }, fakeFetch({
    'https://api.bitbucket.org/2.0/user/permissions/workspaces?pagelen=100': { body: { values: [{ workspace: { slug: 'acme', name: 'Acme' } }, { workspace: { slug: 'acme', name: 'Acme' } }] } },
    'https://api.bitbucket.org/2.0/repositories/acme?pagelen=100': { body: { values: [{ uuid: '{1}', slug: 'a', full_name: 'acme/a', mainbranch: { name: 'main' }, links: { clone: [{ name: 'https', href: 'https://me@bitbucket.org/acme/a.git' }] } }], next: 'https://api.bitbucket.org/2.0/repositories/acme?pagelen=100&page=2' } },
    'https://api.bitbucket.org/2.0/repositories/acme?pagelen=100&page=2': { body: { values: [{ uuid: '{2}', slug: 'b', full_name: 'acme/b', parent: {}, links: {} }] } },
  }, seen));
  assert.deepEqual((await bb.listOrgs(api)).map((o) => o.id), ['acme']);
  const repos = await bb.listRepos(api, 'acme');
  assert.equal(repos.length, 2);
  assert.equal(repos[0].cloneUrl, 'https://bitbucket.org/acme/a.git');
  assert.equal(repos[1].fork, true);
  assert.equal(repos[1].empty, true);
  assert.equal(seen.find((s) => s.url.includes('repositories')).headers.Authorization, `Basic ${Buffer.from('me@acme.com:T').toString('base64')}`);
  assert.equal(bb.gitAuthHeader(conn, { token: 'T' }), `Basic ${Buffer.from('x-bitbucket-api-token-auth:T').toString('base64')}`);
  assert.equal(bb.gitAuthHeader({ auth: { method: 'access-token' } }, { token: 'T' }), `Basic ${Buffer.from('x-token-auth:T').toString('base64')}`);
});

test('Bitbucket Data Center: projects paged by nextPageStart', async () => {
  const bs = providerOf('bitbucket-server');
  const api = withFetch(bs, { apiUrl: 'https://bb.acme.com' }, { token: 'T' }, fakeFetch({
    'https://bb.acme.com/rest/api/1.0/projects?limit=100': { body: { values: [{ key: 'A', name: 'Alpha' }], isLastPage: false, nextPageStart: 1 } },
    'https://bb.acme.com/rest/api/1.0/projects?limit=100&start=1': { body: { values: [{ key: 'B', name: 'Beta' }], isLastPage: true } },
  }));
  assert.deepEqual((await bs.listOrgs(api)).map((o) => o.id), ['A', 'B']);
});

test('the HTTP client retries a rate limit, then succeeds', async () => {
  let calls = 0;
  const api = new ApiClient({
    name: 'X',
    baseUrl: 'https://x.test',
    retries: 2,
    fetchImpl: async () => (++calls === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '0' } }) : new Response('{"ok":true}', { status: 200 })),
  });
  assert.deepEqual(await api.get('/a'), { ok: true });
  assert.equal(calls, 2);
});

test('the HTTP client explains a sign-in page answering instead of the API', async () => {
  const api = new ApiClient({ name: 'Azure DevOps', baseUrl: 'https://x.test', retries: 0, fetchImpl: async () => new Response('<html>Sign in</html>', { status: 203 }) });
  await assert.rejects(api.get('/a'), /did not return JSON/);
});

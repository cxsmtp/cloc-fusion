// Bitbucket Data Center / Server. Organizations are projects.
import { ApiClient } from '../http.js';

const nextOf = (data, _res, url) => {
  if (!data || data.isLastPage !== false || data.nextPageStart === undefined) return null;
  const u = new URL(url);
  u.searchParams.set('start', String(data.nextPageStart));
  return u.toString();
};

export default {
  id: 'bitbucket-server',
  label: 'Bitbucket Data Center / Server',
  defaultApiUrl: '',
  apiUrlHint: 'https://bitbucket.example.com (the address you open in a browser)',
  orgNoun: 'project',
  authMethods: [
    {
      id: 'http-token',
      label: 'HTTP access token (personal, project or repository)',
      help: ['Profile picture → Manage account → HTTP access tokens. Permissions: Project read, Repository read.'],
    },
  ],

  client(conn, secret) {
    const root = String(conn.apiUrl || '').replace(/\/+$/, '').replace(/\/rest\/api\/1\.0$/, '');
    return new ApiClient({ name: 'Bitbucket Server', baseUrl: `${root}/rest/api/1.0`, headers: { Authorization: `Bearer ${secret.token}` } });
  },

  async whoami(api) {
    const { res } = await api.request('/projects?limit=1');
    return res.headers.get('x-ausername') || 'signed in';
  },

  async listOrgs(api) {
    const list = await api.paginate('/projects?limit=100', { items: (d) => d?.values || [], next: nextOf });
    return list.map((p) => ({ id: p.key, label: `${p.key} — ${p.name}` }));
  },

  async listRepos(api, org) {
    const list = await api.paginate(`/projects/${encodeURIComponent(org)}/repos?limit=100`, { items: (d) => d?.values || [], next: nextOf });
    const out = [];
    for (const r of list) {
      let defaultBranch = null;
      try {
        const b = await api.get(`/projects/${encodeURIComponent(org)}/repos/${encodeURIComponent(r.slug)}/default-branch`, { allow404: true });
        defaultBranch = b?.displayId || null;
      } catch {}
      out.push({
        id: String(r.id),
        name: r.slug,
        fullName: `${org}/${r.slug}`,
        cloneUrl: stripUser((r.links?.clone || []).find((c) => c.name === 'http')?.href || ''),
        webUrl: r.links?.self?.[0]?.href,
        defaultBranch,
        archived: Boolean(r.archived),
        fork: Boolean(r.origin),
        private: !r.public,
        empty: false,
        sizeKb: null,
        language: null,
        createdAt: null,
        pushedAt: null,
      });
    }
    return out;
  },

  gitAuthHeader(_conn, secret) {
    return `Bearer ${secret.token}`;
  },
};

function stripUser(url) {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return url;
  }
}

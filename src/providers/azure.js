// Azure DevOps Services (dev.azure.com) and Azure DevOps Server. Organizations are Azure DevOps
// organizations (Server: collections); every project's Git repositories are included.
import { ApiClient, basic } from '../http.js';

const API = 'api-version=7.1';
const VSSPS = 'https://app.vssps.visualstudio.com';
// The Azure DevOps resource id, for Microsoft Entra ID tokens.
const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';

const isCloud = (conn) => !conn.apiUrl || /(^|\.)dev\.azure\.com$|\.visualstudio\.com$/i.test(new URL(conn.apiUrl).host);

export default {
  id: 'azure',
  label: 'Azure DevOps (Services or Server)',
  defaultApiUrl: 'https://dev.azure.com',
  apiUrlHint: 'https://dev.azure.com — Server: https://<host>/tfs (collections are the organizations)',
  orgNoun: 'organization',
  authMethods: [
    {
      id: 'pat',
      label: 'Personal access token',
      help: [
        'Create one at https://dev.azure.com/<org>/_usersSettings/tokens (User settings → Personal access tokens).',
        'Organization: "All accessible organizations" so every organization can be listed and scanned.',
        'Scopes: Code (Read), plus User Profile (Read) so the tool can list your organizations for you.',
      ],
    },
    {
      id: 'entra',
      label: 'Microsoft Entra ID via Azure CLI (az login: browser / SSO, works with Okta federation)',
      help: [
        'Runs `az account get-access-token` each time; sign in first with `az login`',
        '  (`az login --allow-no-subscriptions` if your account has no Azure subscription).',
        'Tokens last about an hour; the tool asks for a fresh one when it starts.',
      ],
      tokenCommand: () => `az account get-access-token --resource ${ADO_RESOURCE} --query accessToken -o tsv`,
      bearer: true,
    },
  ],

  authHeader(conn, secret) {
    return conn.auth?.method === 'entra' ? `Bearer ${secret.token}` : basic('', secret.token);
  },

  client(conn, secret) {
    return new ApiClient({ name: 'Azure DevOps', baseUrl: (conn.apiUrl || this.defaultApiUrl).replace(/\/+$/, ''), headers: { Authorization: this.authHeader(conn, secret) } });
  },

  async whoami(api, conn) {
    if (!isCloud(conn)) {
      const data = await api.get(`/_apis/connectionData`);
      return data?.authenticatedUser?.providerDisplayName || 'signed in';
    }
    try {
      const me = await api.get(`${VSSPS}/_apis/profile/profiles/me?${API}`);
      return me.emailAddress || me.displayName || me.id;
    } catch (err) {
      // A token without the User Profile scope, or made for one organization: checked per organization later.
      if ([401, 403].includes(err.status)) return null;
      throw err;
    }
  },

  async listOrgs(api, conn) {
    if (!isCloud(conn)) {
      const data = await api.get(`/_apis/projectCollections?${API}`);
      return (data?.value || []).map((c) => ({ id: c.name, label: c.name }));
    }
    const me = await api.get(`${VSSPS}/_apis/profile/profiles/me?${API}`);
    const data = await api.get(`${VSSPS}/_apis/accounts?memberId=${encodeURIComponent(me.id)}&${API}`);
    return (data?.value || []).map((a) => ({ id: a.accountName, label: a.accountName }));
  },

  async listRepos(api, org, conn) {
    const base = (conn.apiUrl || this.defaultApiUrl).replace(/\/+$/, '');
    const data = await api.get(`${base}/${encodeURIComponent(org)}/_apis/git/repositories?${API}`);
    return (data?.value || []).map((r) => ({
      id: r.id,
      name: r.name,
      fullName: `${org}/${r.project?.name}/${r.name}`,
      cloneUrl: stripUser(r.remoteUrl),
      webUrl: r.webUrl,
      defaultBranch: r.defaultBranch ? r.defaultBranch.replace(/^refs\/heads\//, '') : null,
      archived: Boolean(r.isDisabled),
      fork: Boolean(r.isFork),
      private: r.project?.visibility !== 'public',
      empty: !r.defaultBranch || r.size === 0,
      sizeKb: Number.isFinite(r.size) ? Math.round(r.size / 1024) : null,
      language: null,
      createdAt: null,
      pushedAt: r.project?.lastUpdateTime || null,
    }));
  },

  gitAuthHeader(conn, secret) {
    return this.authHeader(conn, secret);
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

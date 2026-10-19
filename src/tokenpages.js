// Where to create a token for a connection, with the right scopes ticked where the platform allows
// it. Pure, so the web app and the standalone HTML page share it.

export const webOf = (conn, fallback) => {
  try {
    const u = new URL(conn.apiUrl || fallback);
    if (u.host === 'api.github.com') return 'https://github.com';
    if (u.host === 'api.bitbucket.org') return 'https://bitbucket.org';
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
};

/** Where to create a token for a connection, with scopes pre-selected where the platform allows. */
export function tokenPageUrl(conn) {
  const name = encodeURIComponent('cloc-fusion');
  switch (conn.provider) {
    case 'github':
      return `${webOf(conn, 'https://api.github.com')}/settings/tokens/new?scopes=repo,read:org&description=${name}`;
    case 'gitlab':
      return `${webOf(conn, 'https://gitlab.com')}/-/user_settings/personal_access_tokens?name=${name}&scopes=read_api,read_repository`;
    case 'azure': {
      const org = Array.isArray(conn.orgs) && conn.orgs[0] && conn.orgs[0] !== '@me' ? conn.orgs[0] : '';
      return org ? `https://dev.azure.com/${encodeURIComponent(org)}/_usersSettings/tokens` : 'https://aex.dev.azure.com/me';
    }
    case 'bitbucket':
      return 'https://id.atlassian.com/manage-profile/security/api-tokens';
    case 'bitbucket-server':
      return `${webOf(conn, '')}/plugins/servlet/access-tokens/manage`;
    default:
      return '';
  }
}

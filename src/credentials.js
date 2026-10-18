// Tokens saved by browser sign-in (or pasted once in the web app), kept out of the configuration
// file: ~/.cloc-fusion/credentials.json, owner-only, keyed by connection name. A connection points
// at its saved token with "token": { "saved": true }.
import { readFile, writeFile, mkdir, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const credentialsDir = () => process.env.CLOC_FUSION_HOME || join(homedir(), '.cloc-fusion');
const file = () => join(credentialsDir(), 'credentials.json');

async function readAll() {
  try {
    const data = JSON.parse(await readFile(file(), 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/** The saved token for a connection, or ''. */
export async function savedToken(connectionName) {
  const all = await readAll();
  return Object.hasOwn(all, connectionName) ? String(all[connectionName]?.token || '') : '';
}

/** Save (or with an empty token, forget) a connection's token. Written atomically, owner-only. */
export async function saveToken(connectionName, token, meta = {}) {
  const all = await readAll();
  if (token) all[connectionName] = { token, savedAt: new Date().toISOString(), ...meta };
  else delete all[connectionName];
  await mkdir(credentialsDir(), { recursive: true, mode: 0o700 });
  const tmp = `${file()}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  await chmod(tmp, 0o600).catch(() => {});
  await rename(tmp, file());
}

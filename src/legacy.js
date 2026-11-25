// Connection names that earlier versions shipped as defaults, renamed when saved settings load
// (the standalone page's browser storage, the web app's and the CLI's configuration file).
// The old name is kept as formerName so a token saved under it is still found.
const RENAMED = { 'cxsmtp-git': 'github' };

/** Renames legacy default connections in place, unless the new name is already taken. */
export function renameLegacyConnections(connections) {
  if (!Array.isArray(connections)) return connections;
  const taken = new Set(connections.map((c) => c?.name));
  for (const c of connections) {
    const to = c && Object.hasOwn(RENAMED, c.name) ? RENAMED[c.name] : null;
    if (!to || taken.has(to)) continue;
    taken.delete(c.name);
    taken.add(to);
    c.formerName = c.name;
    c.name = to;
  }
  return connections;
}

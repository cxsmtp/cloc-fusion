// The standalone page has no file system: version.js reads the changelog from disk only when run
// from source, and falls back gracefully when this throws.
export function readFileSync() {
  throw new Error('no file system in the browser');
}

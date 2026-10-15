// Reading repository archives without any external tool: a streaming .tar.gz reader (GitHub,
// GitLab, Bitbucket) and a .zip reader (Azure DevOps), both on Node's built-in zlib.
//
// Both are defensive about what they read: entry names are only used as text (never as file
// paths: nothing is extracted to disk), sizes are bounded, and decompression stops past a limit,
// so a hostile or corrupt archive cannot exhaust memory or disk.
import { createGunzip, inflateRawSync } from 'node:zlib';
import { open } from 'node:fs/promises';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BLOCK = 512;

const text = (buf, start, len) => {
  const s = buf.subarray(start, start + len);
  const nul = s.indexOf(0);
  return (nul < 0 ? s : s.subarray(0, nul)).toString('utf8');
};

function octal(buf, start, len) {
  const s = buf.subarray(start, start + len);
  if (s[0] & 0x80) {
    // GNU base-256 for sizes over 8 GB.
    let n = 0;
    for (let i = 1; i < s.length; i++) n = n * 256 + s[i];
    return n;
  }
  const t = text(buf, start, len).trim();
  return t ? parseInt(t, 8) : 0;
}

/** pax extended header records ("len key=value\n") → { key: value }. */
function paxRecords(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length) {
    const sp = buf.indexOf(32, i);
    if (sp < 0) break;
    const len = parseInt(buf.subarray(i, sp).toString(), 10);
    if (!len || len < 0 || i + len > buf.length) break;
    const rec = buf.subarray(sp + 1, i + len - 1).toString('utf8');
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    i += len;
  }
  return out;
}

/**
 * A Writable that parses a tar stream. For every regular file, `onEntry({ path, size })` returns
 * whether its content is wanted; wanted files are passed whole to `onFile({ path, size }, Buffer)`.
 * `maxFileBytes` bounds a wanted file's buffer.
 */
export class TarReader extends Writable {
  constructor({ onEntry, onFile, maxFileBytes = 2 * 1024 * 1024, maxMetaBytes = 1024 * 1024 }) {
    super();
    this.onEntry = onEntry;
    this.onFile = onFile;
    this.maxFileBytes = maxFileBytes;
    this.maxMetaBytes = maxMetaBytes;
    this.buf = Buffer.alloc(0);
    this.state = 'header';
    this.entry = null;
    this.remaining = 0; // content bytes of the current entry still to come
    this.padding = 0;
    this.chunks = null;
    this.nextPath = null; // from a pax 'x' or GNU 'L' entry
    this.done = false;
    this.entries = 0;
  }

  _write(chunk, _enc, cb) {
    try {
      if (!this.done) this.consume(chunk);
      cb();
    } catch (err) {
      cb(err);
    }
  }

  consume(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      if (this.state === 'header') {
        if (this.buf.length < BLOCK) return;
        const h = this.buf.subarray(0, BLOCK);
        this.buf = this.buf.subarray(BLOCK);
        if (h.every((b) => b === 0)) {
          this.done = true; // end of archive
          return;
        }
        const size = octal(h, 124, 12);
        const type = String.fromCharCode(h[156] || 48);
        const prefix = h.subarray(257, 262).toString() === 'ustar' ? text(h, 345, 155) : '';
        const name = this.nextPath ?? (prefix ? `${prefix}/${text(h, 0, 100)}` : text(h, 0, 100));
        this.nextPath = null;
        this.remaining = size;
        this.padding = (BLOCK - (size % BLOCK)) % BLOCK;
        if (type === 'x' || type === 'L' || type === 'g') {
          if (size > this.maxMetaBytes) throw new Error('archive metadata entry too large');
          this.entry = { meta: type };
          this.chunks = [];
        } else if (type === '0' || type === '\0' || type === '7') {
          this.entries++;
          const e = { path: name, size };
          const want = size <= this.maxFileBytes && this.onEntry(e);
          this.entry = want ? e : null;
          this.chunks = want ? [] : null;
        } else {
          this.entry = null; // directories, links, devices: skipped
          this.chunks = null;
        }
        this.state = 'body';
      }
      if (this.state === 'body') {
        if (this.remaining > 0) {
          if (!this.buf.length) return;
          const take = Math.min(this.remaining, this.buf.length);
          if (this.chunks) this.chunks.push(this.buf.subarray(0, take));
          this.buf = this.buf.subarray(take);
          this.remaining -= take;
          if (this.remaining > 0) return;
        }
        if (this.chunks) {
          const content = Buffer.concat(this.chunks);
          if (this.entry.meta === 'x') this.nextPath = paxRecords(content).path ?? null;
          else if (this.entry.meta === 'L') this.nextPath = text(content, 0, content.length);
          else if (!this.entry.meta) this.onFile(this.entry, content);
        }
        this.chunks = null;
        this.entry = null;
        this.state = 'pad';
      }
      if (this.state === 'pad') {
        if (this.buf.length < this.padding) {
          this.padding -= this.buf.length;
          this.buf = Buffer.alloc(0);
          return;
        }
        this.buf = this.buf.subarray(this.padding);
        this.padding = 0;
        this.state = 'header';
      }
    }
  }
}

/** Counts bytes through a stream and fails past `limit` (a decompression bomb guard). */
function limiter(limit, what) {
  let seen = 0;
  return async function* (source) {
    for await (const chunk of source) {
      seen += chunk.length;
      if (seen > limit) throw new Error(`${what} is larger than ${Math.round(limit / 1048576)} MB uncompressed (raise maxArchiveBytes, or use the git engine)`);
      yield chunk;
    }
  };
}

/** Read a .tar.gz web stream / async iterable. See TarReader for the callbacks. */
export async function readTarGz(body, { onEntry, onFile, maxFileBytes, maxArchiveBytes = 4 * 1024 ** 3 }) {
  const reader = new TarReader({ onEntry, onFile, maxFileBytes });
  await pipeline(body, createGunzip(), limiter(maxArchiveBytes, 'the archive'), reader);
  return { entries: reader.entries };
}

/**
 * Read a .zip file on disk (random access: the central directory is at the end). Same callbacks.
 * Supports stored and deflated entries; zip64 archives are refused with a clear message.
 */
export async function readZipFile(path, { onEntry, onFile, maxFileBytes = 2 * 1024 * 1024, maxArchiveBytes = 4 * 1024 ** 3 }) {
  const fh = await open(path, 'r');
  try {
    const { size } = await fh.stat();
    const tailLen = Math.min(size, 65557);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('not a zip archive');
    const count = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('zip64 archives are not supported: use the git engine for this repository');
    if (cdOffset + cdSize > size) throw new Error('corrupt zip archive');
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdOffset);
    let p = 0;
    let entries = 0;
    let inflated = 0; // all output so far, bounded like a tarball's
    const offsets = new Set(); // entries sharing data would multiply the work
    if (count > 1000000) throw new Error('zip archive has too many entries');
    for (let n = 0; n < count && p + 46 <= cd.length; n++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip central directory');
      const method = cd.readUInt16LE(p + 10);
      const csize = cd.readUInt32LE(p + 20);
      const usize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const local = cd.readUInt32LE(p + 42);
      const name = cd.subarray(p + 46, p + 46 + nameLen).toString('utf8');
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue;
      entries++;
      const e = { path: name, size: usize };
      if (usize > maxFileBytes || !onEntry(e)) continue;
      if (method !== 0 && method !== 8) continue;
      if (csize > maxFileBytes * 2 + 1024) continue;
      if (offsets.has(local)) continue;
      offsets.add(local);
      if (local + 30 > size || csize > size) throw new Error('corrupt zip entry');
      const lh = Buffer.alloc(30);
      await fh.read(lh, 0, 30, local);
      if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('corrupt zip entry');
      const dataStart = local + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
      const data = Buffer.alloc(csize);
      await fh.read(data, 0, csize, dataStart);
      const content = method === 0 ? data : inflateRawSync(data, { maxOutputLength: maxFileBytes + 1 });
      inflated += content.length;
      if (inflated > maxArchiveBytes) throw new Error(`the archive is larger than ${Math.round(maxArchiveBytes / 1048576)} MB uncompressed (raise maxArchiveBytes, or use the git engine)`);
      if (content.length <= maxFileBytes) onFile(e, content);
    }
    return { entries };
  } finally {
    await fh.close();
  }
}

/** Strip the archive's single top-level folder ("owner-repo-sha/src/a.js" → "src/a.js"). */
export function stripTop(path) {
  const i = path.indexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

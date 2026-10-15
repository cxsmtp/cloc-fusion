// A small JSON-over-HTTPS client for the providers' REST APIs: retries on rate limits and server
// errors, follows pagination, and never puts the token anywhere but the Authorization header.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/** How long to wait before retrying a response, in ms (null: don't retry). */
function retryDelay(res, attempt) {
  const after = res.headers.get('retry-after');
  if (after) {
    const s = Number(after);
    if (Number.isFinite(s)) return Math.min(s * 1000, 120000);
    const at = Date.parse(after);
    if (Number.isFinite(at)) return Math.min(Math.max(0, at - Date.now()), 120000);
  }
  // GitHub: primary rate limit exhausted. Wait for a reset that is close; give up on a far one.
  if (res.headers.get('x-ratelimit-remaining') === '0' && res.headers.get('x-ratelimit-reset')) {
    const wait = Number(res.headers.get('x-ratelimit-reset')) * 1000 - Date.now() + 1000;
    return wait <= 120000 ? Math.max(1000, wait) : null;
  }
  return Math.min(1000 * 2 ** attempt, 30000);
}

export class ApiClient {
  /**
   * @param {object} o
   * @param {string} o.name      provider name, for messages
   * @param {string} o.baseUrl   API root
   * @param {Record<string,string>} [o.headers] auth and other headers
   */
  constructor({ name, baseUrl, headers = {}, fetchImpl = globalThis.fetch, retries = 5, timeoutMs = 60000 }) {
    this.name = name;
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.headers = headers;
    this.fetch = fetchImpl;
    this.retries = retries;
    this.timeoutMs = timeoutMs;
  }

  url(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /** GET (or other method) returning { data, res }. Throws HttpError on a final failure. */
  async request(path, { method = 'GET', body, headers = {}, allow404 = false } = {}) {
    const url = this.url(path);
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await this.fetch(url, {
          method,
          headers: { Accept: 'application/json', 'User-Agent': 'cloc-fusion', ...this.headers, ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: 'follow',
        });
      } catch (err) {
        if (attempt < this.retries) {
          await sleep(Math.min(1000 * 2 ** attempt, 30000));
          continue;
        }
        throw new HttpError(`${this.name}: could not reach ${new URL(url).host} (${err.cause?.code || err.message})`, { url });
      }
      if (res.ok) {
        const text = await res.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new HttpError(`${this.name}: ${url} did not return JSON (is the API URL right? a sign-in page or proxy may have answered)`, { status: res.status, url, body: text.slice(0, 300) });
        }
        return { data, res };
      }
      if (res.status === 404 && allow404) return { data: null, res };
      const retryable = res.status === 429 || res.status >= 500 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
      const delay = retryable && attempt < this.retries ? retryDelay(res, attempt) : null;
      if (delay !== null) {
        await sleep(delay);
        continue;
      }
      if (res.headers.get('x-ratelimit-remaining') === '0' && res.headers.get('x-ratelimit-reset')) {
        const at = new Date(Number(res.headers.get('x-ratelimit-reset')) * 1000);
        throw new HttpError(`${this.name}: API rate limit reached; it resets at ${at.toLocaleTimeString()}. Run again then (add --resume with the partial report to skip what is done).`, { status: res.status, url });
      }
      const text = await res.text().catch(() => '');
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        detail = j.message || j.error_description || j.error?.message || j.error || j.errors?.[0]?.message || detail;
        if (typeof detail === 'object') detail = JSON.stringify(detail);
      } catch {}
      throw new HttpError(`${this.name}: ${method} ${new URL(url).pathname} → HTTP ${res.status}${detail ? `: ${detail}` : ''}`, { status: res.status, url, body: text.slice(0, 500) });
    }
  }

  async get(path, opts) {
    return (await this.request(path, opts)).data;
  }

  /**
   * Every item of a paginated list. `next(data, res, url)` returns the next page's URL or null;
   * `items(data)` the page's items. Stops after `max` items.
   */
  async paginate(path, { items = (d) => d, next = linkNext, max = 100000 } = {}) {
    const out = [];
    let url = this.url(path);
    const seen = new Set();
    while (url && !seen.has(url) && out.length < max) {
      seen.add(url);
      const { data, res } = await this.request(url);
      const page = items(data) || [];
      out.push(...page);
      url = page.length ? next(data, res, url) : null;
      if (url && !/^https?:/i.test(url)) url = this.url(url);
    }
    return out.slice(0, max);
  }
}

/** RFC 5988 Link header rel="next" (GitHub, GitLab). */
export function linkNext(_data, res) {
  const link = res.headers.get('link');
  if (!link) return null;
  for (const part of link.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (m) return m[1];
  }
  return null;
}

export const basic = (user, pass) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

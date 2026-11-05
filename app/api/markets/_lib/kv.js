// Small shared key-value store for the markets: frozen bucket edges per window, settled fits and the
// calibration. Redis when REDIS_URL is set (the Vercel marketplace integration), else process memory,
// which is enough for a single-region preview and degrades to recomputation across lambdas.

import Redis from 'ioredis';

const mem = new Map();

function redis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!globalThis.__ptmRedis) globalThis.__ptmRedis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  return globalThis.__ptmRedis;
}

export async function kvGet(key) {
  const r = redis();
  if (r) return r.get(key);
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) { mem.delete(key); return null; }
  return e.value;
}

// Set a value. With nx, only when the key is absent or expired; returns whether it was written.
export async function kvSet(key, value, { ttlMs, nx } = {}) {
  const r = redis();
  if (r) {
    const args = [key, value];
    if (ttlMs) args.push('PX', ttlMs);
    if (nx) args.push('NX');
    return (await r.set(...args)) === 'OK';
  }
  const cur = mem.get(key);
  if (nx && cur && !(cur.exp && cur.exp < Date.now())) return false;
  mem.set(key, { value, exp: ttlMs ? Date.now() + ttlMs : null });
  return true;
}

export async function kvDel(key) {
  const r = redis();
  if (r) { await r.del(key); return; }
  mem.delete(key);
}

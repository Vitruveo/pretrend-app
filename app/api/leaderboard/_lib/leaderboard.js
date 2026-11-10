// Leaderboard from PretrendMarkets events. Events are read from the chain incrementally (Bought, Resolved, Voided,
// Claimed), kept in the shared KV store, and aggregated per wallet on request. Only settled markets (resolved or
// voided) count toward the standings; buys in markets still running are reported as "in play".

import { createPublicClient, defineChain, formatUnits, http } from 'viem';
import { kvGet, kvSet } from '../../markets/_lib/kv';
import { MARKET_TYPE_IDS, PRETREND_MARKETS_ABI, PRETREND_MARKETS_ADDRESS } from '../../../config/pretrend-markets';

const DEPLOY_BLOCK = 5412421n;
const CHUNK = 5000n;
const STORE_KEY = 'lb:events:v1';
const LOCK_KEY = 'lb:lock:v1';
const FRESH_MS = 20_000;

const vitruveo = defineChain({
  id: 1490,
  name: 'Vitruveo',
  nativeCurrency: { name: 'Vitruveo', symbol: 'VTRU', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.vitruveo.ai'] } },
});
const client = createPublicClient({ chain: vitruveo, transport: http() });

export const TYPE_SLUGS = Object.fromEntries(Object.entries(MARKET_TYPE_IDS).map(([slug, id]) => [String(id), slug]));

function pack(ev) {
  const a = ev.args;
  const t = String(a.typeId);
  const s = Number(a.start);
  switch (ev.eventName) {
    case 'Bought': return { e: 'B', t, s, a: a.buyer.toLowerCase(), b: Number(a.bucket), m: String(a.amount), u: String(a.units), f: String(a.fee) };
    case 'Resolved': return { e: 'R', t, s, w: Number(a.winner), lp: String(a.losingPool) };
    case 'Voided': return { e: 'V', t, s };
    case 'Claimed': return { e: 'C', t, s, a: a.account.toLowerCase(), m: String(a.amount) };
    default: return null;
  }
}

async function load() {
  const raw = await kvGet(STORE_KEY);
  return raw ? JSON.parse(raw) : { last: String(DEPLOY_BLOCK - 1n), at: 0, events: [] };
}

// Pull events since the last stored block. One refresher at a time; others serve what is stored.
export async function events() {
  let store = await load();
  if (Date.now() - store.at < FRESH_MS) return store;
  const locked = !(await kvSet(LOCK_KEY, '1', { ttlMs: 30_000, nx: true }));
  if (locked) return store;
  try {
    store = await load();
    const head = await client.getBlockNumber();
    let from = BigInt(store.last) + 1n;
    while (from <= head) {
      const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
      const logs = await client.getContractEvents({ address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, fromBlock: from, toBlock: to });
      for (const ev of logs) {
        const p = pack(ev);
        if (p) store.events.push(p);
      }
      store.last = String(to);
      from = to + 1n;
    }
    store.at = Date.now();
    await kvSet(STORE_KEY, JSON.stringify(store));
  } finally {
    await kvSet(LOCK_KEY, '', { ttlMs: 1 });
  }
  return store;
}

const num = (wei) => Number(formatUnits(wei, 18));

// Standings per wallet for one market type ('all' or a slug) over markets that started after `since` (unix s).
export function standings(store, { slug = 'all', since = 0 } = {}) {
  const typeId = slug === 'all' ? null : String(MARKET_TYPE_IDS[slug] ?? '');
  const markets = new Map(); // `${t}:${s}` -> market
  const keep = (ev) => (typeId === null || ev.t === typeId) && ev.s >= since;
  const mk = (ev) => {
    const k = `${ev.t}:${ev.s}`;
    let m = markets.get(k);
    if (!m) {
      m = { t: ev.t, s: ev.s, status: 'open', winner: null, lp: 0n, units: [0n, 0n, 0n, 0n, 0n], users: new Map() };
      markets.set(k, m);
    }
    return m;
  };
  const claims = new Map(); // `${addr}:${t}:${s}` -> claimed wei

  for (const ev of store.events) {
    if (!keep(ev)) continue;
    const m = mk(ev);
    if (ev.e === 'B') {
      let u = m.users.get(ev.a);
      if (!u) {
        u = { amount: [0n, 0n, 0n, 0n, 0n], units: [0n, 0n, 0n, 0n, 0n], fee: 0n };
        m.users.set(ev.a, u);
      }
      u.amount[ev.b] += BigInt(ev.m);
      u.units[ev.b] += BigInt(ev.u);
      u.fee += BigInt(ev.f);
      m.units[ev.b] += BigInt(ev.u);
    } else if (ev.e === 'R') {
      m.status = 'resolved';
      m.winner = ev.w;
      m.lp = BigInt(ev.lp);
    } else if (ev.e === 'V') {
      m.status = 'voided';
    } else if (ev.e === 'C') {
      const k = `${ev.a}:${ev.t}:${ev.s}`;
      claims.set(k, (claims.get(k) || 0n) + BigInt(ev.m));
    }
  }

  const rows = new Map();
  const row = (addr) => {
    let r = rows.get(addr);
    if (!r) {
      r = { address: addr, buy: 0n, fees: 0n, win: 0n, refunded: 0n, unclaimed: 0n, inPlay: 0n, markets: 0, won: 0, lost: 0, voided: 0, best: 0 };
      rows.set(addr, r);
    }
    return r;
  };

  for (const m of markets.values()) {
    for (const [addr, u] of m.users) {
      const r = row(addr);
      const buy = u.amount.reduce((a, b) => a + b, 0n);
      if (m.status === 'open') {
        r.inPlay += buy;
        continue;
      }
      r.markets += 1;
      r.buy += buy;
      r.fees += u.fee;
      let owed = 0n;
      if (m.status === 'voided') {
        r.voided += 1;
        r.refunded += buy;
        owed = buy;
      } else if (u.units[m.winner] > 0n) {
        const payout = u.amount[m.winner] + (u.units[m.winner] * m.lp) / m.units[m.winner];
        r.won += 1;
        r.win += payout;
        owed = payout;
        const cost = num(buy + u.fee);
        if (cost > 0) r.best = Math.max(r.best, num(payout) / cost);
      } else {
        r.lost += 1;
      }
      const claimed = claims.get(`${addr}:${m.t}:${m.s}`) || 0n;
      if (owed > claimed) r.unclaimed += owed - claimed;
    }
  }

  return [...rows.values()].map((r) => {
    const net = r.win + r.refunded - r.buy - r.fees;
    const cost = r.buy + r.fees;
    return {
      address: r.address,
      buy: num(r.buy),
      win: num(r.win),
      markets: r.markets,
      won: r.won,
      lost: r.lost,
      voided: r.voided,
      net: num(net),
      fees: num(r.fees),
      winRate: r.won + r.lost > 0 ? r.won / (r.won + r.lost) : null,
      roi: cost > 0n ? num(net) / num(cost) : null,
      best: r.best || null,
      refunded: num(r.refunded),
      unclaimed: num(r.unclaimed),
      inPlay: num(r.inPlay),
    };
  });
}

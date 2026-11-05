// Server-side access to the TrendPulse oracle for a market: window series fetches and quintile
// calibration of the bucket thresholds.

import { TRENDPULSE_BASE, rulesFor, tsOls } from '../../../markets/_lib/gamemath';
import { kvGet, kvSet } from './kv';

const CAL_DAYS = 3; // history used for quintiles (the oracle serves at most one day per call)
const CAL_TTL_S = 900; // recalibrate every 15 minutes
const MIN_WINDOWS = 30;

export async function fetchSeries(source, fromS, toS) {
  const res = await fetch(`${TRENDPULSE_BASE}/series?source=${source}&from=${fromS}&to=${toS}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`oracle series ${res.status}`);
  const d = await res.json();
  if (!Array.isArray(d.points)) throw new Error(d.error || 'oracle series malformed');
  return d.points;
}

// Bucket edges from every complete window in the last CAL_DAYS (windows with too few points are
// skipped). With MIN_WINDOWS or more: quintiles of the windows' trendAbs, so each bucket wins about
// one window in five. With fewer: the default of five equal 20% buckets, spanning the pulse's recent
// swing: outer edges at minus and plus the median high-to-low range of the recent windows, so a Moon
// is a trend of more than 60% of a typical window's swing. With no window at all: null, and the
// starting edges apply.
async function computeCalibration(market) {
  const rules = rulesFor(market);
  const now = Math.floor(Date.now() / 1000);
  const windows = new Map();
  for (let d = 0; d < CAL_DAYS; d++) {
    const to = now - d * 86400;
    const from = to - 86400;
    let pts;
    try {
      pts = await fetchSeries(market.source, from, to);
    } catch (e) {
      break;
    }
    if (!pts.length) break;
    for (const p of pts) {
      const k = Math.floor(p[0] / rules.gameS) * rules.gameS;
      if (k + rules.gameS > now) continue; // the current window is incomplete
      let w = windows.get(k);
      if (!w) windows.set(k, (w = []));
      w.push(p);
    }
  }
  const vals = [];
  const swings = []; // [windowStart, high - low]
  for (const [k, w] of windows) {
    if (w.length < rules.minSettlePoints) continue;
    w.sort((x, y) => x[0] - y[0]);
    const fit = tsOls(w);
    if (!fit) continue;
    vals.push(fit.trendAbs);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, v] of w) { if (v < lo) lo = v; if (v > hi) hi = v; }
    swings.push([k, hi - lo]);
  }
  vals.sort((x, y) => x - y);
  if (vals.length === 0) return null;
  const r2 = (x) => Math.round(x * 100) / 100;
  if (vals.length < MIN_WINDOWS) {
    const recent = swings.sort((a, b) => b[0] - a[0]).slice(0, 12).map((x) => x[1]).sort((a, b) => a - b);
    const reach = recent[Math.floor(recent.length / 2)];
    if (!(reach > 0)) return null;
    return { thresholds: [-0.6, -0.2, 0.2, 0.6].map((f) => r2(f * reach)), windows: vals.length, calibratedAt: now, mode: 'equal' };
  }
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))];
  return { thresholds: [0.2, 0.4, 0.6, 0.8].map((p) => r2(q(p))), windows: vals.length, calibratedAt: now, mode: 'quintile' };
}

// Starting edges before enough history exists: the oracle's configured defaults for the source when it
// reports itself uncalibrated, else the market's own fallback.
async function startingThresholds(market) {
  try {
    const res = await fetch(`${TRENDPULSE_BASE}/stats/thresholds?source=${market.source}&window=${market.windowS}&lookback=3`, { cache: 'no-store' });
    const d = await res.json();
    const t = [d.q20, d.q40, d.q60, d.q80];
    if (res.ok && d.calibrated === false && t.every((x) => Number.isFinite(x))) return t;
  } catch (e) {
    // fall through
  }
  return market.fallbackThresholds;
}

const memo = new Map(); // slug -> { value, expiresAt }
const inflight = new Map();

// Calibration with three layers: process memo, the shared kv store, fresh compute. Falls back to the
// starting edges with fallback: true.
export async function getCalibration(market) {
  const now = Math.floor(Date.now() / 1000);
  const m = memo.get(market.slug);
  if (m && m.expiresAt > now) return m.value;
  if (inflight.has(market.slug)) return inflight.get(market.slug);
  const key = `markets:cal:${market.slug}`;
  const p = (async () => {
    try {
      const raw = await kvGet(key).catch(() => null);
      if (raw) {
        const v = JSON.parse(raw);
        memo.set(market.slug, { value: v, expiresAt: now + 60 });
        return v;
      }
      let v = null;
      try {
        v = await computeCalibration(market);
      } catch (e) {
        console.error(`[markets] calibration failed for ${market.slug}:`, e.message);
      }
      if (!v) v = { thresholds: await startingThresholds(market), windows: 0, calibratedAt: null, mode: 'starting', fallback: true };
      // equal-slice edges move with every new window early on; refresh them every 5 minutes
      await kvSet(key, JSON.stringify(v), { ttlMs: (v.mode === 'quintile' ? CAL_TTL_S : 300) * 1000 }).catch(() => {});
      memo.set(market.slug, { value: v, expiresAt: now + 60 });
      return v;
    } finally {
      inflight.delete(market.slug);
    }
  })();
  inflight.set(market.slug, p);
  return p;
}

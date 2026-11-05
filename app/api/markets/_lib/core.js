// Server core for a Pretrend market: the clock and calibration, bucket edges frozen per window so every
// viewer and the settlement agree, and the settled OLS fit of each closed window from the TrendPulse
// oracle. No stakes or chain yet: the market is reproduced in full, play settles when that is designed.

import { rulesFor, gameStartFor, phaseOf, tsOls, bLimitFor, bucketOf } from '../../../markets/_lib/gamemath';
import { fetchSeries, getCalibration } from './live';
import { kvGet, kvSet } from './kv';

const WINDOW_TTL_MS = 2 * 86400 * 1000;
const nowS = () => Math.floor(Date.now() / 1000);

const key = {
  thresholds: (slug, start) => `markets:thr:${slug}:${start}`,
  fit: (slug, start) => `markets:fit:${slug}:${start}`,
};

export async function handleLive(market) {
  const rules = rulesFor(market);
  const cal = await getCalibration(market);
  const now = nowS();
  const start = gameStartFor(now, rules.gameS);
  return [
    200,
    {
      market: market.slug,
      source: market.source,
      gameS: rules.gameS,
      lockS: rules.lockS,
      settleDelayS: rules.settleDelayS,
      serverNow: now,
      start,
      phase: phaseOf(start, now, rules),
      thresholds: cal.thresholds,
      bLimit: bLimitFor(cal.thresholds, rules.gameS),
      calibration: { windows: cal.windows, calibratedAt: cal.calibratedAt, fallback: !!cal.fallback },
    },
  ];
}

// Bucket edges for one window, frozen the first time anyone asks.
async function windowThresholds(market, start) {
  const k = key.thresholds(market.slug, start);
  const raw = await kvGet(k);
  if (raw) return JSON.parse(raw);
  const cal = await getCalibration(market);
  await kvSet(k, JSON.stringify(cal.thresholds), { ttlMs: WINDOW_TTL_MS, nx: true });
  return JSON.parse((await kvGet(k)) || 'null') || cal.thresholds;
}

function parseStart(market, raw) {
  const rules = rulesFor(market);
  const start = parseInt(raw, 10);
  if (!Number.isFinite(start) || start % rules.gameS !== 0) return null;
  return start;
}

export async function handleWindow(market, startRaw) {
  const start = parseStart(market, startRaw);
  if (start === null) return [400, { error: 'bad start' }];
  const rules = rulesFor(market);
  const now = nowS();
  const thresholds = await windowThresholds(market, start);
  return [200, { market: market.slug, start, serverNow: now, phase: phaseOf(start, now, rules), thresholds, bLimit: bLimitFor(thresholds, rules.gameS) }];
}

// The window's final series and OLS fit, fetched from the oracle once and shared.
async function settledFit(market, start) {
  const rules = rulesFor(market);
  const k = key.fit(market.slug, start);
  const cached = await kvGet(k);
  if (cached) return JSON.parse(cached);
  const series = await fetchSeries(market.source, start, start + rules.gameS - 1);
  series.sort((x, y) => x[0] - y[0]);
  const fit = series.length >= rules.minSettlePoints ? tsOls(series, start) : null; // x from window start, as drawn
  const rec = { series, fit, void: !fit };
  await kvSet(k, JSON.stringify(rec), { ttlMs: WINDOW_TTL_MS });
  return rec;
}

// Settle a closed window: fit it and map the trend to a bucket with the window's frozen edges.
// Idempotent; safe from any client poll.
export async function handleSettle(market, startRaw) {
  const start = parseStart(market, startRaw);
  if (start === null) return [400, { error: 'bad start' }];
  const rules = rulesFor(market);
  const now = nowS();
  const phase = phaseOf(start, now, rules);
  if ((phase !== 'ended' && phase !== 'settling') || now < start + rules.gameS + rules.settleDelayS) {
    return [200, { market: market.slug, start, phase, serverNow: now, settled: false }];
  }
  const thresholds = await windowThresholds(market, start);
  const rec = await settledFit(market, start);
  const bucket = rec.void ? null : bucketOf(rec.fit.trendAbs, thresholds);
  return [
    200,
    {
      market: market.slug,
      start,
      phase,
      serverNow: now,
      settled: true,
      void: !!rec.void,
      thresholds,
      bLimit: bLimitFor(thresholds, rules.gameS),
      series: rec.series,
      fit: rec.fit,
      bucket,
    },
  ];
}

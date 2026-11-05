// Pure market math shared by the API routes (server) and the market page (client). No dependencies.
//
// A market is a wall-clock window of windowS seconds on one TrendPulse source. Calls are open for the
// first lockFrac of the window, the rest is a locked runout, and the answer is the OLS trend over the
// whole window measured as trendAbs = slope x span (units of the pulse gained or lost across the
// window). Buckets are quintiles of recent windows (see live.js on the server).

export const TRENDPULSE_BASE = 'https://d3ulpbw76ladhl.cloudfront.net';
export const SETTLE_DELAY_S = 6; // wait for the oracle to store the final seconds

export const BUCKET_NAMES = ['Crash', 'Bear', 'Flat', 'Bull', 'Moon'];
export const BUCKET_COLORS = ['#ef4444', '#f97316', '#a3a3a3', '#4ade80', '#8b5cf6'];
export function bucketRgba(bucket, alpha) {
  const hex = BUCKET_COLORS[bucket];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Timing rules of one market.
export function rulesFor(market) {
  const gameS = market.windowS;
  const cadenceS = market.cadenceS || 2;
  return {
    gameS,
    lockS: Math.floor(gameS * (market.lockFrac ?? 0.8)),
    settleDelayS: SETTLE_DELAY_S,
    // fewer stored points than a quarter of the expected count = void window
    minSettlePoints: Math.max(10, Math.floor((gameS / cadenceS) * 0.25)),
  };
}

export function gameStartFor(nowS, gameS) {
  return Math.floor(nowS / gameS) * gameS;
}

// Timestamp-aware OLS over [ts, value] pairs, x measured in seconds from x0.
// Same definition as the TrendPulse status page and the oracle's trendAbs.
export function tsOls(points, x0) {
  const n = points.length;
  if (n < 2) return null;
  const t0 = x0 ?? points[0][0];
  let xbar = 0;
  let ybar = 0;
  for (const [ts, v] of points) { xbar += ts - t0; ybar += v; }
  xbar /= n;
  ybar /= n;
  let sxx = 0;
  let sxy = 0;
  for (const [ts, v] of points) {
    const dx = ts - t0 - xbar;
    sxx += dx * dx;
    sxy += dx * (v - ybar);
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  const a = ybar - b * xbar;
  const span = points[n - 1][0] - points[0][0];
  return { n, xbar, ybar, a, b, span, trendAbs: b * span };
}

// trendAbs of a slope projected over a full window.
export function trendAbsOf(b, gameS) {
  return b * (gameS - 1);
}

// 0 = Crash ... 4 = Moon.
export function bucketOf(trendAbs, thresholds) {
  return thresholds.filter((t) => trendAbs >= t).length;
}

// Outer edges for drawing: one bucket width beyond the first and last edge.
export function stripEdges(thresholds) {
  const [t0, t1, t2, t3] = thresholds;
  return [t0 - (t1 - t0), t0, t1, t2, t3, t3 + (t3 - t2)];
}

// Slope range (units per second) that covers the outer edges with headroom.
export function bLimitFor(thresholds, gameS) {
  const edges = stripEdges(thresholds);
  const reach = Math.max(Math.abs(edges[0]), Math.abs(edges[5]));
  return (1.4 * reach) / (gameS - 1);
}

// Phase of a window at time nowS (seconds).
export function phaseOf(start, nowS, rules) {
  const e = nowS - start;
  if (e < 0) return 'upcoming';
  if (e < rules.lockS) return 'open';
  if (e < rules.gameS) return 'locked';
  if (e < rules.gameS + rules.settleDelayS) return 'settling';
  return 'ended';
}

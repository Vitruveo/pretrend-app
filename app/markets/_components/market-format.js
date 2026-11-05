export function fmtClock(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function fmtUtc(ts) {
  const d = new Date(ts * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

// Signed trend in the pulse's units.
export function fmtAbs(v, market, decimals = 1) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}${market.unitLabel ? ` ${market.unitLabel}` : ''}`;
}

export function fmtPulse(v, market) {
  if (market.unit === 'usd') return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return v.toFixed(1);
}

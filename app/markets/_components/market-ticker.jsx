'use client';

import { BUCKET_NAMES, bucketOf, trendAbsOf, rulesFor } from '../_lib/gamemath';
import { fmtAbs, fmtClock, fmtPulse } from './market-format';

function Row({ items }) {
  return (
    <>
      {items.map(([label, value, tone]) => (
        <span key={label} className="ptm-tick">
          <span className="ptm-faint">{label}</span>
          <span className={tone === 'ember' ? 'ptm-ember' : tone === 'signal' ? 'ptm-signal' : 'ptm-ink'}>{value}</span>
        </span>
      ))}
    </>
  );
}

// Live telemetry strip, fed by the real window.
export function MarketTicker({ market, win, thresholds, calibration, lastResult }) {
  const rules = rulesFor(market);
  const last = win?.points.length ? win.points[win.points.length - 1][1] : null;
  const fit = win?.liveFit;
  const projected = fit ? trendAbsOf(fit.b, rules.gameS) : null;
  const bucket = projected === null ? -1 : bucketOf(projected, thresholds);
  const items = [
    [market.feedName, last === null ? '…' : fmtPulse(last, market), 'ink'],
    ['LIVE OLS', projected === null ? '…' : fmtAbs(projected, market), projected !== null && projected >= 0 ? 'signal' : 'ember'],
    ['BUCKET', bucket >= 0 ? BUCKET_NAMES[bucket].toUpperCase() : '…', 'ink'],
    ['PHASE', win ? win.phase.toUpperCase() : '…', win?.phase === 'open' ? 'signal' : 'ember'],
    [win?.phase === 'open' ? 'BUYING CLOSES' : 'NEXT MARKET', win ? fmtClock((win.phase === 'open' ? win.lockS : rules.gameS) - win.elapsed) : '…', 'ink'],
    ['LAST RESULT', lastResult ? (lastResult.void ? 'VOID' : BUCKET_NAMES[lastResult.bucket].toUpperCase()) : '…', 'ink'],
    ['SIGNAL CADENCE', `${market.cadenceS}S`, 'ink'],
    ['MARKET WINDOW', market.windowLabel.toUpperCase().replace('-MIN', 'M'), 'ink'],
    ['BUCKETS', !calibration || calibration.mode === 'starting' ? 'STARTING EDGES' : calibration.mode === 'equal' ? `EQUAL 20% · ${calibration.windows} WINDOWS` : `QUINTILES · ${calibration.windows} WINDOWS`, !calibration || calibration.mode === 'starting' ? 'ember' : 'ink'],
    ['STAKES', 'NOT YET', 'ember'],
  ];
  return (
    <div className="ptm-ticker">
      <div className="ptm-marquee">
        <Row items={items} />
        <Row items={items} />
      </div>
    </div>
  );
}

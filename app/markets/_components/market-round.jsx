'use client';

import { useEffect, useMemo, useState } from 'react';
import { BUCKET_NAMES, bucketRgba, bucketOf, stripEdges, trendAbsOf, rulesFor, stripBoxLayout, checkStripBoxes, trendToStripY } from '../_lib/gamemath';
import { fmtAbs, fmtClock, fmtUtc } from './market-format';

// Chart geometry
const PX0 = 60;
const PX1 = 600;
const PY0 = 25;
const PY1 = 250;
const PB0 = 300; // progress bar top
const PBH = 10; // progress bar height
const BX0 = 632;
const BX1 = 838;
const FONT = "'Titillium Web', sans-serif";
const SIGNAL = '#2f8fd6';
const EMBER = '#f0954f';

const CONFETTI_COLORS = ['#2f8fd6', '#7abe4d', '#f0954f', '#eef3fb', '#e8c547', '#8b5cf6', '#4ade80', '#ef4444'];
const CONFETTI_PIECES = 320; // three waves over the whole screen

// Deterministic pseudo-random in [0, 1) so confetti can be derived in render.
function rnd(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// One live round of a market. `win` is the current (or, with a result, the settled) window:
// { start, points, trailing, phase, elapsed, lockS, liveFit, now }. `call` is the viewer's bucket for
// that window (or null). `result` is the settled window once the server has fitted it.
export function MarketRound({ market, win, thresholds, call, result, canCall, onCall, onDismiss, celebrate }) {
  const rules = rulesFor(market);
  const n = rules.gameS;
  const [pick, setPick] = useState(null); // bucket chosen before it is confirmed as the call
  const settled = !!result;
  const { start, points, trailing, phase, elapsed, lockS } = win;

  const confetti = useMemo(
    () =>
      result && !result.void && (celebrate ?? (call !== null && call === result.bucket))
        ? Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
            id: i,
            left: rnd(i, 1) * 100,
            delay: (i % 3) * 1.1 + rnd(i, 2) * 0.9,
            duration: 2.8 + rnd(i, 3) * 2.4,
            size: 7 + rnd(i, 4) * 9,
            color: CONFETTI_COLORS[Math.floor(rnd(i, 5) * CONFETTI_COLORS.length)],
            spin: 360 + rnd(i, 6) * 540,
            drift: -140 + rnd(i, 7) * 280,
          }))
        : null,
    [result, call, celebrate]
  );

  // Scrolling view: the plot always shows the trailing window with the newest point at the right
  // edge; the window start and lock markers slide left as time passes. A settled result shows its
  // window exactly.
  const shownPoints = settled ? result.series : (trailing || points);
  const refStart = settled ? result.start : start;
  const viewEnd = settled ? result.start + n - 1 : Math.floor(win.now);
  const viewStart = viewEnd - (n - 1);
  // x is an absolute timestamp
  const px = (ts) => PX0 + ((PX1 - PX0) * (ts - viewStart)) / (n - 1);
  const inView = (ts) => ts >= viewStart && ts <= viewEnd;

  // The live fit of the points seen so far (or the settled fit).
  const fit = settled ? result.fit : win.liveFit;
  const xbar = fit ? fit.xbar : (n - 1) / 2;
  const pivotTs = refStart + xbar;
  const edges = stripEdges(thresholds);

  // Five boxes filling the strip top to bottom at fixed shares (STRIP_SHARES); index matches
  // BUCKET_NAMES (0 = Crash bottom ... 4 = Moon top).
  const boxes = stripBoxLayout(PY0, PY1);
  const stripBoxes = boxes;
  const stripError = checkStripBoxes(stripBoxes, PY0, PY1);
  useEffect(() => {
    if (stripError) console.error('[markets] bucket strip layout error:', stripError, stripBoxes);
  }, [stripError]); // eslint-disable-line react-hooks/exhaustive-deps
  // Height on the strip where a window trend lands; zero trend is the level of the pivot.
  const yZero = trendToStripY(0, stripBoxes, edges);

  // Y range: every point shown, nothing cut off. With a fit, the fit's mean sits level with zero trend
  // on the strip so a flat trend draws flat, and the scale is the largest that keeps all points in view.
  const [yLo, yHi] = (() => {
    if (shownPoints.length < 2) return [0, 100];
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, v] of shownPoints) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (fit) {
      const up = Math.max(hi - fit.ybar, 0);
      const down = Math.max(fit.ybar - lo, 0);
      const ks = [];
      if (up > 0) ks.push((yZero - PY0) / up);
      if (down > 0) ks.push((PY1 - yZero) / down);
      const k = (ks.length ? Math.min(...ks) : 1) * 0.96; // pixels per unit
      return [fit.ybar - (PY1 - yZero) / k, fit.ybar + (yZero - PY0) / k];
    }
    const pad = Math.max((hi - lo) * 0.04, Math.abs(hi) * 0.01, 1e-6);
    return [lo - pad, hi + pad];
  })();
  const py = (v) => PY0 + ((yHi - v) / (yHi - yLo)) * (PY1 - PY0);
  const ybar = fit ? fit.ybar : (yLo + yHi) / 2;

  // Live reading = where the window settles if the current slope holds, i.e. the slope projected
  // over the full window (the settled fit's trendAbs already spans the window).
  const liveTrend = fit ? (settled ? fit.trendAbs : trendAbsOf(fit.b, n)) : null;
  const liveBucket = liveTrend === null ? -1 : bucketOf(liveTrend, thresholds);
  const trueBucket = settled && !result.void ? result.bucket : -1;
  // The viewer's call: the middle of their bucket.
  // the wallet's own buy (on-chain), never a mere selection
  const aimBucket = call !== null && call !== undefined ? call : -1;

  // Every line is one straight line through the pivot (the fit's mean) to its height on the strip: the
  // four threshold rays end on the box boundaries, the dashed trend line where its trend lands, the
  // viewer's line in the middle of their box.
  const pivotX = px(pivotTs);
  const pivotY = py(ybar);
  const lineY = (targetY, x) => pivotY + ((targetY - pivotY) * (x - pivotX)) / (BX0 - pivotX);
  const rayTarget = (i) => stripBoxes[i][0]; // boundary between box i and box i + 1
  const liveTarget = liveTrend === null ? yZero : trendToStripY(liveTrend, stripBoxes, edges);
  const aimTarget = aimBucket >= 0 ? (stripBoxes[aimBucket][0] + stripBoxes[aimBucket][1]) / 2 : yZero;
  const coneX0 = Math.max(PX0, pivotX);
  const wedges = BUCKET_NAMES.map((_, i) => {
    const top = (x) => (i === 4 ? PY0 : lineY(rayTarget(i), x));
    const bot = (x) => (i === 0 ? PY1 : lineY(rayTarget(i - 1), x));
    return `${coneX0},${top(coneX0)} ${PX1},${top(PX1)} ${PX1},${bot(PX1)} ${coneX0},${bot(coneX0)}`;
  });

  const canPick = !settled && canCall && phase === 'open';
  const showAim = settled ? call !== null && call !== undefined : aimBucket >= 0;
  const choose = (i) => {
    if (!canPick) return;
    setPick(i);
    onCall(i);
  };
  // A fresh selection each window; nothing is selected until the viewer clicks a bucket.
  useEffect(() => {
    setPick(null);
  }, [start]);
  // Two marks: the bucket the trend is in (live, or the settled answer) is FILLED in its color; the
  // viewer's call is OUTLINED in ember, the color of their line. One bucket can carry both.
  const isLive = (i) => (settled ? i === trueBucket : i === liveBucket);
  const isPick = (i) => showAim && i === aimBucket;
  const boxFill = (i) => bucketRgba(i, isLive(i) ? 0.38 : 0.06);
  const boxStroke = (i) => (isPick(i) ? EMBER : bucketRgba(i, isLive(i) ? 0.9 : 0.4));
  const boxStrokeW = (i) => (isPick(i) ? 3 : 1.5);
  const boxText = (i) => (isLive(i) || isPick(i) ? '#ffffff' : bucketRgba(i, 0.9));
  const liveTag = settled ? 'RESULT' : 'LIVE';
  const called = call !== null && call !== undefined;

  const progress = settled ? 1 : Math.max(0, Math.min(1, elapsed / n));
  const lockFrac = lockS / n;
  const lastPt = shownPoints.length ? shownPoints[shownPoints.length - 1] : null;
  const liveLineColor = liveBucket >= 0 ? bucketRgba(liveBucket, 0.95) : '#8fa0ba';
  const decimals = market.unit === 'usd' ? 0 : 1;
  // with an on-chain position (celebrate), a hit is holding units in the winning bucket
  const hit = settled && !result.void && (celebrate ?? (called && call === result.bucket));

  let phaseText;
  if (settled) phaseText = result.void ? 'Window void: oracle gap, no answer' : `Settled ${fmtUtc(result.start)} market`;
  else if (phase === 'open') phaseText = `Buying closes in ${fmtClock(lockS - elapsed)}`;
  else if (phase === 'locked') phaseText = `Locked: resolves in ${fmtClock(n - elapsed)}`;
  else phaseText = 'Settling…';

  return (
    <div className="ptm" style={{ position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes ptm-confetti-fall {
          0% { transform: translate(0, -20px) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translate(var(--drift), 105vh) rotate(var(--spin)); opacity: 0; }
        }
        @keyframes ptm-live-pulse {
          0% { r: 3; opacity: 1; }
          100% { r: 9; opacity: 0; }
        }
      `}</style>

      <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2 mb-1" style={{ fontSize: '1rem' }}>
        <span className="ptm-faint">
          <span style={{ color: SIGNAL }}>{market.feedName}</span> &middot; market {fmtUtc(refStart)} &middot;{' '}
          {settled ? `${shownPoints.length} points` : `second ${Math.min(n, Math.floor(elapsed))} / ${n}`}
        </span>
        <span className="ptm-ink fw-bold" style={{ fontSize: '1.25rem', letterSpacing: '0.03em', fontVariantNumeric: 'tabular-nums' }}>{phaseText}</span>
      </div>

      {[
        { withStrip: true, id: 'd', cls: 'd-none d-md-block' },
        { withStrip: false, id: 'm', cls: 'd-md-none' },
      ].map(({ withStrip, id, cls }) => (
        <svg
          key={id}
          className={cls}
          viewBox={withStrip ? '0 0 850 332' : '0 0 620 332'}
          role="img"
          aria-label={`Live ${market.name} pulse with the OLS trend and outcome buckets`}
          style={{ width: '100%', height: 'auto' }}
        >
          <defs>
            <clipPath id={`ptm-plot-${id}`}>
              <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} />
            </clipPath>
            <pattern id={`ptm-hatch-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="8" fill="rgba(240,149,79,0.18)" />
            </pattern>
            <linearGradient id={`ptm-prog-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1f6fb0" />
              <stop offset="1" stopColor="#2f8fd6" />
            </linearGradient>
          </defs>
          <line x1={PX0} y1={PY1} x2={PX1} y2={PY1} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

          {/* bucket wedges and threshold rays */}
          {fit && (
            <g clipPath={`url(#ptm-plot-${id})`}>
              {wedges.map((pts, i) => (
                <polygon key={`w${i}`} points={pts} fill={bucketRgba(i, isLive(i) ? 0.28 : isPick(i) ? 0.16 : 0.09)} />
              ))}
              {thresholds.map((t, i) => (
                <line key={`r${i}`} x1={PX0} y1={lineY(rayTarget(i), PX0)} x2={PX1} y2={lineY(rayTarget(i), PX1)} stroke="rgba(238,243,251,0.22)" strokeWidth="1" />
              ))}
            </g>
          )}

          {/* outcome buckets: side strip on wide screens only */}
          {withStrip && stripError && (
            <text x={(BX0 + BX1) / 2} y={PY0 - 6} textAnchor="middle" fill="#ef4444" fontSize="12" fontFamily={FONT}>STRIP LAYOUT ERROR</text>
          )}
          {withStrip && BUCKET_NAMES.map((name, i) => {
            const [top, bottom] = stripBoxes[i];
            const h = bottom - top;
            if (h < 1) return null;
            const fs = h >= 26 ? 19 : h >= 14 ? 12 : 0;
            return (
              <g
                key={name}
                className={canPick ? 'ptm-bucket-pick' : undefined}
                onClick={() => choose(i)}
                role={canPick ? 'button' : undefined}
                aria-label={canPick ? name : undefined}
                aria-pressed={canPick ? aimBucket === i : undefined}
              >
                <rect x={BX0} y={top} width={BX1 - BX0} height={h} rx={h >= 12 ? 6 : 2} fill={boxFill(i)} stroke={boxStroke(i)} strokeWidth={boxStrokeW(i)} />
                {h >= 26 && isPick(i) && (
                  <text x={BX0 + 8} y={top + 13} fill={EMBER} fontSize="10" fontWeight="700" letterSpacing="1.5" fontFamily={FONT}>
                    YOU PICKED
                  </text>
                )}
                {h >= 26 && isLive(i) && (
                  <text x={BX1 - 8} y={top + 13} textAnchor="end" fill="rgba(255,255,255,0.75)" fontSize="10" fontWeight="700" letterSpacing="1.5" fontFamily={FONT}>
                    {liveTag}
                  </text>
                )}
                {fs > 0 && (
                  <text x={(BX0 + BX1) / 2} y={(top + bottom) / 2 + fs * 0.35} textAnchor="middle" fill={boxText(i)} fontSize={fs} fontWeight="600" fontFamily={FONT}>
                    {name}
                  </text>
                )}
                {h >= 30 && i > 0 && (
                  <text x={BX1 - 6} y={bottom - 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily={FONT}>
                    {fmtAbs(edges[i], market, decimals)}
                  </text>
                )}
              </g>
            );
          })}

          {/* rays and the fit line continue across the gap into the strip */}
          {withStrip && fit && (
            <>
              {thresholds.map((t, i) => (
                <line key={`rg${i}`} x1={PX1} y1={lineY(rayTarget(i), PX1)} x2={BX0} y2={rayTarget(i)} stroke="rgba(238,243,251,0.16)" strokeWidth="1" />
              ))}
              <line
                x1={PX1}
                y1={lineY(liveTarget, PX1)}
                x2={BX0 - 2}
                y2={lineY(liveTarget, BX0 - 2)}
                stroke={settled ? '#eef3fb' : liveLineColor}
                strokeWidth="2.5"
                strokeDasharray="5 6"
                opacity="0.9"
              />
            </>
          )}

          {/* the series */}
          <g clipPath={`url(#ptm-plot-${id})`}>
            {shownPoints.length > 1 && (
              <polyline
                points={shownPoints.map(([ts, v]) => `${px(ts).toFixed(1)},${py(v).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={market.color || 'rgba(45,140,255,0.85)'}
                strokeWidth="1.5"
              />
            )}
            {lastPt && (
              <>
                <circle cx={px(lastPt[0])} cy={py(lastPt[1])} r="3" fill={settled ? EMBER : SIGNAL} />
                {!settled && (
                  <circle cx={px(lastPt[0])} cy={py(lastPt[1])} r="3" fill="none" stroke={SIGNAL} strokeWidth="1.5" style={{ animation: 'ptm-live-pulse 1s ease-out infinite' }} />
                )}
              </>
            )}
          </g>

          {/* live (or settled) OLS line, colored by the bucket it is in right now */}
          {fit && (
            <>
              <g clipPath={`url(#ptm-plot-${id})`}>
                <line x1={PX0} y1={lineY(liveTarget, PX0)} x2={PX1} y2={lineY(liveTarget, PX1)} stroke={settled ? '#eef3fb' : liveLineColor} strokeWidth="2.5" strokeDasharray="5 6" />
              </g>
              {inView(refStart + xbar) && (
                <circle cx={px(refStart + xbar)} cy={py(ybar)} r="4.5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
              )}
            </>
          )}

          {/* the viewer's line and its projection into the strip */}
          {showAim && fit && (
            <>
              <g clipPath={`url(#ptm-plot-${id})`}>
                <line x1={PX0} y1={lineY(aimTarget, PX0)} x2={PX1} y2={lineY(aimTarget, PX1)} stroke={EMBER} strokeWidth="2.5" />
              </g>
              {withStrip && (
                <line
                  x1={PX1}
                  y1={lineY(aimTarget, PX1)}
                  x2={BX0 - 2}
                  y2={lineY(aimTarget, BX0 - 2)}
                  stroke={EMBER}
                  strokeWidth="2.5"
                  opacity="0.9"
                />
              )}
            </>
          )}

          <text x={PX0} y={276} fill="rgba(255,255,255,0.55)" fontSize="18" fontFamily={FONT}>
            {settled ? fmtUtc(viewStart) : `-${market.windowLabel.replace('-', ' ')}`}
          </text>
          <text x={PX1} y={276} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="18" fontFamily={FONT}>
            {settled ? fmtUtc(viewEnd) : 'now'}
          </text>
          {/* where we are in the window: calls open, then the locked runout */}
          <rect x={PX0} y={PB0} width={PX1 - PX0} height={PBH} fill="rgba(6,11,20,0.9)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <rect x={PX0 + (PX1 - PX0) * lockFrac} y={PB0} width={(PX1 - PX0) * (1 - lockFrac)} height={PBH} fill={`url(#ptm-hatch-${id})`} />
          {progress > 0 && (
            <>
              <rect x={PX0} y={PB0} width={(PX1 - PX0) * Math.min(progress, lockFrac)} height={PBH} fill={`url(#ptm-prog-${id})`} />
              {progress > lockFrac && (
                <rect x={PX0 + (PX1 - PX0) * lockFrac} y={PB0} width={(PX1 - PX0) * (progress - lockFrac)} height={PBH} fill={EMBER} opacity="0.85" />
              )}
              {!settled && <rect x={PX0 + (PX1 - PX0) * progress - 1} y={PB0 - 3} width="2" height={PBH + 6} fill="#eef3fb" />}
            </>
          )}
          <rect x={PX0 + (PX1 - PX0) * lockFrac - 1} y={PB0 - 4} width="2" height={PBH + 8} fill="rgba(238,243,251,0.6)" />
          <text x={PX0 + (PX1 - PX0) * lockFrac} y={PB0 - 8} textAnchor="middle" fill="#8fa0ba" fontSize="12" letterSpacing="2" fontFamily={FONT}>
            LOCK
          </text>
          <text x={PX0} y={PB0 + PBH + 20} fill="#8fa0ba" fontSize="14" fontFamily={FONT}>
            market {fmtUtc(refStart)}
          </text>
          <text x={(PX0 + PX1) / 2} y={PB0 + PBH + 20} textAnchor="middle" fill="#b9c5da" fontSize="14" fontFamily={FONT}>
            {settled ? 'settled' : phase === 'open' ? `calls open · close in ${fmtClock(lockS - elapsed)}` : phase === 'locked' ? `locked · resolves in ${fmtClock(n - elapsed)}` : 'settling…'}
          </text>
          <text x={PX1} y={PB0 + PBH + 20} textAnchor="end" fill="#8fa0ba" fontSize="14" fontFamily={FONT}>
            {fmtUtc(refStart + n)}
          </text>

          {/* axis labels sit inside the plot's left edge: with a unit they are too wide for the margin */}
          <text x={PX0 + 6} y={PY0 + 6} textAnchor="start" fill="rgba(255,255,255,0.45)" fontSize="13" fontFamily={FONT}>
            {yHi.toFixed(decimals)}{market.unitLabel ? ` ${market.unitLabel}` : ''}
          </text>
          <text x={PX0 + 6} y={PY1 - 4} textAnchor="start" fill="rgba(255,255,255,0.45)" fontSize="13" fontFamily={FONT}>
            {yLo.toFixed(decimals)}{market.unitLabel ? ` ${market.unitLabel}` : ''}
          </text>
        </svg>
      ))}


      <div className="text-center mt-3" style={{ minHeight: '1.6em' }}>
        {settled ? (
          result.void ? (
            <span className="ptm-dim">The oracle stored too few points for this window. No answer.</span>
          ) : (
            <span className="ptm-dim">
              OLS answer <span className="ptm-ink">{result.fit ? fmtAbs(result.fit.trendAbs, market, decimals) : '…'}</span> ({BUCKET_NAMES[trueBucket]})
              {called ? (
                <>
                  {' '}&middot; you picked <span style={{ color: EMBER }}>{BUCKET_NAMES[call]}</span> &middot;{' '}
                  {hit ? <strong className="ptm-ink">Hit</strong> : <span>miss</span>}
                </>
              ) : null}
            </span>
          )
        ) : (
          <span className="ptm-faint">
            Live OLS{' '}
            <span style={{ color: liveLineColor, fontWeight: 600 }}>{liveTrend === null ? '…' : fmtAbs(liveTrend, market, decimals)}</span>
            {liveBucket >= 0 ? <> &middot; in <span style={{ color: liveLineColor, fontWeight: 600 }}>{BUCKET_NAMES[liveBucket]}</span></> : null}
            {called ? (
              <> &middot; you picked <span style={{ color: EMBER, fontWeight: 600 }}>{BUCKET_NAMES[call]}</span></>
            ) : null}
          </span>
        )}
      </div>

      {settled && (
        <div className="d-flex justify-content-center mt-3">
          <button type="button" className="ptm-btn ptm-btn-ghost" onClick={onDismiss}>Back to live</button>
        </div>
      )}

      {confetti && (
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2000 }}>
          {confetti.map((c) => (
            <span
              key={c.id}
              style={{
                position: 'absolute',
                top: -24,
                left: `${c.left}%`,
                width: `${c.size}px`,
                height: `${c.size * 0.45}px`,
                background: c.color,
                borderRadius: '1px',
                '--drift': `${c.drift}px`,
                '--spin': `${c.spin}deg`,
                animation: `ptm-confetti-fall ${c.duration}s cubic-bezier(0.25,0.6,0.45,1) ${c.delay}s forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

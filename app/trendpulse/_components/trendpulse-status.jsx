'use client';

import { useEffect, useRef, useState } from 'react';
import { TRENDPULSE_BASE, TRENDPULSE_SOURCES } from '../../config/trendpulse';

const REFRESH_MS = 10_000; // chart/health update cadence

// timestamp-aware OLS over [ts, value] pairs
function tsOls(points) {
  const n = points.length;
  if (n < 2) return null;
  const t0 = points[0][0];
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
  const span = points[n - 1][0] - t0;
  return { y0: a, y1: a + b * span, trendPct: ((b * span) / a) * 100 };
}

function fmtValue(v, unit) {
  if (unit === 'tone') return `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
  if (unit === 'celsius') return `${v.toFixed(1)}\u00b0C`;
  if (unit === 'bnb') return `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} BNB`;
  if (unit === 'txs') return `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} txs`;
  if (unit === 'momentum') return v.toFixed(1);
  if (unit === 'sol') return `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} SOL`;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(ts) {
  const d = new Date(ts * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const FONT = "'Titillium Web',sans-serif";

function LiveChart({ label, name, points, unit, windowLabel, trendMode, color = '#63a83a', labelColor = '#a3d97a', trendColor = '#2f8fd6', headlineColor = 'rgba(255,255,255,0.7)' }) {
  const W = 720;
  const H = 300;
  const X0 = 60;
  const X1 = 690;
  const Y0 = 25;
  const Y1 = 255;

  if (!points || points.length < 2) {
    return (
      <div className="text-muted-custom small py-5 text-center">Waiting for data&hellip;</div>
    );
  }

  const fit = tsOls(points);
  const values = points.map((p) => p[1]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.1, hi * 0.0002);
  lo -= pad;
  hi += pad;
  const tMin = points[0][0];
  const tMax = points[points.length - 1][0];
  const px = (ts) => X0 + ((X1 - X0) * (ts - tMin)) / Math.max(tMax - tMin, 1);
  const py = (v) => Y0 + ((hi - v) / (hi - lo)) * (Y1 - Y0);
  const line = points.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} over the chart window with its OLS trend`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {fit && (
        <line
          x1={px(tMin)}
          y1={py(fit.y0).toFixed(1)}
          x2={px(tMax)}
          y2={py(fit.y1).toFixed(1)}
          stroke={trendColor}
          strokeWidth="2"
          strokeDasharray="6 5"
        />
      )}
      <circle cx={px(last[0]).toFixed(1)} cy={py(last[1]).toFixed(1)} r="3.5" fill={color} stroke="#0a0f0a" strokeWidth="1.5" />
      <text x={px(last[0]) - 9} y={(py(last[1]) - 10).toFixed(1)} textAnchor="end" fill={labelColor} fontSize="13" fontWeight="600" fontFamily={FONT} stroke="#0a0f0a" strokeWidth="3" paintOrder="stroke" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtValue(last[1], unit)}
      </text>
      <text x={X0} y={16} fill={headlineColor} fontSize="13" fontWeight="600" fontFamily={FONT}>
        {name} <tspan fill="rgba(255,255,255,0.4)" fontWeight="400">{label}</tspan>
      </text>
      {fit && (
        <text x={X1} y={16} textAnchor="end" fill={trendColor} fontSize="12" fontFamily={FONT}>
          {windowLabel} OLS trend: {trendMode === 'abs'
            ? `${fit.y1 - fit.y0 >= 0 ? '+' : ''}${(fit.y1 - fit.y0).toFixed(unit === 'celsius' || unit === 'bnb' || unit === 'momentum' || unit === 'sol' ? 1 : unit === 'txs' ? 0 : 3)}${unit === 'celsius' ? '\u00b0C' : unit === 'bnb' ? ' BNB' : unit === 'sol' ? ' SOL' : unit === 'txs' ? ' txs' : ''}`
            : `${fit.trendPct >= 0 ? '+' : ''}${fit.trendPct.toFixed(3)}%`}
        </text>
      )}
      <text x={X0} y={275} fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily={FONT}>{fmtTime(tMin)} UTC</text>
      <text x={X1} y={275} textAnchor="end" fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily={FONT}>{fmtTime(tMax)} UTC</text>
    </svg>
  );
}

export function TrendPulseStatus() {
  const [health, setHealth] = useState(null); // null=connecting, {ok,...}=live, false=unreachable
  const [series, setSeries] = useState({});
  const ticksRef = useRef({});
  const wsUp = useRef(false);

  useEffect(() => {
    if (!TRENDPULSE_BASE) return undefined;
    let stop = false;

    // initial 30-min series per source
    const now = Math.floor(Date.now() / 1000);
    for (const s of TRENDPULSE_SOURCES) {
      fetch(`${TRENDPULSE_BASE}/series?source=${s.key}&from=${now - s.windowS}&to=${now}`)
        .then((r) => r.json())
        .then((d) => { if (!stop && d.points) setSeries((prev) => ({ ...prev, [s.key]: d.points })); })
        .catch(() => {});
    }

    // live ticks over websocket
    let ws;
    function connect() {
      if (stop) return;
      ws = new WebSocket(`${TRENDPULSE_BASE.replace(/^http/, 'ws')}/feed`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'tick') ticksRef.current[msg.source] = [msg.ts, msg.value];
          wsUp.current = true;
        } catch (e) {}
      };
      ws.onclose = () => { wsUp.current = false; if (!stop) setTimeout(connect, 5000); };
      ws.onerror = () => {};
    }
    connect();

    // every 10s: fold latest ticks into the series, trim to window, poll health
    const timer = setInterval(() => {
      setSeries((prev) => {
        const next = { ...prev };
        for (const s of TRENDPULSE_SOURCES) {
          const cutoff = Math.floor(Date.now() / 1000) - s.windowS;
          const tick = ticksRef.current[s.key];
          let pts = next[s.key] || [];
          if (tick && (pts.length === 0 || tick[0] > pts[pts.length - 1][0])) pts = [...pts, tick];
          next[s.key] = pts.filter((p) => p[0] >= cutoff);
        }
        return next;
      });
      fetch(`${TRENDPULSE_BASE}/health`)
        .then((r) => r.json())
        .then((d) => { if (!stop) setHealth(d); })
        .catch(() => { if (!stop) setHealth(false); });
    }, REFRESH_MS);

    fetch(`${TRENDPULSE_BASE}/health`).then((r) => r.json()).then((d) => { if (!stop) setHealth(d); }).catch(() => { if (!stop) setHealth(false); });

    return () => { stop = true; clearInterval(timer); if (ws) ws.close(); };
  }, []);

  if (!TRENDPULSE_BASE) {
    return (
      <div className="card-dark p-4 text-center">
        <span className="tp-led red" aria-hidden="true" />
        <span className="text-muted-custom ms-2">TrendPulse public endpoint is not provisioned yet — check back soon.</span>
      </div>
    );
  }

  const ledClass = health === null ? 'amber' : health && health.ok && wsUp.current !== false ? 'green' : health && health.ok ? 'green' : 'red';
  const statusText = health === null ? 'Connecting to TrendPulse…'
    : health && health.ok ? 'TrendPulse is live — all feeds nominal'
    : health ? 'TrendPulse degraded — a feed is lagging'
    : 'TrendPulse unreachable';

  return (
    <div>
      <div className="card-dark p-3 d-flex align-items-center gap-3 mb-4">
        <span className={`tp-led ${ledClass}`} aria-hidden="true" />
        <span className="text-white">{statusText}</span>

      </div>
      {TRENDPULSE_SOURCES.map((s) => (
        <div key={s.key} className="card-dark p-3 p-md-4 mb-4">
          <div className="tps-row">
            <div className="tps-chart">
              <LiveChart label={s.label} name={s.name} points={series[s.key]} unit={s.unit} windowLabel={s.windowLabel} trendMode={s.trendMode} color={s.color} labelColor={s.labelColor} trendColor={s.trendColor} headlineColor={s.headlineColor} />
            </div>
            <div className="tps-info">
              <div className="tps-info-title" style={s.headlineColor ? { color: s.headlineColor } : undefined}>{s.name}</div>
              <p className="tps-info-desc">{s.desc}</p>
              <dl className="tps-info-meta">
                <dt>Trend</dt><dd>OLS, {s.windowLabel} window</dd>
                <dt>Source</dt><dd>{s.attribution}</dd>
                <dt>Data</dt><dd>{s.dataCadence}</dd>
                <dt>Chart</dt><dd>refreshes every 10s</dd>
                <dt>Lag</dt>
                <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {health && health.sources && health.sources[s.key] && health.sources[s.key].feedLagSeconds != null
                    ? `${Math.max(0, health.sources[s.key].feedLagSeconds)}s`
                    : '—'}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      ))}
      <p className="text-muted-custom small text-center mb-0">
        Each dashed line is the OLS trend fitted over that chart&apos;s window — the same
        computation that resolves Pretrend markets.
      </p>
    </div>
  );
}

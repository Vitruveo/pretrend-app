'use client';

import { useEffect, useRef, useState } from 'react';
import { TRENDPULSE_BASE, TRENDPULSE_SOURCES } from '../../config/trendpulse';
import { LiveChart } from '../../components/live-chart';

const REFRESH_MS = 10_000; // chart/health update cadence

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

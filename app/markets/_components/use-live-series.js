'use client';

import { useEffect, useRef, useState } from 'react';
import { TRENDPULSE_BASE } from '../../config/trendpulse';

const REFRESH_MS = 10_000;

// Live [ts, value] series per market, trimmed to each market's window.
// Initial load over HTTP, then ticks over the feed websocket folded in every 10 s.
export function useLiveSeries(markets) {
  const [series, setSeries] = useState({});
  const [health, setHealth] = useState(null);
  const ticksRef = useRef({});

  useEffect(() => {
    if (!TRENDPULSE_BASE) return undefined;
    let stop = false;
    const now = Math.floor(Date.now() / 1000);
    for (const m of markets) {
      fetch(`${TRENDPULSE_BASE}/series?source=${m.source}&from=${now - m.windowS}&to=${now}`)
        .then((r) => r.json())
        .then((d) => { if (!stop && d.points) setSeries((prev) => ({ ...prev, [m.slug]: d.points })); })
        .catch(() => {});
    }

    let ws;
    function connect() {
      if (stop) return;
      ws = new WebSocket(`${TRENDPULSE_BASE.replace(/^http/, 'ws')}/feed`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'tick') ticksRef.current[msg.source] = [msg.ts, msg.value];
        } catch (e) {}
      };
      ws.onclose = () => { if (!stop) setTimeout(connect, 5000); };
      ws.onerror = () => {};
    }
    connect();

    const pollHealth = () => fetch(`${TRENDPULSE_BASE}/health`)
      .then((r) => r.json())
      .then((d) => { if (!stop) setHealth(d); })
      .catch(() => { if (!stop) setHealth(false); });
    pollHealth();

    const timer = setInterval(() => {
      setSeries((prev) => {
        const next = { ...prev };
        for (const m of markets) {
          const cutoff = Math.floor(Date.now() / 1000) - m.windowS;
          const tick = ticksRef.current[m.source];
          let pts = next[m.slug] || [];
          if (tick && (pts.length === 0 || tick[0] > pts[pts.length - 1][0])) pts = [...pts, tick];
          next[m.slug] = pts.filter((p) => p[0] >= cutoff);
        }
        return next;
      });
      pollHealth();
    }, REFRESH_MS);

    return () => { stop = true; clearInterval(timer); if (ws) ws.close(); };
  }, [markets]);

  return { series, health };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { TRENDPULSE_BASE, rulesFor, gameStartFor, phaseOf, tsOls } from '../_lib/gamemath';

// The sliding view of the oracle feed for one market, streamed straight from TrendPulse: a series
// fetch reaching back one window on each new window, live ticks over the websocket, a periodic refill
// for gaps, and a 1 Hz clock (server-skew corrected) that drives phase, elapsed time and the live OLS
// fit over the trailing window. The chart draws the trailing points; settlement uses the window's own
// points on the server.
export function useLiveWindow(market, live) {
  const [state, setState] = useState(null);
  const skewRef = useRef(0);
  const rules = rulesFor(market);
  useEffect(() => {
    if (!live) return;
    skewRef.current = live.serverNow - Date.now() / 1000;
  }, [live]);
  const ready = !!live && !!TRENDPULSE_BASE;
  const { gameS, lockS, settleDelayS } = rules;
  useEffect(() => {
    if (!ready) return undefined;
    const r = { gameS, lockS, settleDelayS };
    const nowS = () => Date.now() / 1000 + skewRef.current;
    let stop = false;
    let ws;
    const cur = { start: null, map: new Map() };

    async function loadWindow(start) {
      try {
        const to = Math.min(Math.floor(nowS()), start + gameS - 1);
        const res = await fetch(`${TRENDPULSE_BASE}/series?source=${market.source}&from=${start - gameS}&to=${to}`);
        const d = await res.json();
        if (stop || cur.start !== start) return;
        for (const p of d.points || []) cur.map.set(p[0], p[1]);
      } catch (e) {
        // the refill retries
      }
    }

    function connect() {
      if (stop) return;
      ws = new WebSocket(`${TRENDPULSE_BASE.replace(/^http/, 'ws')}/feed`);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'tick' && m.source === market.source && cur.start !== null && m.ts >= cur.start - gameS) cur.map.set(m.ts, m.value);
        } catch (e) {}
      };
      ws.onclose = () => { if (!stop) setTimeout(connect, 3000); };
      ws.onerror = () => {};
    }
    connect();

    const tick = () => {
      const t = nowS();
      const start = gameStartFor(t, gameS);
      if (cur.start !== start) {
        cur.start = start;
        loadWindow(start);
      }
      const floor = Math.floor(t) - gameS;
      for (const ts of cur.map.keys()) if (ts < floor) cur.map.delete(ts);
      const trailing = [...cur.map.entries()].sort((a, b) => a[0] - b[0]);
      const points = trailing.filter((p) => p[0] >= start);
      // x measured from the window start, so xbar and a line up with the chart
      const liveFit = trailing.length >= 2 ? tsOls(trailing, start) : null;
      setState({ start, points, trailing, phase: phaseOf(start, t, r), elapsed: t - start, lockS, liveFit, now: t });
    };
    tick();
    const clock = setInterval(tick, 1000);
    const refill = setInterval(() => { if (cur.start !== null) loadWindow(cur.start); }, 15000);
    return () => { stop = true; clearInterval(clock); clearInterval(refill); if (ws) ws.close(); };
  }, [ready, market.source, gameS, lockS, settleDelayS]);
  return state;
}

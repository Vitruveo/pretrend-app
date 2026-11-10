'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUCKET_NAMES, rulesFor, validThresholds } from '../_lib/gamemath';
import { getLive, getSettle, getWindow } from './api';
import { useLiveWindow } from './use-live-window';
import { MarketRound } from './market-round';
import { MarketTicker } from './market-ticker';
import { MarketRulebook } from './market-rulebook';
import { fmtAbs, fmtUtc } from './market-format';
import { useGeo } from './geo';
import { BuyPanel } from './buy-panel';

const RECENT = 8;

// Calls this browser made, per market, keyed by window start. No stakes yet: the browser is the only
// record, and the chain will be the record when staking lands.
const callsKey = (slug) => `ptm:calls:${slug}`;
function loadCalls(slug) {
  try {
    const raw = window.localStorage.getItem(callsKey(slug));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function saveCalls(slug, calls) {
  try {
    const keys = Object.keys(calls).map(Number).sort((a, b) => a - b).slice(-50);
    const out = {};
    for (const k of keys) out[k] = calls[k];
    window.localStorage.setItem(callsKey(slug), JSON.stringify(out));
  } catch (e) {
    // private mode
  }
}

function RecentMarkets({ market, rows, calls }) {
  const decimals = market.unit === 'usd' ? 0 : 1;
  return (
    <div className="card-dark p-3 p-md-4 mt-5 ptm">
      <h2 className="h4 fw-bold mb-3">Recent markets</h2>
      {!rows.length ? (
        <p className="ptm-faint mb-0">Waiting for the first window to settle.</p>
      ) : (
        <div className="table-responsive">
          <table className="ptm-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Points</th>
                <th style={{ textAlign: 'right' }}>OLS answer</th>
                <th>Bucket</th>
                <th>Your call</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = calls[r.start];
                const called = c !== undefined && c !== null;
                return (
                  <tr key={r.start}>
                    <td className="ptm-mono">{fmtUtc(r.start)}</td>
                    <td className="ptm-mono">{r.void ? '—' : r.series.length}</td>
                    <td className="ptm-mono" style={{ textAlign: 'right' }}>{r.void ? 'void' : fmtAbs(r.fit.trendAbs, market, decimals)}</td>
                    <td>{r.void ? '—' : BUCKET_NAMES[r.bucket]}</td>
                    <td>
                      {!called ? <span className="ptm-faint">—</span>
                        : r.void ? <span className="ptm-faint">{BUCKET_NAMES[c]} · void</span>
                        : c === r.bucket ? <span className="ptm-signal">{BUCKET_NAMES[c]} · hit</span>
                        : <span className="ptm-faint">{BUCKET_NAMES[c]} · miss</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MarketGame({ market }) {
  const rules = useMemo(() => rulesFor(market), [market]);
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [windowInfo, setWindowInfo] = useState(null); // frozen thresholds for the current window
  const [calls, setCalls] = useState({});
  const [result, setResult] = useState(null); // the settled window shown in place of the live one
  const [resultFor, setResultFor] = useState(null); // window start whose result is shown or awaited
  const [recent, setRecent] = useState([]);

  const geo = useGeo();
  const win = useLiveWindow(market, live);
  const thresholds = (windowInfo && windowInfo.start === win?.start ? windowInfo.thresholds : null) || live?.thresholds || market.fallbackThresholds;
  const call = win ? calls[win.start] ?? null : null;

  useEffect(() => {
    setCalls(loadCalls(market.slug));
    getLive(market.slug).then(setLive).catch((e) => setLiveError(e.message));
    const id = setInterval(() => getLive(market.slug).then(setLive).catch(() => {}), 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [market.slug]);

  // Freeze the bucket edges for each new window on the server.
  useEffect(() => {
    if (!win?.start) return;
    getWindow(market.slug, win.start).then(setWindowInfo).catch(() => {});
  }, [market.slug, win?.start]);

  // Recent settled windows, refreshed when a window closes.
  useEffect(() => {
    if (!win?.start) return undefined;
    let stop = false;
    const starts = Array.from({ length: RECENT }, (_, i) => win.start - (i + 1) * rules.gameS);
    const load = () => Promise.all(starts.map((s) => getSettle(market.slug, s).catch(() => null)))
      .then((rs) => { if (!stop) setRecent(rs.filter((r) => r && r.settled)); });
    const t = setTimeout(load, (rules.settleDelayS + 2) * 1000);
    load();
    return () => { stop = true; clearTimeout(t); };
  }, [market.slug, win?.start, rules.gameS, rules.settleDelayS]);

  const onCall = useCallback((bucket) => {
    if (!win) return;
    setCalls((prev) => {
      const next = { ...prev, [win.start]: bucket };
      saveCalls(market.slug, next);
      return next;
    });
  }, [win, market.slug]);

  // When a window this browser called ends, poll the server until it is settled, then show it.
  useEffect(() => {
    if (!win || result) return undefined;
    const prev = win.start - rules.gameS;
    if (calls[prev] === undefined || resultFor === prev) return undefined;
    if (win.now > prev + rules.gameS + 120) return undefined; // too old to replay
    let stop = false;
    const poll = async () => {
      try {
        const r = await getSettle(market.slug, prev);
        if (stop || !r.settled) return;
        setResult(r);
        setResultFor(prev);
      } catch (e) {
        // next poll retries
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [win?.start, win?.phase, calls, result, resultFor, market.slug, rules]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => setResult(null);
  const lastResult = recent.length ? recent[0] : null;
  const roundThresholds = result?.thresholds || thresholds;
  useEffect(() => {
    if (win && !validThresholds(roundThresholds)) console.error('[markets] invalid bucket edges', market.slug, roundThresholds);
  }, [win, roundThresholds, market.slug]);

  return (
    <div className="ptm">
      <MarketTicker market={market} win={win} thresholds={thresholds} calibration={live?.calibration} lastResult={lastResult} />

      <div className="card-dark p-3 p-md-4 ptm-play">
        {win && !validThresholds(roundThresholds) ? (
          <div style={{ minHeight: '420px' }} className="d-flex align-items-center justify-content-center text-danger" role="alert">
            <span style={{ letterSpacing: '0.2em' }}>BUCKET EDGES INVALID: {JSON.stringify(roundThresholds)}</span>
          </div>
        ) : win ? (
          <MarketRound
            key={result ? `r${result.start}` : 'live'}
            market={market}
            win={win}
            thresholds={roundThresholds}
            call={result ? calls[result.start] ?? null : call}
            result={result}
            canCall={geo.allowed}
            onCall={onCall}
            onDismiss={dismiss}
          />
        ) : (
          <div style={{ minHeight: '420px' }} className="d-flex align-items-center justify-content-center ptm-faint">
            <span style={{ letterSpacing: '0.2em' }}>{liveError ? 'MARKET SERVICE UNREACHABLE' : 'CONNECTING TO TRENDPULSE…'}</span>
          </div>
        )}
        <BuyPanel market={market} win={win} allowed={geo.allowed} onBought={onCall} />
        <div className="ptm-section d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="ptm-faint small">
            {geo.allowed
              ? 'Buys are in VUSD on Vitruveo and settle on-chain when the market ends. The fee is 0.90 VUSD or 2%, whichever is higher.'
              : 'Market features are switched off for your country. The live market and its results stay visible.'}
          </span>
          <a href="#rulebook" className="ptm-btn ptm-btn-ghost">Rulebook</a>
        </div>
      </div>

      <RecentMarkets market={market} rows={recent} calls={calls} />
      <MarketRulebook market={market} />
    </div>
  );
}

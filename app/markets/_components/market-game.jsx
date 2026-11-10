'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUCKET_NAMES, rulesFor, validThresholds } from '../_lib/gamemath';
import { getLive, getSettle, getWindow } from './api';
import { useLiveWindow } from './use-live-window';
import { MarketRound } from './market-round';
import { MarketTicker } from './market-ticker';
import { MarketRulebook } from './market-rulebook';
import { fmtAbs, fmtUtc } from './market-format';
import { useGeo } from './geo';
import { BuyPanel } from './buy-panel';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, zeroAddress } from 'viem';
import { MARKET_TYPE_IDS, PRETREND_MARKETS_ABI, PRETREND_MARKETS_ADDRESS } from '../../config/pretrend-markets';
import { VITRUVEO_CHAIN_ID } from '../../config/vusd';

const RECENT = 8;


const vusd = (wei) => Number(formatUnits(wei, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The connected wallet's on-chain position in each recent market: buckets held, and what it won or got back.
function RecentMarkets({ market, rows, viewStart, onOpen }) {
  const decimals = market.unit === 'usd' ? 0 : 1;
  const { address } = useAccount();
  const typeId = MARKET_TYPE_IDS[market.slug];
  const posQ = useReadContracts({
    contracts: rows.map((r) => ({
      address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, chainId: VITRUVEO_CHAIN_ID,
      functionName: 'positionOf', args: [BigInt(typeId || 0), BigInt(r.start), address || zeroAddress],
    })),
    query: { enabled: !!address && !!typeId && rows.length > 0, refetchInterval: 15000 },
  });
  const posOf = (i) => posQ.data?.[i]?.result;
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
                <th>Your position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const p = posOf(i);
                const held = p ? [4, 3, 2, 1, 0].filter((b) => p.units[b] > 0n) : [];
                const names = held.map((b) => BUCKET_NAMES[b]).join(', ');
                const bought = p ? p.amount.reduce((a, x) => a + x, 0n) : 0n;
                const wonIt = !r.void && held.includes(r.bucket);
                return (
                  <tr
                    key={r.start}
                    onClick={() => onOpen(r.start)}
                    title="Open this market"
                    style={{ cursor: 'pointer', background: viewStart === r.start ? 'rgba(47,143,214,0.12)' : undefined }}
                  >
                    <td className="ptm-mono">{fmtUtc(r.start)}</td>
                    <td className="ptm-mono">{r.void ? '—' : r.series.length}</td>
                    <td className="ptm-mono" style={{ textAlign: 'right' }}>{r.void ? 'void' : fmtAbs(r.fit.trendAbs, market, decimals)}</td>
                    <td>{r.void ? '—' : BUCKET_NAMES[r.bucket]}</td>
                    <td>
                      {!held.length ? <span className="ptm-faint">—</span>
                        : r.void ? <span className="ptm-faint">{names} · void, {vusd(bought)} VUSD refunded</span>
                        : wonIt ? <span style={{ color: '#4ade80' }}>{names} · won {vusd(p.potential[r.bucket])} VUSD</span>
                        : <span className="ptm-faint">{names} · lost</span>}
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
  const [picks, setPicks] = useState({}); // bucket selected on this page, per window start (not stored)
  const [result, setResult] = useState(null); // the settled window shown in place of the live one
  // markets already opened on this page (auto or by hand): never reopened automatically, so Back to live sticks
  const openedRef = useRef(new Set());
  const loadedAtRef = useRef(Math.floor(Date.now() / 1000)); // auto-open only markets that end after page load
  const [recent, setRecent] = useState([]);

  const geo = useGeo();
  const { address } = useAccount();
  const win = useLiveWindow(market, live);
  const thresholds = (windowInfo && windowInfo.start === win?.start ? windowInfo.thresholds : null) || live?.thresholds || market.fallbackThresholds;
  const call = win ? picks[win.start] ?? null : null;

  useEffect(() => {
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
    setPicks((prev) => ({ ...prev, [win.start]: bucket }));
  }, [win]);

  // The connected wallet's on-chain position in the window that just ended: if it bought in, the result is shown.
  const typeId = MARKET_TYPE_IDS[market.slug];
  const prevStart = win ? win.start - rules.gameS : 0;
  const prevPosQ = useReadContract({
    address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, chainId: VITRUVEO_CHAIN_ID,
    functionName: 'positionOf', args: [BigInt(typeId || 0), BigInt(prevStart), address || zeroAddress],
    query: { enabled: !!typeId && !!address && !!prevStart, refetchInterval: 10000 },
  });
  const boughtPrev = !!prevPosQ.data && prevPosQ.data.units.some((u) => u > 0n);

  // The wallet's buy in the open market, shown on the chart: its largest bucket by amount.
  const livePosQ = useReadContract({
    address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, chainId: VITRUVEO_CHAIN_ID,
    functionName: 'positionOf', args: [BigInt(typeId || 0), BigInt(win?.start || 0), address || zeroAddress],
    query: { enabled: !!typeId && !!address && !!win?.start, refetchInterval: 4000 },
  });
  const liveBuy = (() => {
    const p = livePosQ.data;
    if (!p) return null;
    let best = null;
    for (let b = 0; b < 5; b++) if (p.units[b] > 0n && (best === null || p.amount[b] > p.amount[best])) best = b;
    return best;
  })();

  // When a window this wallet bought into ends while the page is open, poll until it is settled, then show it once.
  useEffect(() => {
    if (!win || result) return undefined;
    const prev = win.start - rules.gameS;
    if (!boughtPrev || openedRef.current.has(prev)) return undefined;
    if (prev + rules.gameS < loadedAtRef.current) return undefined; // ended before this page loaded: stay live
    if (win.now > prev + rules.gameS + 120) return undefined; // too old to replay
    let stop = false;
    const poll = async () => {
      try {
        const r = await getSettle(market.slug, prev);
        if (stop || !r.settled || openedRef.current.has(prev)) return;
        openedRef.current.add(prev);
        setResult(r);
      } catch (e) {
        // next poll retries
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [win?.start, win?.phase, boughtPrev, result, market.slug, rules]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confetti when the connected wallet holds units in the winning bucket of the market just settled.
  const posQ = useReadContract({
    address: PRETREND_MARKETS_ADDRESS,
    abi: PRETREND_MARKETS_ABI,
    chainId: VITRUVEO_CHAIN_ID,
    functionName: 'positionOf',
    args: [BigInt(typeId || 0), BigInt(result?.start || 0), address || zeroAddress],
    query: { enabled: !!typeId && !!result && !!address },
  });
  const won = !!result && !result.void && !!posQ.data && posQ.data.units[result.bucket] > 0n;
  // the bucket shown as the wallet's on the settled round: the winning one if held, else its largest buy
  const heldBucket = (() => {
    if (!result || !posQ.data) return null;
    const u = posQ.data.units;
    if (!result.void && u[result.bucket] > 0n) return result.bucket;
    let best = null;
    for (let b = 0; b < 5; b++) if (u[b] > 0n && (best === null || posQ.data.amount[b] > posQ.data.amount[best])) best = b;
    return best;
  })();

  // One market on screen at a time: the open one (live), or a settled one (result) opened automatically when a
  // market this wallet bought into ends, from Recent markets, or from a ?start= link.
  const setUrlStart = (st) => {
    try {
      const u = new URL(window.location.href);
      if (st) u.searchParams.set('start', String(st)); else u.searchParams.delete('start');
      window.history.replaceState(null, '', u.toString());
    } catch (e) {
      // no history API
    }
  };
  const openMarket = useCallback(async (st) => {
    try {
      const r = await getSettle(market.slug, st);
      if (!r.settled) return;
      setResult(r);
      openedRef.current.add(st);
      setUrlStart(st);
      document.getElementById('ptm-play')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // stays on the current view
    }
  }, [market.slug]);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('start');
    const st = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(st) && st % rules.gameS === 0) openMarket(st);
  }, [openMarket, rules.gameS]);
  const dismiss = () => { setResult(null); setUrlStart(null); };
  const lastResult = recent.length ? recent[0] : null;
  const roundThresholds = result?.thresholds || thresholds;
  useEffect(() => {
    if (win && !validThresholds(roundThresholds)) console.error('[markets] invalid bucket edges', market.slug, roundThresholds);
  }, [win, roundThresholds, market.slug]);

  return (
    <div className="ptm">
      <MarketTicker market={market} win={win} thresholds={thresholds} calibration={live?.calibration} lastResult={lastResult} />

      <div id="ptm-play" className="card-dark p-3 p-md-4 ptm-play" style={{ scrollMarginTop: '90px' }}>
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
            call={result ? heldBucket : liveBuy}
            result={result}
            canCall={geo.allowed}
            onCall={onCall}
            onDismiss={dismiss}
            celebrate={won}
          />
        ) : (
          <div style={{ minHeight: '420px' }} className="d-flex align-items-center justify-content-center ptm-faint">
            <span style={{ letterSpacing: '0.2em' }}>{liveError ? 'MARKET SERVICE UNREACHABLE' : 'CONNECTING TO TRENDPULSE…'}</span>
          </div>
        )}
        <div className="ptm-section">
          <BuyPanel market={market} win={win} viewStart={result ? result.start : null} allowed={geo.allowed} bucket={call} onBucket={onCall} onBought={onCall} part="controls" />
        </div>
        <BuyPanel market={market} win={win} viewStart={result ? result.start : null} allowed={geo.allowed} bucket={call} onBucket={onCall} onBought={onCall} part="positions" />
        <div className="ptm-section d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="ptm-faint small">
            {geo.allowed ? 'Buys are in VUSD on Vitruveo and settle on-chain when the market ends. The fee is 0.90 VUSD or 2%, whichever is higher.' : null}
          </span>
          <a href="#rulebook" className="ptm-btn ptm-btn-ghost">Rulebook</a>
        </div>
      </div>

      <RecentMarkets market={market} rows={recent} viewStart={result ? result.start : null} onOpen={openMarket} />
      <MarketRulebook market={market} />
    </div>
  );
}

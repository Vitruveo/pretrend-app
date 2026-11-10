'use client';

import { useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAccount, useBalance, useReadContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { erc20Abi, formatUnits, parseUnits, zeroAddress } from 'viem';
import { BUCKET_NAMES, BUCKET_COLORS, bucketRgba } from '../_lib/gamemath';
import { VITRUVEO_CHAIN_ID, VUSD_ADDRESS } from '../../config/vusd';
import { EXPLORER, MARKET_TYPE_IDS, PRETREND_MARKETS_ABI, PRETREND_MARKETS_ADDRESS } from '../../config/pretrend-markets';
import { buyUnits, claimAll, errText } from './buy-exec';

const M = { address: PRETREND_MARKETS_ADDRESS, abi: PRETREND_MARKETS_ABI, chainId: VITRUVEO_CHAIN_ID };
const ORDER = [4, 3, 2, 1, 0]; // Moon first, as on the strip
const QUICK = [10, 25, 50, 100];

// Timeslope pricing, the contract's exact integer math (PretrendMarkets._price / _fill), so the panel can price and
// quote from the page clock: the chain's block time trails it by a few seconds at every market start.
const ONE = 10n ** 18n;
const START = ONE / 10n;
const RAMP = ONE - START;
function priceAt(lockS, depth, elapsed, u) {
  const p = START + (RAMP * elapsed) / lockS + (RAMP * u) / (u + depth);
  return p > ONE ? ONE : p;
}
function fillUnits(lockS, depth, elapsed, u0, amount) {
  const slice = amount / 10n;
  let spent = 0n;
  let u = u0;
  for (let i = 0; i < 10; i++) {
    const s = i === 9 ? amount - spent : slice;
    if (s === 0n) continue;
    const d0 = (s * ONE) / priceAt(lockS, depth, elapsed, u);
    u += (s * ONE) / priceAt(lockS, depth, elapsed, u + d0 / 2n);
    spent += s;
  }
  return u - u0;
}
const INCLUSION_S = 15n; // allowance for signing and block inclusion when setting the minimum units

const n = (wei, d = 2) => (wei === undefined || wei === null ? '—' : Number(formatUnits(wei, 18)).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const localTime = (s) => new Date(Number(s) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;

function parseAmount(text) {
  if (!/^\d*(\.\d{0,18})?$/.test(text) || text === '' || text === '.') return null;
  try {
    const v = parseUnits(text, 18);
    return v > 0n ? v : null;
  } catch (e) {
    return null;
  }
}

// Positions of every participant in the market: amount bought, units, and the payout if each held bucket wins.
function PositionsTable({ snap, me }) {
  const rows = snap.positions || [];
  if (!rows.length) return <p className="ptm-faint small mb-0">No buys in this market yet.</p>;
  const settled = Number(snap.market.status) !== 0;
  return (
    <div className="table-responsive">
      <table className="ptm-table">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Bucket</th>
            <th style={{ textAlign: 'right' }}>Bought</th>
            <th style={{ textAlign: 'right' }}>Units</th>
            <th style={{ textAlign: 'right' }}>{settled ? 'Payout' : 'Reward if it wins'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((p) =>
            ORDER.filter((b) => p.units[b] > 0n).map((b) => {
              const mine = me && p.account.toLowerCase() === me.toLowerCase();
              const won = settled && Number(snap.market.status) === 1 && Number(snap.market.winner) === b;
              const payout = Number(snap.market.status) === 2 ? p.amount[b] : won ? p.potential[b] : 0n;
              return (
                <tr key={`${p.account}-${b}`} style={mine ? { background: 'rgba(47,143,214,0.12)' } : undefined}>
                  <td className="ptm-mono">
                    <a href={`${EXPLORER}/address/${p.account}`} target="_blank" rel="noreferrer">{short(p.account)}</a>
                    {mine && <span className="ptm-signal ms-2 small">you</span>}
                  </td>
                  <td style={{ color: BUCKET_COLORS[b], fontWeight: 600 }}>{BUCKET_NAMES[b]}</td>
                  <td className="ptm-mono" style={{ textAlign: 'right' }}>{n(p.amount[b])}</td>
                  <td className="ptm-mono" style={{ textAlign: 'right' }}>{n(p.units[b], 1)}</td>
                  <td className="ptm-mono" style={{ textAlign: 'right', color: settled ? (payout > 0n ? '#4ade80' : 'var(--ptm-faint)') : 'var(--ptm-ink)' }}>
                    {settled ? n(payout) : n(p.potential[b])}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// Payouts and refunds across this market type's last 24 hours, claimable in one transaction.
function ClaimBar({ typeId, windowS, address, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const starts = useMemo(() => {
    const cur = Math.floor(Date.now() / 1000 / windowS) * windowS;
    return Array.from({ length: Math.floor(86400 / windowS) + 1 }, (_, i) => BigInt(cur - (i + 1) * windowS));
  }, [windowS]);
  const q = useReadContract({ ...M, functionName: 'claimableOf', args: [BigInt(typeId), starts, address || zeroAddress], query: { enabled: !!address, refetchInterval: 10000 } });
  const total = q.data?.[0] ?? 0n;
  const each = q.data?.[1] ?? [];
  if (!address || total === 0n) return msg ? <p className="small ptm-faint mt-2 mb-0">{msg}</p> : null;
  const claimStarts = starts.filter((_, i) => each[i] > 0n);
  const go = async () => {
    setBusy(true);
    try {
      const hash = await claimAll({ typeId, starts: claimStarts, say: setMsg });
      setMsg(<>Claimed {n(total)} VUSD. <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction</a></>);
      q.refetch();
      onDone?.();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy(false);
  };
  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 mt-3" style={{ border: '1px solid rgba(74,222,128,0.5)', borderRadius: 8, background: 'rgba(74,222,128,0.08)' }}>
      <span className="ptm-ink">
        <strong className="ptm-mono" style={{ color: '#4ade80' }}>{n(total)} VUSD</strong> to claim from {claimStarts.length} market{claimStarts.length === 1 ? '' : 's'}
      </span>
      <button type="button" className="ptm-btn" style={{ borderColor: '#4ade80', color: '#4ade80', background: 'rgba(74,222,128,0.12)' }} disabled={busy} onClick={go}>
        {busy ? 'Claiming…' : 'Claim'}
      </button>
      {msg && <div className="w-100 small ptm-faint">{msg}</div>}
    </div>
  );
}

export function BuyPanel({ market, win, allowed, bucket: selBucket, onBucket, onBought }) {
  const typeId = MARKET_TYPE_IDS[market.slug];
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [ownBucket, setOwnBucket] = useState(null);
  // controlled by the market page when it passes bucket/onBucket (the strip beside the chart selects too)
  const bucket = selBucket === undefined ? ownBucket : selBucket;
  const setBucket = onBucket || setOwnBucket;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // the market of the page clock's window: a new window is a new query, fetched the moment it starts
  const start = win?.start ?? 0;
  const snapQ = useReadContract({ ...M, functionName: 'snapshot', args: [BigInt(typeId || 0), BigInt(start), address || zeroAddress], query: { enabled: !!typeId && !!start, refetchInterval: 4000, placeholderData: keepPreviousData } });
  const vusdQ = useReadContract({ address: VUSD_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [address || zeroAddress], chainId: VITRUVEO_CHAIN_ID, query: { enabled: !!address, refetchInterval: 10000 } });
  const vtruQ = useBalance({ address, chainId: VITRUVEO_CHAIN_ID, query: { enabled: !!address, refetchInterval: 30000 } });

  const amount = parseAmount(text);

  if (!typeId) return null;
  const raw = snapQ.data;
  const vusd = vusdQ.data;
  const noGas = isConnected && vtruQ.data && vtruQ.data.value === 0n;

  // Until the new window's read lands, the previous market's data stands in with its buys zeroed: a market
  // always starts empty.
  const fresh = !!raw && Number(raw.market.start) === start;
  const zero5 = [0n, 0n, 0n, 0n, 0n];
  const snap = raw && (fresh ? raw : { ...raw, market: { ...raw.market, start: BigInt(start), status: 0, amount: zero5, units: zero5, total: 0n, participantCount: 0n }, positions: [], mine: null, lockAt: BigInt(start) + BigInt(raw.marketType.lockS), endAt: BigInt(start) + BigInt(raw.marketType.windowS) });

  // clock-driven state, prices and quote
  const now = win?.now ?? Date.now() / 1000;
  const lockS = snap ? BigInt(snap.marketType.lockS) : 1n;
  const depth = snap ? snap.marketType.depth : 1n;
  const elapsed = BigInt(Math.max(0, Math.min(Number(lockS), Math.floor(now - start))));
  const lockAt = snap ? Number(snap.lockAt) : null;
  const beforeLaunch = snap && now < Number(snap.launchTs);
  const clockOpen = !!snap && win?.phase === 'open' && !snap.paused && snap.marketType.active && Number(snap.market.status) === 0;
  const isOpen = clockOpen && (!beforeLaunch || raw.open || !fresh); // before launch only the contract knows the allowlist
  const prices = snap ? snap.market.units.map((u) => priceAt(lockS, depth, elapsed, u)) : null;
  let state;
  if (!snap) state = snapQ.isError ? 'Market contract unreachable' : 'Loading market…';
  else if (snap.paused) state = 'Markets are paused';
  else if (!allowed) state = 'Market participation is switched off for your country';
  else if (beforeLaunch && !(fresh && raw.open) && clockOpen) state = `Buying opens at ${localTime(snap.launchTs)}`;
  else if (isOpen) state = `Open · buys close in ${mmss(lockAt - now)}`;
  else if (now < Number(snap.endAt)) state = 'Locked · the trend is completing';
  else state = 'Market ended';

  let quote = null; // [units, fee, total, avgPrice, minUnits]
  if (snap && bucket !== null && amount !== null && isOpen) {
    const u0 = snap.market.units[bucket];
    const units = fillUnits(lockS, depth, elapsed, u0, amount);
    const later = elapsed + INCLUSION_S > lockS ? lockS : elapsed + INCLUSION_S;
    const minUnits = (fillUnits(lockS, depth, later, u0, amount) * 99n) / 100n;
    const pct = (amount * snap.feeBps) / 10000n;
    const fee = pct > snap.minFee ? pct : snap.minFee;
    quote = [units, fee, amount + fee, units > 0n ? (amount * ONE) / units : 0n, minUnits];
  }

  const canBuy = !!snap && isOpen && allowed && isConnected && !busy;
  const total = quote ? quote[2] : null;
  const short_ = amount !== null && vusd !== undefined && total !== null && vusd < total;
  const tooBig = snap && amount !== null && snap.marketType.maxBuy > 0n && amount > snap.marketType.maxBuy;

  // reward if this bucket wins, after this buy
  let reward = null;
  if (snap && quote && bucket !== null && amount !== null) {
    const others = snap.market.total - snap.market.amount[bucket];
    const unitsAfter = snap.market.units[bucket] + quote[0];
    reward = unitsAfter > 0n ? amount + (quote[0] * others) / unitsAfter : amount;
  }

  const buy = async () => {
    if (!canBuy || bucket === null || amount === null || !quote) return;
    setBusy(true);
    setMsg(null);
    try {
      const minUnits = quote[4]; // priced INCLUSION_S later: the price rises with time until the buy is mined
      const hash = await buyUnits({ account: address, typeId, bucket, amount, minUnits, say: setMsg });
      setMsg(<>Bought {BUCKET_NAMES[bucket]} for {n(amount)} VUSD. <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction</a></>);
      setText('');
      onBought?.(bucket);
      snapQ.refetch();
      vusdQ.refetch();
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy(false);
  };

  return (
    <div className="ptm-section">
      <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2 mb-3">
        <h2 className="h5 fw-bold mb-0 ptm-ink">Buy units</h2>
        <span className="ptm-mono small" style={{ color: snap?.open && allowed ? '#4ade80' : 'var(--ptm-faint)' }}>{state}</span>
      </div>

      {/* bucket picker: live price and pool per bucket */}
      <div className="d-grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {ORDER.map((b) => {
          const sel = bucket === b;
          return (
            <button
              key={b}
              type="button"
              className="ptm-bucket-btn text-start p-2"
              onClick={() => setBucket(b)}
              disabled={!snap}
              style={{
                borderRadius: 8,
                border: `1px solid ${sel ? BUCKET_COLORS[b] : 'rgba(255,255,255,0.12)'}`,
                background: sel ? bucketRgba(b, 0.22) : bucketRgba(b, 0.06),
                color: 'var(--ptm-ink)',
              }}
            >
              <div style={{ color: BUCKET_COLORS[b], fontWeight: 700, letterSpacing: '0.08em' }}>{BUCKET_NAMES[b].toUpperCase()}</div>
              <div className="ptm-mono" style={{ fontSize: '1.15rem' }}>{prices ? `$${Number(formatUnits(prices[b], 18)).toFixed(3)}` : '—'}<span className="ptm-faint small"> /unit</span></div>
              <div className="ptm-mono ptm-faint small">{snap ? `${n(snap.market.amount[b])} VUSD in` : ''}</div>
            </button>
          );
        })}
      </div>

      <div className="mx-auto text-center" style={{ maxWidth: '440px' }}>
        <label className="small ptm-faint mb-1 d-block" htmlFor="ptm-amount">Amount (VUSD)</label>
        <input
          id="ptm-amount"
          className="form-control bg-transparent text-white ptm-mono text-center"
          inputMode="decimal"
          placeholder="0.00"
          value={text}
          onChange={(e) => setText(e.target.value.replace(',', '.'))}
          style={{ borderColor: 'rgba(255,255,255,0.2)', fontSize: '1.4rem' }}
        />
        <div className="d-flex gap-2 mt-2 flex-wrap justify-content-center">
          {QUICK.map((v) => (
            <button key={v} type="button" className="ptm-btn ptm-btn-ghost py-1 px-2" onClick={() => setText(String(v))}>{v}</button>
          ))}
        </div>
        {isConnected && (
          <div className="small ptm-faint mt-2 ptm-mono">
            Balance {vusd !== undefined ? n(vusd) : '…'} VUSD
            {noGas && <span style={{ color: '#f97316' }}> · no VTRU for gas</span>}
          </div>
        )}
        <div className="small ptm-mono mt-3 text-start">
          {bucket === null ? (
            <div className="ptm-faint text-center">Pick a bucket.</div>
          ) : amount === null ? (
            <div className="ptm-faint text-center">Enter an amount for {BUCKET_NAMES[bucket]}.</div>
          ) : quote ? (
            <div className="d-grid" style={{ gridTemplateColumns: 'auto auto', columnGap: '1rem', rowGap: '0.15rem' }}>
              <span className="ptm-faint">Units</span><span className="text-end ptm-ink">{n(quote[0], 1)}</span>
              <span className="ptm-faint">Avg price</span><span className="text-end ptm-ink">${Number(formatUnits(quote[3], 18)).toFixed(3)}</span>
              <span className="ptm-faint">Fee</span><span className="text-end ptm-ink">{n(quote[1])}</span>
              <span className="ptm-faint">Total</span><span className="text-end ptm-ink">{n(quote[2])} VUSD</span>
              <span className="ptm-faint">If {BUCKET_NAMES[bucket]} wins</span><span className="text-end" style={{ color: '#4ade80' }}>{reward !== null ? `${n(reward)} VUSD` : '—'}</span>
            </div>
          ) : (
            <div className="ptm-faint text-center">Buying is closed for this window.</div>
          )}
        </div>
        <div className="d-grid mt-3">
          {!isConnected ? (
            <button type="button" className="ptm-btn" onClick={() => openConnectModal?.()} disabled={!allowed}>Connect</button>
          ) : (
            <button type="button" className="ptm-btn" onClick={buy} disabled={!canBuy || bucket === null || amount === null || !quote || short_ || tooBig}>
              {busy ? 'Working…' : bucket === null ? 'Buy' : `Buy ${BUCKET_NAMES[bucket]}`}
            </button>
          )}
          {short_ && <div className="small mt-1" style={{ color: '#f97316' }}>Not enough VUSD. <a href="/swap/">Swap</a></div>}
          {tooBig && <div className="small mt-1" style={{ color: '#f97316' }}>Max {n(snap.marketType.maxBuy, 0)} VUSD per buy</div>}
        </div>
        {msg && <div className="small mt-3 ptm-dim">{msg}</div>}
      </div>

      <ClaimBar typeId={typeId} windowS={market.windowS} address={address} onDone={() => vusdQ.refetch()} />

      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2 mb-2">
          <h3 className="h6 fw-bold mb-0 ptm-ink">Positions in this market</h3>
          {snap && (
            <span className="small ptm-faint ptm-mono">
              {n(snap.market.total)} VUSD in · {Number(snap.market.participantCount)} participant{Number(snap.market.participantCount) === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {snap ? <PositionsTable snap={snap} me={address} /> : <p className="ptm-faint small mb-0">Loading…</p>}
      </div>
    </div>
  );
}

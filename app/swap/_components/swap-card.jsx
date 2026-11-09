'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { BSC_CHAIN_ID, TOKENS, VITRUVEO_CHAIN_ID, routeOf } from '../../config/vusd';
import { BRIDGE, BRIDGE_ABI, TX_URL, errText, planSteps, preflight, runSwap, usdtBridge } from './swap-exec';

const PURPLE = '#8b5cf6';
const LAVENDER = '#c4b5fd';
const YELLOW = '#f0b90b';
const TETHER = '#26a17b';
const MAX_DP = 6;
const ORDER = ['VUSD', 'USDT_B', 'USDT_BSC'];

function ChainBadge({ chainId }) {
  const base = { position: 'absolute', right: '-3px', bottom: '-3px', width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #120e1f' };
  if (chainId === 56) return <span aria-hidden="true" style={{ ...base, background: YELLOW }} />;
  return <img src="/vitruveo.svg" alt="" aria-hidden="true" style={{ ...base, background: '#0a0f0a' }} />;
}

function TokenIcon({ token, size = 32 }) {
  const isVusd = token.key === 'VUSD';
  return (
    <span className="position-relative d-inline-block flex-shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden="true"
        className="d-flex align-items-center justify-content-center fw-bold text-white"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          fontSize: size * 0.46,
          background: isVusd ? `linear-gradient(135deg, ${PURPLE}, #5b21b6)` : TETHER,
        }}
      >
        {isVusd ? 'V' : '₮'}
      </span>
      <ChainBadge chainId={token.chainId} />
    </span>
  );
}

function fmtBal(v) {
  if (v === null || v === undefined) return null;
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// Keeps the input a plain non-negative decimal with at most MAX_DP places, or a whole number when `whole`
// (cross-chain routes: the USDT bridge contract only moves whole USDT and drops any fraction).
function sanitize(raw, whole = false) {
  if (whole) return raw.split(/[.,]/)[0].replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  let s = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, MAX_DP);
  if (s.startsWith('.')) s = '0' + s;
  return s;
}

function useBalances(address) {
  const live = ORDER.filter((k) => TOKENS[k].address);
  const reads = useReadContracts({
    contracts: live.flatMap((k) => [
      { address: TOKENS[k].address, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: TOKENS[k].chainId },
      { address: TOKENS[k].address, abi: erc20Abi, functionName: 'decimals', chainId: TOKENS[k].chainId },
    ]),
    query: { enabled: !!address, refetchInterval: 20000 },
  });
  return useMemo(() => {
    const out = {};
    for (const k of ORDER) out[k] = { raw: null, decimals: null, value: null };
    live.forEach((k, i) => {
      const bal = reads.data?.[i * 2]?.result;
      const dec = reads.data?.[i * 2 + 1]?.result;
      if (bal !== undefined && dec !== undefined) {
        out[k] = { raw: bal, decimals: Number(dec), value: Number(formatUnits(bal, Number(dec))) };
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reads.data, address]);
}

function TokenButton({ token, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn d-inline-flex align-items-center gap-2 flex-shrink-0"
      style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.45)', borderRadius: '999px', color: '#fff', padding: '0.35rem 0.75rem 0.35rem 0.4rem' }}
      aria-label={`Select token, current ${token.symbol} on ${token.chain}`}
    >
      <TokenIcon token={token} size={28} />
      <span className="text-start lh-sm">
        <span className="d-block fw-bold">{token.symbol}</span>
        <span className="d-block" style={{ fontSize: '0.7rem', color: LAVENDER }}>{token.chain}</span>
      </span>
      <span aria-hidden="true" style={{ color: LAVENDER, fontSize: '0.75rem' }}>▼</span>
    </button>
  );
}

function Panel({ label, token, balance, connected, children, onPick, footer }) {
  const bal = balance.value;
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px 16px' }}>
      <div className="d-flex justify-content-between align-items-center mb-2 small">
        <span className="text-white-50">{label}</span>
        <span className="text-white-50" style={{ fontVariantNumeric: 'tabular-nums' }}>
          Balance: {!connected ? '—' : bal === null ? '…' : fmtBal(bal)}
        </span>
      </div>
      <div className="d-flex align-items-center gap-3">
        <TokenButton token={token} onClick={onPick} />
        <div className="flex-grow-1 text-end" style={{ minWidth: 0 }}>{children}</div>
      </div>
      {footer}
    </div>
  );
}

function TokenPicker({ side, current, balances, connected, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Select ${side === 'from' ? 'source' : 'destination'} token`}
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ background: 'rgba(0,0,0,0.65)', zIndex: 2000 }}
      onClick={onClose}
    >
      <div
        className="w-100"
        style={{ maxWidth: '420px', background: '#120e1f', border: '1px solid rgba(139,92,246,0.5)', borderRadius: '20px', padding: '18px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="fw-bold text-white">Select a token</span>
          <button type="button" className="btn btn-sm text-white-50" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="d-flex flex-column gap-1">
          {ORDER.map((k) => {
            const t = TOKENS[k];
            const b = balances[k];
            const active = k === current;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onPick(k)}
                className="btn d-flex align-items-center gap-3 text-start w-100"
                style={{ background: active ? 'rgba(139,92,246,0.2)' : 'transparent', border: active ? '1px solid rgba(139,92,246,0.5)' : '1px solid transparent', borderRadius: '12px', color: '#fff', padding: '10px 12px' }}
              >
                <TokenIcon token={t} size={36} />
                <span className="flex-grow-1 lh-sm">
                  <span className="d-block fw-bold">{t.symbol}</span>
                  <span className="d-block small text-white-50">{t.name} · {t.chain}</span>
                </span>
                <span className="text-white-50 small" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {!connected ? '' : b.value === null ? '…' : fmtBal(b.value)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="small text-white-50 mt-3 mb-0">Every pair is VUSD against USDT.b (Vitruveo) or USDT (BNB Chain), always 1:1.</p>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="d-flex justify-content-between small py-1">
      <span className="text-white-50">{k}</span>
      <span className="text-white text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

const fmtUnits = (v) => Number(formatUnits(v, 18)).toLocaleString('en-US', { maximumFractionDigits: 6 });

function Modal({ title, onClose, children, label }) {
  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label || title}
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ background: 'rgba(0,0,0,0.7)', zIndex: 2000 }}
      onClick={onClose || undefined}
    >
      <div
        className="w-100"
        style={{ maxWidth: '440px', background: '#120e1f', border: '1px solid rgba(139,92,246,0.5)', borderRadius: '20px', padding: '20px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="fw-bold text-white">{title}</span>
          {onClose && <button type="button" className="btn btn-sm text-white-50" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

function StepList({ steps, progress }) {
  return (
    <ol className="list-unstyled mb-0 d-flex flex-column gap-2">
      {steps.map((s, i) => {
        const p = progress[i] || {};
        const mark = p.state === 'done' ? '✓' : p.state === 'error' ? '!' : p.state === 'active' ? '…' : String(i + 1);
        const tone = p.state === 'done' ? '#7abe4d' : p.state === 'error' ? '#ef4444' : p.state === 'active' ? PURPLE : 'rgba(255,255,255,0.25)';
        return (
          <li key={`${s.id}-${i}`} className="d-flex align-items-center gap-3 small">
            <span
              className="d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
              style={{ width: '24px', height: '24px', borderRadius: '50%', border: `1px solid ${tone}`, color: tone, fontSize: '0.75rem' }}
              aria-hidden="true"
            >
              {mark}
            </span>
            <span className={p.state === 'active' ? 'text-white fw-bold' : 'text-white-50'}>
              {s.label}
            </span>
            {p.hash && s.chainId && (
              <a className="ms-auto small" href={TX_URL[s.chainId](p.hash)} target="_blank" rel="noopener noreferrer" style={{ color: LAVENDER }}>
                tx ↗
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Everything unfinished on the USDT bridge for the connected wallet, from Scope's status API, each with the
// exact reason it is stalled: tracked bridge txs, other pending wallet txs, an escrow not yet notarized
// (resume or refund), and signed receipts not yet received.
function PendingTransfers({ address, onChanged }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const bridge = useMemo(() => (address ? usdtBridge(address, setStatus) : null), [address]);

  const load = useCallback(() => {
    if (!bridge) return;
    bridge.status().then((st) => { setState(st); setError(''); }).catch((e) => setError(`Could not load transfer status: ${errText(e)}`));
  }, [bridge]);
  useEffect(() => {
    load();
    const t = setInterval(load, busy ? 5000 : 15000);
    return () => clearInterval(t);
  }, [load, busy]);

  const items = state?.items || [];
  if (!address || (!items.length && !error)) return null;

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errText(e));
    } finally {
      setStatus('');
      setBusy(false);
      load();
      onChanged();
    }
  };

  const ghost = { border: '1px solid rgba(255,255,255,0.2)' };
  const actions = (it) => {
    if (it.kind === 'swap') {
      return <button type="button" className="btn btn-signal btn-sm" disabled={busy} onClick={() => run(() => bridge.resumeSwap(it.swapId))}>Continue</button>;
    }
    if (it.kind === 'escrow' && state.escrow) {
      // A USDT lock on BSC continues as a VUSD swap here; a USDT.b burn on Vitruveo finishes as a plain bridge.
      const cont = state.escrow.sourceChainId === BSC_CHAIN_ID ? () => bridge.toVusd() : () => bridge.resume();
      return (
        <>
          <button type="button" className="btn btn-signal btn-sm" disabled={busy} onClick={() => run(cont)}>Continue</button>
          <button type="button" className="btn btn-sm text-white-50" style={ghost} disabled={busy} onClick={() => run(() => bridge.cancel())}>Cancel &amp; refund</button>
        </>
      );
    }
    if (it.kind === 'receipt') {
      return <button type="button" className="btn btn-signal btn-sm" disabled={busy} onClick={() => run(() => bridge.finish({ id: it.receiptId }))}>Receive</button>;
    }
    if (it.dismissHash) {
      return <button type="button" className="btn btn-sm text-white-50" style={ghost} disabled={busy} onClick={() => run(() => bridge.dismissTx(it.dismissHash))}>Dismiss</button>;
    }
    return null;
  };

  return (
    <div className="mb-3 p-3" style={{ border: '1px solid rgba(240,185,11,0.5)', background: 'rgba(240,185,11,0.08)', borderRadius: '16px' }}>
      <div className="fw-bold text-white small mb-2">Pending on the USDT bridge</div>
      {items.map((it) => (
        <div key={it.key} className="small mb-3">
          <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
            <span className={it.severity === 'error' ? 'text-danger fw-bold' : 'text-white fw-bold'}>{it.title}</span>
            <span className="d-flex gap-2">{actions(it)}</span>
          </div>
          <ul className="mb-0 ps-3 mt-1 text-white-50">
            {it.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {it.links?.map((l) => (
            <a key={l.href} className="small me-3" href={l.href} target="_blank" rel="noopener noreferrer" style={{ color: LAVENDER }}>{l.label} ↗</a>
          ))}
        </div>
      ))}
      {status && <div className="small" style={{ color: LAVENDER }} role="status">{status}</div>}
      {error && <div className="small text-danger" role="alert">{error}</div>}
    </div>
  );
}

// Pre-bridge checklist from Scope (same three items as Scope's bridge pages). Every item must pass.
// Shown beside the card on wide screens and inside it, above the button, on narrow ones.
function Checklist({ pre, error, className = '', style }) {
  const mark = { ok: ['✓', '#7abe4d'], fail: ['✕', '#ef4444'], idle: ['–', 'rgba(255,255,255,0.35)'] };
  return (
    <div className={className} style={style}>
      <div className="fw-bold text-white small mb-1">Pre-bridge checklist</div>
      {error && <div className="small text-danger" role="alert">{error}</div>}
      {!pre && !error && <div className="small text-white-50">Checking…</div>}
      {pre?.items.map((i) => {
        const [m, tone] = mark[i.state] || mark.idle;
        return (
          <div key={i.key} className="d-flex gap-2 small py-1">
            <span aria-hidden="true" className="fw-bold flex-shrink-0" style={{ color: tone, width: '1rem' }}>{m}</span>
            <span className="lh-sm">
              <span className="d-block text-white">{i.label}</span>
              <span className="d-block text-white-50">{i.detail}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// PancakeSwap-style 1:1 swap card. One side is always VUSD; the other is USDT.b on Vitruveo or USDT
// on BNB Chain. Runs in-page: wallet transactions for each leg, Scope's notary for the bridge receipt.
export function SwapCard() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const balances = useBalances(address);
  const fee = useReadContract({ address: BRIDGE, abi: BRIDGE_ABI, functionName: 'feeBps', chainId: BSC_CHAIN_ID });
  const queryClient = useQueryClient();

  const [fromKey, setFromKey] = useState('USDT_BSC');
  const [toKey, setToKey] = useState('VUSD');
  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState(null);
  const [run, setRun] = useState(null); // { phase: confirm|running|error|done, steps, progress, ctx, failedAt, error, received, fromKey, toKey }
  const [status, setStatus] = useState('');

  const from = TOKENS[fromKey];
  const to = TOKENS[toKey];
  const route = routeOf(fromKey, toKey);
  const crossChain = from.chainId !== to.chainId;

  // Changing the pair to a cross-chain route drops any fraction already typed.
  const setPair = (f, t) => {
    setFromKey(f);
    setToKey(t);
    if (TOKENS[f].chainId !== TOKENS[t].chainId) setAmount((a) => sanitize(a, true));
  };
  const flip = () => setPair(toKey, fromKey);

  // Picking a token keeps exactly one VUSD side: choosing the opposite side's token flips the pair;
  // choosing a USDT variant on a side puts VUSD on the other.
  const pick = (k) => {
    const side = picker;
    setPicker(null);
    const mine = side === 'from' ? fromKey : toKey;
    const other = side === 'from' ? toKey : fromKey;
    if (k === mine) return;
    if (k === other) return flip();
    if (side === 'from') setPair(k, 'VUSD');
    else setPair('VUSD', k);
  };

  const fromBal = balances[fromKey];
  const num = Number(amount);
  const hasAmount = amount !== '' && Number.isFinite(num) && num > 0;
  const amountWei = (() => { try { return hasAmount ? parseUnits(amount, 18) : 0n; } catch { return 0n; } })();
  const insufficient = hasAmount && fromBal.raw !== null && amountWei > fromBal.raw;
  const feeBps = fromKey === 'USDT_BSC' && fee.data !== undefined ? fee.data : 0n;
  const feeWei = (amountWei * feeBps) / 10000n;
  const receiveWei = amountWei - feeWei;

  // Checklist for cross-chain swaps: runs when the amount or direction changes (debounced), then every 15 s.
  // The timer is recreated on every change, so it always checks the current input. A sequence guard drops
  // responses that arrive after a newer request.
  const bridgeFrom = fromKey === 'USDT_BSC' ? BSC_CHAIN_ID : toKey === 'USDT_BSC' ? VITRUVEO_CHAIN_ID : null;
  const checkAmount = hasAmount ? amountWei : 0n;
  const [pre, setPre] = useState(null);
  const [preError, setPreError] = useState('');
  const preSeq = useRef(0);
  useEffect(() => {
    setPre(null);
    setPreError('');
    if (!address || !bridgeFrom) return undefined;
    const check = () => {
      const seq = ++preSeq.current;
      preflight(address, bridgeFrom, checkAmount)
        .then((p) => { if (seq === preSeq.current) { setPre(p); setPreError(''); } })
        .catch((e) => { if (seq === preSeq.current) setPreError(`Checklist unavailable: ${errText(e)}`); });
    };
    const t = setTimeout(check, 400);
    const iv = setInterval(check, 15000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [address, bridgeFrom, checkAmount]);
  const checklistPass = !bridgeFrom || !!pre?.pass;
  const showSide = isConnected && !!bridgeFrom;
  const firstFail = pre?.items.find((i) => i.state === 'fail');
  const FAIL_CTA = { 'bsc-gas': 'Insufficient BNB for gas', 'vitruveo-gas': 'Insufficient VTRU for gas', 'usdt-fee': 'Insufficient USDT' };

  const setPct = (p) => {
    if (fromBal.raw === null) return;
    const v = (fromBal.raw * BigInt(p)) / 100n;
    const s = formatUnits(v, fromBal.decimals);
    const clean = sanitize(s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
    setAmount(crossChain ? String(Math.trunc(Number(clean))) : clean);
  };

  const refresh = () => queryClient.invalidateQueries();

  const openConfirm = () => {
    const steps = planSteps(fromKey, toKey);
    setRun({ phase: 'confirm', steps, progress: steps.map(() => ({})), ctx: { account: address, amount: amountWei }, failedAt: 0, fromKey, toKey, amount, receiveWei });
  };

  const execute = async (start) => {
    const r = run;
    setRun({ ...r, phase: 'running', error: null });
    const progress = [...r.progress];
    const onStep = (i, patch) => {
      progress[i] = { ...progress[i], ...patch };
      setRun((cur) => (cur ? { ...cur, progress: [...progress], failedAt: i } : cur));
    };
    try {
      await runSwap({ fromKey: r.fromKey, toKey: r.toKey, steps: r.steps, start, ctx: r.ctx, onStep, say: setStatus });
      setRun((cur) => ({ ...cur, phase: 'done', received: r.ctx.received ?? r.ctx.amount }));
      setAmount('');
    } catch (e) {
      setStatus('');
      setRun((cur) => {
        const i = cur.failedAt;
        const prog = [...cur.progress];
        prog[i] = { ...prog[i], state: 'error' };
        return { ...cur, phase: 'error', progress: prog, error: errText(e) };
      });
    } finally {
      refresh();
    }
  };

  let cta;
  const btn = (label, props = {}) => <button type="button" className="btn btn-signal w-100 py-3" {...props}>{label}</button>;
  if (!isConnected) cta = btn('Connect Wallet', { onClick: () => openConnectModal?.() });
  else if (!hasAmount) cta = btn('Enter an amount', { disabled: true });
  else if (insufficient) cta = btn(`Insufficient ${from.symbol} balance`, { disabled: true });
  else if (bridgeFrom && !pre) cta = btn(preError ? 'Checklist unavailable' : 'Checking…', { disabled: true });
  else if (!checklistPass) cta = btn(firstFail ? FAIL_CTA[firstFail.key] || firstFail.label : 'Checklist not met', { disabled: true });
  else cta = btn('Swap', { onClick: openConfirm });

  const inputStyle = { background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '1.75rem', fontWeight: 600, width: '100%', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const runFrom = run && TOKENS[run.fromKey];
  const runTo = run && TOKENS[run.toKey];

  // Rate, fee, minimum received, networks and route. Beside the card (under the checklist) on wide screens
  // for cross-chain routes; inside the card otherwise.
  const details = (
    <>
      <Row k="Rate" v={`1 ${from.symbol} = 1 ${to.symbol}`} />
      {fromKey === 'USDT_BSC' && <Row k="Bridge fee" v={fee.data === undefined ? '…' : `${Number(feeBps) / 100}%${hasAmount ? ` (${fmtUnits(feeWei)} USDT)` : ''}`} />}
      <Row k="Minimum received" v={`${hasAmount ? fmtUnits(receiveWei) : '0'} ${to.symbol}`} />
      <Row k="Networks" v={crossChain ? `${from.chain} → ${to.chain}` : to.chain} />
      <div className="d-flex justify-content-between align-items-center small py-1 gap-3">
        <span className="text-white-50">Route</span>
        <span className="d-flex align-items-center flex-wrap justify-content-end gap-1">
          {route.map((k, i) => (
            <span key={k} className="d-inline-flex align-items-center gap-1">
              {i > 0 && <span className="text-white-50" aria-hidden="true">›</span>}
              <span className="d-inline-flex align-items-center gap-1 px-2 py-1" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px' }}>
                <TokenIcon token={TOKENS[k]} size={16} />
                <span className="text-white">{TOKENS[k].symbol}</span>
              </span>
            </span>
          ))}
        </span>
      </div>
    </>
  );

  return (
    <div className="mx-auto" style={{ maxWidth: showSide ? '880px' : '480px' }}>
      {isConnected && <PendingTransfers address={address} onChanged={refresh} />}
      <div className="d-flex flex-column flex-lg-row gap-4 align-items-lg-stretch">
      <div
        className="w-100 flex-shrink-0"
        style={{
          maxWidth: '480px',
          background: 'linear-gradient(160deg, rgba(139,92,246,0.16), rgba(18,14,31,0.9) 45%)',
          border: '1px solid rgba(139,92,246,0.5)',
          borderRadius: '24px',
          boxShadow: '0 0 40px rgba(139,92,246,0.2)',
          padding: '20px',
        }}
      >
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <div className="fw-bold text-white" style={{ fontSize: '1.25rem' }}>Swap</div>
            <div className="small text-white-50">VUSD ⇄ USDT at 1:1</div>
          </div>
        </div>

        <Panel
          label="From"
          token={from}
          balance={fromBal}
          connected={isConnected}
          onPick={() => setPicker('from')}
          footer={
            isConnected && fromBal.raw !== null && (
              <div className="d-flex justify-content-end gap-2 mt-2">
                {[25, 50, 75, 100].map((p) => (
                  <button key={p} type="button" className="btn btn-sm py-0 px-2" onClick={() => setPct(p)} style={{ color: LAVENDER, border: '1px solid rgba(139,92,246,0.45)', borderRadius: '999px', fontSize: '0.75rem' }}>
                    {p === 100 ? 'MAX' : `${p}%`}
                  </button>
                ))}
              </div>
            )
          }
        >
          <input
            inputMode={crossChain ? 'numeric' : 'decimal'}
            autoComplete="off"
            placeholder={crossChain ? '0' : '0.0'}
            aria-label={`Amount of ${from.symbol} to swap`}
            value={amount}
            onChange={(e) => setAmount(sanitize(e.target.value, crossChain))}
            style={inputStyle}
          />
        </Panel>

        <div className="d-flex justify-content-center" style={{ margin: '-10px 0', position: 'relative', zIndex: 1 }}>
          <button
            type="button"
            onClick={flip}
            aria-label="Switch direction"
            className="btn d-flex align-items-center justify-content-center"
            style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1b1530', border: '3px solid #120e1f', color: LAVENDER, fontSize: '1.1rem', padding: 0 }}
          >
            ⇅
          </button>
        </div>

        <Panel label="To" token={to} balance={balances[toKey]} connected={isConnected} onPick={() => setPicker('to')}>
          <div style={{ ...inputStyle, color: hasAmount ? '#fff' : 'rgba(255,255,255,0.35)' }} aria-live="polite">
            {hasAmount && amountWei > 0n ? fmtUnits(receiveWei) : '0.0'}
          </div>
        </Panel>

        <div className={`mt-3 px-1${showSide ? ' d-lg-none' : ''}`}>
          {details}
          {showSide && (
            <Checklist pre={pre} error={preError} className="d-lg-none mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
          )}
        </div>

        <div className="mt-3">{cta}</div>

        <p className="small text-white-50 mt-3 mb-0" style={{ textWrap: 'pretty' }}>
          {crossChain
            ? fromKey === 'USDT_BSC'
              ? 'Crosses chains through the USDT bridge (1% fee on the way in). You confirm on BNB Chain only and need BNB for gas; the bridge delivers the VUSD on Vitruveo.'
              : 'Crosses chains through the USDT bridge. You confirm once on Vitruveo and need VTRU for gas; the bridge delivers the USDT on BNB Chain.'
            : `Single chain on Vitruveo. You need VTRU for gas.`}
        </p>
      </div>

      {showSide && (
        <div
          className="d-none d-lg-flex flex-column flex-grow-1 p-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '20px' }}
        >
          <Checklist pre={pre} error={preError} />
          <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>{details}</div>
        </div>
      )}
      </div>

      {picker && (
        <TokenPicker
          side={picker}
          current={picker === 'from' ? fromKey : toKey}
          balances={balances}
          connected={isConnected}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}

      {run?.phase === 'confirm' && (
        <Modal title="Confirm Swap" onClose={() => setRun(null)}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="d-flex align-items-center gap-2"><TokenIcon token={runFrom} size={28} /><span className="text-white fw-bold fs-5" style={{ fontVariantNumeric: 'tabular-nums' }}>{run.amount}</span></span>
            <span className="text-white-50 small">{runFrom.symbol} · {runFrom.chain}</span>
          </div>
          <div className="text-white-50 ms-2 mb-2" aria-hidden="true">↓</div>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <span className="d-flex align-items-center gap-2"><TokenIcon token={runTo} size={28} /><span className="text-white fw-bold fs-5" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUnits(run.receiveWei)}</span></span>
            <span className="text-white-50 small">{runTo.symbol} · {runTo.chain}</span>
          </div>
          <div className="small text-white-50 mb-2">Steps</div>
          <StepList steps={run.steps} progress={run.progress} />
          <button type="button" className="btn btn-signal w-100 py-3 mt-4" disabled={!checklistPass} onClick={() => execute(0)}>Confirm Swap</button>
        </Modal>
      )}

      {run && run.phase !== 'confirm' && (
        <Modal
          title={run.phase === 'done' ? 'Swap complete' : run.phase === 'error' ? 'Swap interrupted' : 'Swapping…'}
          onClose={run.phase === 'running' ? null : () => setRun(null)}
        >
          <StepList steps={run.steps} progress={run.progress} />
          {run.phase === 'running' && status && <div className="small mt-3" style={{ color: LAVENDER }} role="status">{status}</div>}
          {run.phase === 'error' && (
            <>
              <div className="small text-danger mt-3" role="alert">{run.error}</div>
              <button type="button" className="btn btn-signal w-100 py-3 mt-3" onClick={() => execute(run.failedAt)}>Try again</button>
            </>
          )}
          {run.phase === 'done' && (
            <>
              <div className="text-white mt-3">
                Received {fmtUnits(run.received)} {runTo.symbol} on {runTo.chain}
.
              </div>
              <button type="button" className="btn btn-signal w-100 py-3 mt-3" onClick={() => setRun(null)}>Close</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

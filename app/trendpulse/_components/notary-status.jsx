'use client';

import { useEffect, useState } from 'react';
import { TRENDPULSE_BASE } from '../../config/trendpulse';
import { BUCKET_NAMES, BUCKET_COLORS } from '../../markets/_lib/gamemath';

const REFRESH_MS = 10_000;
const EXPLORER = 'https://explorer.vitruveo.ai';
const NAMES = { 'pumpfun-5': 'pump.fun 5', 'bitcoin-15': 'Bitcoin 15' };

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
const fmtTime = (s) => new Date(s * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const ago = (s) => (s == null ? '—' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);

// The Notary settles Pretrend markets on Vitruveo: it resolves every ended window that had buys, or voids it
// when the oracle recorded too few points. Status comes from TrendPulse's /notary endpoint.
export function NotaryStatus() {
  const [st, setSt] = useState(null); // null = connecting, false = unreachable

  useEffect(() => {
    if (!TRENDPULSE_BASE) return undefined;
    let stop = false;
    const load = () =>
      fetch(`${TRENDPULSE_BASE}/notary`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (!stop) setSt(d && d.service === 'notary' ? d : false); })
        .catch(() => { if (!stop) setSt(false); });
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { stop = true; clearInterval(t); };
  }, []);

  if (!TRENDPULSE_BASE) return null;

  const led = st === null ? 'amber' : st && st.ok ? 'green' : 'red';
  let text = 'Connecting to the Notary…';
  if (st === false) text = 'Notary unreachable';
  else if (st && st.ok) text = 'Notary is live — settling markets on Vitruveo';
  else if (st) {
    if (!st.enabled) text = 'Notary disabled';
    else if (st.isNotary === false) text = 'Notary wallet lacks the notary role';
    else if (st.pollAgeSeconds == null || st.pollAgeSeconds > 60) text = 'Notary stalled — no recent poll';
    else if (st.lowGas) text = 'Notary degraded — VTRU gas balance low';
    else if (st.overdue && st.overdue.length) text = `Notary degraded — ${st.overdue.length} market(s) overdue for settlement`;
    else text = 'Notary degraded';
  }

  const markets = st && st.markets ? Object.entries(st.markets) : [];
  const recent = st && st.recent ? st.recent.slice(0, 8) : [];

  return (
    <div className="card-dark p-3 p-md-4 mb-4">
      <div className="d-flex align-items-center gap-3 mb-3">
        <span className={`tp-led ${led}`} aria-hidden="true" />
        <span className="text-white fw-bold">{text}</span>
      </div>
      <div className="row g-4">
        <div className="col-md-5">
          <dl className="tps-info-meta">
            <dt>Wallet</dt>
            <dd>{st && st.address ? <a href={`${EXPLORER}/address/${st.address}`} target="_blank" rel="noreferrer">{short(st.address)}</a> : '—'}</dd>
            <dt>Contract</dt>
            <dd>{st && st.contract ? <a href={`${EXPLORER}/address/${st.contract}`} target="_blank" rel="noreferrer">{short(st.contract)}</a> : '—'}</dd>
            <dt>Gas</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{st && st.balanceVtru != null ? `${Number(st.balanceVtru).toFixed(2)} VTRU` : '—'}</dd>
            <dt>Last poll</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{st ? ago(st.pollAgeSeconds) : '—'}</dd>
            <dt>Settled</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{st && st.totals ? `${st.totals.resolved} resolved, ${st.totals.voided} voided` : '—'}</dd>
            <dt>Paid out</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums' }}>{st && st.totals && st.totals.paidVusd != null ? `${Number(st.totals.paidVusd).toFixed(2)} VUSD to ${st.totals.payouts} wallet${st.totals.payouts === 1 ? '' : 's'}` : '—'}</dd>
            {markets.map(([slug, m]) => (
              <span key={slug} style={{ display: 'contents' }}>
                <dt>{NAMES[slug] || slug}</dt>
                <dd style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {m.pending && m.pending.length ? `${m.pending.length} awaiting settlement` : 'up to date'}
                  {m.lastSettled ? `, last ${fmtTime(m.lastSettled)}` : ''}
                </dd>
              </span>
            ))}
          </dl>
          {st && st.lastError && (
            <p className="small mb-0 mt-2" style={{ color: '#f97316' }}>
              Last error{st.lastErrorAt ? ` (${fmtTime(st.lastErrorAt)})` : ''}: {st.lastError}
            </p>
          )}
        </div>
        <div className="col-md-7">
          <div className="small text-muted-custom mb-2">Recent settlements</div>
          {!recent.length ? (
            <p className="text-muted-custom small mb-0">No markets with buys have settled yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-sm small mb-0" style={{ fontVariantNumeric: 'tabular-nums', background: 'transparent' }}>
                <thead>
                  <tr><th>Market</th><th>Window</th><th>Result</th><th className="text-end">Pool</th><th className="text-end">Tx</th></tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={`${r.slug}-${r.start}-${r.action}-${r.tx}`}>
                      <td>{NAMES[r.slug] || r.slug}</td>
                      <td>{fmtTime(r.start)}</td>
                      <td>
                        {r.action === 'void'
                          ? <span style={{ color: '#a3a3a3' }}>Void ({r.points} pts)</span>
                          : r.action === 'payout'
                            ? <span style={{ color: '#4ade80' }}>Paid {r.accounts} wallet{r.accounts === 1 ? '' : 's'}</span>
                            : <span style={{ color: BUCKET_COLORS[r.winner] }}>{BUCKET_NAMES[r.winner] ?? '—'}</span>}
                      </td>
                      <td className="text-end">{r.action === 'payout' ? `${Number(r.paid).toFixed(2)} VUSD` : r.total != null ? `${Number(r.total).toFixed(2)} VUSD` : '—'}</td>
                      <td className="text-end">{r.tx ? <a href={`${EXPLORER}/tx/${r.tx}`} target="_blank" rel="noreferrer">{short(r.tx)}</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

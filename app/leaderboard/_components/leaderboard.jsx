'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { EXPLORER } from '../../config/pretrend-markets';

const MARKETS = [['all', 'All markets'], ['pumpfun-5', 'pump.fun 5'], ['bitcoin-15', 'Bitcoin 15']];
const PERIODS = [['24h', '24 hours'], ['7d', '7 days'], ['all', 'All time']];
const REFRESH_MS = 30_000;

const usd = (v) => (v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const signed = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${usd(v)}`);
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const mult = (v) => (v == null ? '—' : `${v.toFixed(2)}x`);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const COLS = [
  { key: 'buy', label: 'Buy amount', fmt: usd },
  { key: 'win', label: 'Win amount', fmt: usd },
  { key: 'markets', label: 'Markets', fmt: String },
  { key: 'won', label: 'Won', fmt: String },
  { key: 'lost', label: 'Lost', fmt: String },
  { key: 'net', label: 'Net', fmt: signed, color: (v) => (v > 0 ? '#4ade80' : v < 0 ? '#f87171' : undefined) },
  { key: 'fees', label: 'Fees', fmt: usd },
  { key: 'winRate', label: 'Win rate', fmt: pct },
  { key: 'roi', label: 'ROI', fmt: pct, color: (v) => (v > 0 ? '#4ade80' : v < 0 ? '#f87171' : undefined) },
  { key: 'best', label: 'Best', fmt: mult },
  { key: 'refunded', label: 'Refunded', fmt: usd },
  { key: 'unclaimed', label: 'Unclaimed', fmt: usd },
];

function Pills({ options, value, onChange }) {
  return (
    <div className="d-flex gap-1 flex-wrap">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className="btn btn-sm"
          style={{
            border: `1px solid ${value === k ? '#2f8fd6' : 'rgba(255,255,255,0.15)'}`,
            background: value === k ? 'rgba(47,143,214,0.2)' : 'transparent',
            color: value === k ? '#fff' : '#b9c5da',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Leaderboard() {
  const { address } = useAccount();
  const [market, setMarket] = useState('all');
  const [period, setPeriod] = useState('all');
  const [sort, setSort] = useState({ key: 'net', dir: -1 });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/leaderboard/?market=${market}&period=${period}`, { cache: 'no-store' })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (stop) return;
          if (!ok) setError(d.error || 'Leaderboard unavailable');
          else { setData(d); setError(null); }
        })
        .catch(() => { if (!stop) setError('Leaderboard unavailable'); });
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { stop = true; clearInterval(t); };
  }, [market, period]);

  const rows = useMemo(() => {
    const list = (data?.rows || []).filter((r) => r.markets > 0 || r.inPlay > 0);
    const v = (r) => (r[sort.key] == null ? -Infinity : r[sort.key]);
    return [...list].sort((a, b) => (v(a) === v(b) ? b.buy - a.buy : (v(a) < v(b) ? -1 : 1) * sort.dir));
  }, [data, sort]);

  const me = address ? address.toLowerCase() : null;
  const rankOf = (r) => rows.indexOf(r) + 1;
  const clickSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));

  const renderRow = (r) => (
    <tr key={r.address} style={r.address === me ? { background: 'rgba(47,143,214,0.12)' } : undefined}>
      <td className="ptm-mono">{rankOf(r)}</td>
      <td className="ptm-mono">
        <a href={`${EXPLORER}/address/${r.address}`} target="_blank" rel="noreferrer" style={{ color: 'var(--ptm-ink)', textDecoration: 'underline', textDecorationColor: 'rgba(238,243,251,0.4)', textUnderlineOffset: '3px' }}>{short(r.address)}</a>
        {r.address === me && <span className="ptm-signal ms-2 small">you</span>}
        {r.inPlay > 0 && <span className="ptm-faint ms-2 small">{usd(r.inPlay)} in play</span>}
      </td>
      {COLS.map((c) => (
        <td key={c.key} className="ptm-mono" style={{ textAlign: 'right', color: c.color ? c.color(r[c.key]) : undefined }}>{c.fmt(r[c.key])}</td>
      ))}
    </tr>
  );

  return (
    <div className="ptm">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
        <Pills options={MARKETS} value={market} onChange={setMarket} />
        <Pills options={PERIODS} value={period} onChange={setPeriod} />
      </div>
      <div className="card-dark p-3 p-md-4">
        {error ? (
          <p className="text-danger mb-0">{error}</p>
        ) : !data ? (
          <p className="ptm-faint mb-0">Loading standings…</p>
        ) : !rows.length ? (
          <p className="ptm-faint mb-0">No settled markets with buys yet. Standings appear as soon as the first market with buys settles.</p>
        ) : (
          <div className="table-responsive">
            <table className="ptm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  {COLS.map((c) => (
                    <th key={c.key} style={{ textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => clickSort(c.key)}>
                      {c.label}{sort.key === c.key ? (sort.dir < 0 ? ' ▾' : ' ▴') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => renderRow(r))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-muted-custom small mt-3 mb-0">
        Buy and win amounts are in VUSD over settled markets. Win amount is what winning buckets paid, including the buy
        amount returned. Net is win amount plus refunds, minus buys and fees. Voided markets are refunded and count as
        neither won nor lost. Buys in markets still running show as in play. Click a column to sort.
        {data?.updatedAt ? ` Updated ${new Date(data.updatedAt * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}.` : ''}
      </p>
    </div>
  );
}

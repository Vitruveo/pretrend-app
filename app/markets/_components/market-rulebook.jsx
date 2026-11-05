import { rulesFor } from '../_lib/gamemath';

// The rules of a market as this page runs them. Stakes are not part of the market yet.
export function MarketRulebook({ market }) {
  const rules = rulesFor(market);
  const lockMin = rules.lockS / 60;
  const rows = [
    ['The market', `A new ${market.windowLabel} market opens on every ${market.windowLabel.replace('-min', '-minute')} mark, on the ${market.name.replace(/ \d+$/, '')} pulse from the TrendPulse oracle. Calls close ${Number.isInteger(lockMin) ? `${lockMin} minutes` : `${rules.lockS} seconds`} in; the rest of the window is a locked runout.`],
    ['The call', 'Pick one of five buckets, Crash, Bear, Flat, Bull or Moon, for where the window’s ordinary least squares trend settles. Bucket edges are frozen when the window opens.'],
    ['The answer', `The OLS trend over every point the oracle stored in the window, measured as slope times span: ${market.unitLabel} gained or lost across the window. Spikes pull the line less than they pull the last price.`],
    ['The buckets', 'Edges are quintiles of the trend over recent complete windows (30 or more), recalibrated every 15 minutes, so each bucket wins about one window in five. With fewer windows, the five buckets are equal 20% slices of the trend range seen so far, symmetric about zero. With none, the oracle\u2019s starting edges apply.'],
    ['Voids', 'If the oracle stores too few points for a window, that window is void and has no answer.'],
    ['Stakes', 'None yet. Calls on this page are free and live only in your browser. Staking, settlement and the leaderboard are being designed.'],
  ];
  return (
    <div id="rulebook" className="card-dark p-3 p-md-4 mt-5" style={{ scrollMarginTop: '5.5rem' }}>
      <h2 className="h4 fw-bold mb-3">Rulebook</h2>
      <ol className="mb-0 ps-0" style={{ listStyle: 'none' }}>
        {rows.map(([k, v], i) => (
          <li key={k} className="d-flex gap-3 py-2" style={{ borderTop: i ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
            <span className="ptm-faint ptm-mono" style={{ minWidth: '2rem' }}>{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="ptm-ink" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{k}</span>
              <span className="d-block ptm-dim">{v}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

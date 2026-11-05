'use client';

import { MARKETS } from '../../config/markets';
import { LiveChart } from '../../components/live-chart';
import { useLiveSeries } from './use-live-series';

function ReadOnlyBadge() {
  return (
    <span className="badge rounded-pill ms-2 align-middle" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.08em', fontSize: '0.62rem' }}>
      READ-ONLY
    </span>
  );
}

export function MarketCards() {
  const { series } = useLiveSeries(MARKETS);

  return (
    <div>
      {MARKETS.map((m) => (
        <div key={m.slug} className="card-dark p-3 p-md-4 mb-4">
          {/* chart and description side by side at equal height; the side box clips to the chart's height */}
          <div className="tps-row" style={{ alignItems: 'stretch' }}>
            <div className="tps-chart">
              <LiveChart label={m.windowLabel.toUpperCase()} name={m.name} points={series[m.slug]} unit={m.unit} windowLabel={m.windowLabel} trendMode={m.trendMode} color={m.color} labelColor={m.labelColor} trendColor={m.trendColor} headlineColor={m.headlineColor} />
            </div>
            <div className="tps-info d-flex flex-column" style={{ minHeight: 0, overflow: 'hidden' }}>
              <div className="tps-info-title" style={m.headlineColor ? { color: m.headlineColor } : undefined}>
                {m.headline}{m.readOnly && <ReadOnlyBadge />}
              </div>
              <p className="tps-info-desc mb-0">{m.desc}</p>
            </div>
          </div>
          <a
            href={`/markets/${m.slug}`}
            className="btn btn-signal btn-lg w-100 mt-3"
            style={{ fontSize: '1.35rem', padding: '0.85rem 1rem', letterSpacing: '0.08em' }}
          >
            {m.readOnly ? 'View' : 'Launch'} {m.name} Market
          </a>
        </div>
      ))}
    </div>
  );
}

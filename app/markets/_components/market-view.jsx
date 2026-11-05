'use client';

import { useMemo } from 'react';
import { LiveChart } from '../../components/live-chart';
import { useLiveSeries } from './use-live-series';

// Single-market page body: the live pulse over one market window plus the
// market's parameters. Market mechanics (bucket pricing, positions, settlement)
// are being developed and will land here.
export function MarketView({ market }) {
  const markets = useMemo(() => [market], [market]);
  const { series, health } = useLiveSeries(markets);
  const lag = health && health.sources && health.sources[market.source] ? health.sources[market.source].feedLagSeconds : null;

  return (
    <div>
      <div className="card-dark p-3 p-md-4 mb-4">
        <LiveChart label={market.windowLabel.toUpperCase()} name={market.name} points={series[market.slug]} unit={market.unit} windowLabel={market.windowLabel} trendMode={market.trendMode} color={market.color} labelColor={market.labelColor} trendColor={market.trendColor} headlineColor={market.headlineColor} />
      </div>
      <div className="row g-4">
        <div className="col-md-7">
          <div className="card-dark p-4 h-100">
            <div className="tps-info-title" style={market.headlineColor ? { color: market.headlineColor } : undefined}>About this market</div>
            <p className="tps-info-desc mb-0">{market.desc}</p>
          </div>
        </div>
        <div className="col-md-5">
          <div className="card-dark p-4 h-100">
            <div className="tps-info-title">Parameters</div>
            <dl className="tps-info-meta">
              <dt>Window</dt><dd>{market.windowLabel}</dd>
              <dt>Buckets</dt><dd>five, quintile thresholds</dd>
              <dt>Resolution</dt><dd>OLS trend over the window</dd>
              <dt>Pulse</dt><dd>{market.attribution}</dd>
              <dt>Data</dt><dd>{market.dataCadence}</dd>
              <dt>Mode</dt><dd>{market.readOnly ? 'read-only' : 'open'}</dd>
              <dt>Lag</dt><dd style={{ fontVariantNumeric: 'tabular-nums' }}>{lag != null ? `${Math.max(0, lag)}s` : '—'}</dd>
            </dl>
          </div>
        </div>
      </div>
      <p className="text-muted-custom small text-center mt-4 mb-0">
        Market play on this page is in development. The chart is the live pulse the market resolves on.
      </p>
    </div>
  );
}

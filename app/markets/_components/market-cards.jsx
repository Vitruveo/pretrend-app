'use client';

import { useState } from 'react';
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

function NoFeeBadge() {
  return (
    <span className="badge rounded-pill ms-2 align-middle" style={{ background: 'rgba(122,190,77,0.15)', color: '#7abe4d', fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.8rem', padding: '0.35em 0.8em' }}>
      NO FEE
    </span>
  );
}

// AI Wars Trends runs on epicaiwars.com on the aiwars-momentum pulse; its tile links out.
const AIWARS_TILE = {
  slug: 'aiwars',
  kind: 'game', // tile category; MARKETS' own `game` flag means playable
  name: 'AI Wars Trends',
  headline: 'AI Wars Battle Momentum, 5-minute game',
  source: 'aiwars-momentum',
  unit: 'momentum',
  windowS: 5 * 60,
  windowLabel: '5-min',
  trendMode: 'abs',
  color: '#2f8fd6',
  labelColor: '#8fc6f5',
  trendColor: '#e8c547',
  headlineColor: '#2d8cff',
  desc: 'Battle Momentum from the Fall of Meridian: a 0\u2013100 composite of combat tempo, machine pressure, infrastructure and enemy reinforcement, read every two seconds. Call where the battle trends in AI Wars Trends, the 5-minute game on epicaiwars.com.',
  href: 'https://www.epicaiwars.com/trends',
  cta: 'Play AI Wars Trends',
};
const TILES = [...MARKETS, AIWARS_TILE];

const DURATIONS = [...new Set(TILES.map((m) => m.windowS))].sort((a, b) => a - b);
const minLabel = (sec) => `${sec / 60} min`;

export function MarketCards() {
  const { series } = useLiveSeries(TILES);
  const [dur, setDur] = useState(null);
  const shown = dur ? TILES.filter((m) => m.windowS === dur) : TILES;

  return (
    <>
    <div className="mkt-pills" style={{ marginBottom: '2.25rem' }} role="group" aria-label="Filter markets by duration">
      {[null, ...DURATIONS].map((d) => (
        <button key={d ?? 'all'} type="button" className={`mkt-pill${dur === d ? ' active' : ''}`} aria-pressed={dur === d} onClick={() => setDur(d)}>
          {d ? minLabel(d) : 'All'}
        </button>
      ))}
    </div>
    <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, min(100%, 420px))', justifyContent: 'center', gap: '1.5rem' }}>
      {shown.map((m) => (
        <div key={m.slug}>
          {/* one tile per market, fixed 420x440; blue gradient for games, green for feeds in an auto-flowing grid: chart, then headline and description, then the button */}
          <div className={`card-dark mkt-tile ${m.kind === 'game' ? 'mkt-tile-game' : 'mkt-tile-feed'} p-3 p-md-4 pt-2 pt-md-2 d-flex flex-column position-relative`} style={{ height: 440, overflow: 'hidden' }}>
            <div className="mkt-ribbon">{minLabel(m.windowS)}</div>
            <LiveChart label={m.windowLabel.toUpperCase()} name={m.name} points={series[m.slug]} unit={m.unit} windowLabel={m.windowLabel} trendMode={m.trendMode} color={m.color} labelColor={m.labelColor} trendColor={m.trendColor} headlineColor={m.headlineColor} bare />
            <div className="tps-info-title mt-3" style={m.headlineColor ? { color: m.headlineColor } : undefined}>
              {m.headline}{m.readOnly && <ReadOnlyBadge />}{m.feeFree && <NoFeeBadge />}
            </div>
            <p className="tps-info-desc mb-0" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 6, overflow: 'hidden' }}>{m.desc}</p>
            <div className="mt-auto pt-3">
              <a
                href={m.href || `/markets/${m.slug}`}
                {...(m.href ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="btn btn-signal btn-lg w-100"
                style={{ fontSize: '1.2rem', padding: '0.8rem 1rem', letterSpacing: '0.08em' }}
              >
                {m.cta && m.href ? m.cta : `${m.readOnly ? 'View' : 'Launch'} ${m.name} Market`}
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
    </>
  );
}

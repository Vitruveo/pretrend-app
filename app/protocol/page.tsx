import type { Metadata } from "next";
import Header from '../components/Header';
import Footer from '../components/Footer';
import DomainCarousel from '../components/DomainCarousel';
import IntersectionSphere from '../components/IntersectionSphere';
import HeroBackground from '../components/HeroBackground';
import { AnimatedBuckets, CountUp } from '../visuals';

export const metadata: Metadata = {
  title: "Protocol | Pretrend",
  description: "Pretrend is a trend-based oracle protocol enabling prediction markets to resolve based on directional movement rather than binary outcomes. Native on-chain statistical computation on the Vitruveo blockchain.",
};

const TrendLineSVG = () => (
  <svg viewBox="0 0 800 200" style={{ width: '100%', height: 'auto' }}>
    <defs>
      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7abe4d" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#7abe4d" stopOpacity="0"/>
      </linearGradient>
    </defs>
    {/* Grid lines */}
    {[40, 80, 120, 160].map(y => (
      <line key={y} x1="60" y1={y} x2="760" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
    ))}
    {/* Noisy data points */}
    <polyline
      points="80,140 120,135 160,125 200,130 240,110 280,115 320,95 360,100 400,85 440,90 480,70 520,75 540,65 580,72 620,55 660,60 700,45 740,50"
      fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
    {/* Data dots */}
    {[[80,140],[120,135],[160,125],[200,130],[240,110],[280,115],[320,95],[360,100],[400,85],[440,90],[480,70],[520,75],[540,65],[580,72],[620,55],[660,60],[700,45],[740,50]].map(([x,y], i) => (
      <circle key={i} cx={x} cy={y} r="3" fill="rgba(255,255,255,0.3)"/>
    ))}
    {/* OLS trend line */}
    <line x1="80" y1="145" x2="740" y2="42" stroke="#7abe4d" strokeWidth="2.5" strokeDasharray="8,4"/>
    {/* Trend fill area */}
    <polygon points="80,145 740,42 740,200 80,200" fill="url(#trendFill)"/>
    {/* Labels */}
    <text x="400" y="25" textAnchor="middle" fill="#7abe4d" fontSize="13" fontWeight="600">OLS REGRESSION: +5.8% SLOPE</text>
    <text x="60" y="185" fill="rgba(255,255,255,0.3)" fontSize="10">t₀</text>
    <text x="740" y="185" fill="rgba(255,255,255,0.3)" fontSize="10">t₁</text>
  </svg>
);

const BucketDistributionSVG = () => (
  <svg viewBox="0 0 800 220" style={{ width: '100%', height: 'auto' }}>
    {/* Bucket bars */}
    {[
      { x: 80, label: 'CRASH', color: '#ef4444', height: 60, pct: '< -8.2%' },
      { x: 220, label: 'BEAR', color: '#f97316', height: 90, pct: '-8.2% to -2.1%' },
      { x: 360, label: 'FLAT', color: '#a3a3a3', height: 120, pct: '-2.1% to +2.3%' },
      { x: 500, label: 'BULL', color: '#4ade80', height: 100, pct: '+2.3% to +9.1%' },
      { x: 640, label: 'MOON', color: '#8b5cf6', height: 50, pct: '> +9.1%' },
    ].map((b) => (
      <g key={b.label}>
        <rect x={b.x} y={180 - b.height} width="80" height={b.height} rx="4"
              fill={b.color} opacity="0.25" stroke={b.color} strokeWidth="1"/>
        <rect x={b.x} y={180 - b.height} width="80" height="4" rx="2" fill={b.color}/>
        <text x={b.x + 40} y={195} textAnchor="middle" fill={b.color} fontSize="12" fontWeight="600">{b.label}</text>
        <text x={b.x + 40} y={210} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">{b.pct}</text>
        {/* Unit count inside bar */}
        <text x={b.x + 40} y={180 - b.height + 20} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">
          {b.height * 10} units
        </text>
      </g>
    ))}
    {/* Title */}
    <text x="400" y="25" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="13" fontWeight="600">OUTCOME BUCKET DISTRIBUTION</text>
    {/* Winning indicator */}
    <text x="540" y="60" textAnchor="middle" fill="#4ade80" fontSize="11" fontWeight="600">WINNER</text>
    <polygon points="540,65 535,72 545,72" fill="#4ade80"/>
  </svg>
);

const TimeslopeSVG = () => (
  <svg viewBox="0 0 400 250" style={{ width: '100%', height: 'auto' }}>
    <defs>
      <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7abe4d" stopOpacity="0.2"/>
        <stop offset="100%" stopColor="#7abe4d" stopOpacity="0"/>
      </linearGradient>
    </defs>
    {/* Grid */}
    {[60, 100, 140, 180].map(y => (
      <line key={y} x1="50" y1={y} x2="370" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
    ))}
    {/* Time drift: every bucket climbs 10c -> $1.00 by the 80% close */}
    <line x1="50" y1="210" x2="330" y2="30" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeDasharray="5 4"/>
    {/* Demand-accelerated bucket: ahead of the clock */}
    <path d="M50,210 C120,175 170,140 230,85 Q290,38 330,30"
          fill="none" stroke="#7abe4d" strokeWidth="2.5"/>
    <path d="M50,210 C120,175 170,140 230,85 Q290,38 330,30 L330,220 L50,220 Z"
          fill="url(#curveFill)"/>
    {/* Close marker */}
    <line x1="330" y1="25" x2="330" y2="220" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="3 4"/>
    <text x="330" y="18" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9">$1.00 · CLOSE (80%)</text>
    {/* Buyer markers */}
    <circle cx="70" cy="200" r="5" fill="#4ade80"/>
    <text x="70" y="234" textAnchor="middle" fill="#4ade80" fontSize="9">$0.13</text>
    <circle cx="180" cy="130" r="5" fill="#fbbf24"/>
    <text x="180" y="234" textAnchor="middle" fill="#fbbf24" fontSize="9">$0.48</text>
    <circle cx="280" cy="55" r="5" fill="#f97316"/>
    <text x="280" y="234" textAnchor="middle" fill="#f97316" fontSize="9">$0.88</text>
    {/* Axes */}
    <text x="20" y="135" fill="rgba(255,255,255,0.4)" fontSize="9" transform="rotate(-90,20,135)">PRICE</text>
    <text x="210" y="248" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9">TIME + DEMAND</text>
  </svg>
);

const YesMark = () => (
  <span
    className="d-inline-flex align-items-center justify-content-center rounded-circle"
    style={{ width: '26px', height: '26px', background: 'rgba(122,190,77,0.15)', border: '1px solid #7abe4d' }}
    aria-label="Yes"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3d97a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  </span>
);

const NoMark = () => <span className="text-white-50" aria-label="No">—</span>;

const InProgressBadge = () => (
  <div
    className="position-relative d-inline-flex align-items-center justify-content-center"
    style={{ width: '120px', height: '120px' }}
    aria-label="In progress"
  >
    <svg className="vf-spin position-absolute" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#7abe4d" strokeOpacity="0.45" strokeWidth="1.1">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
    <svg className="vf-flip" width="52" height="52" viewBox="0 0 24 24">
      <rect x="5" y="2" width="14" height="1.6" rx="0.8" fill="#a3d97a" />
      <rect x="5" y="20.4" width="14" height="1.6" rx="0.8" fill="#a3d97a" />
      <path d="M7 3.6h10v1.9c0 3-3.5 4.5-5 6.5-1.5-2-5-3.5-5-6.5z" fill="rgba(163,217,122,0.55)" />
      <path d="M7 20.4h10v-1.9c0-3-3.5-4.5-5-6.5-1.5 2-5 3.5-5 6.5z" fill="rgba(163,217,122,0.55)" />
    </svg>
  </div>
);

const ReachSVG = () => (
  <svg viewBox="0 0 800 360" style={{ width: '100%', height: 'auto' }}>
    <defs>
      <linearGradient id="reachGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#7abe4d" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#a3d97a" stopOpacity="0.25" />
      </linearGradient>
    </defs>
    {[[150, 70], [650, 70], [150, 290], [650, 290]].map(([x, y], i) => (
      <line key={i} x1="400" y1="180" x2={x} y2={y} stroke="#7abe4d" strokeWidth="1.5" strokeOpacity="0.4" />
    ))}
    {[
      { x: 60, y: 40, t: 'Primary Marketplace' },
      { x: 560, y: 40, t: 'White-Label Partners' },
      { x: 60, y: 260, t: 'Open-Source Builders' },
      { x: 560, y: 260, t: 'BSC & EVM Chains' },
    ].map((n, i) => (
      <g key={i}>
        <rect x={n.x} y={n.y} width="180" height="60" rx="10" fill="#15211a" stroke="#7abe4d" strokeWidth="1" />
        <text x={n.x + 90} y={n.y + 35} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="13" fontWeight="600">{n.t}</text>
      </g>
    ))}
    <rect x="300" y="140" width="200" height="80" rx="14" fill="#1b2a20" stroke="#a3d97a" strokeWidth="1.5" />
    <text x="400" y="172" textAnchor="middle" fill="#a3d97a" fontSize="15" fontWeight="700">PRETREND ORACLE</text>
    <text x="400" y="194" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="12">on Vitruveo</text>
  </svg>
);

const VirtuousCircleSVG = () => (
  <svg viewBox="0 0 800 500" style={{ width: '100%', height: 'auto', display: 'block' }}>
    <defs>
      <marker id="vcArrow" markerWidth="9" markerHeight="8" refX="6" refY="4" orient="auto">
        <polygon points="0 0, 9 4, 0 8" fill="#7abe4d" />
      </marker>
    </defs>

    {/* rotating flywheel ring */}
    <circle className="vf-dash" cx="400" cy="250" r="150" fill="none" stroke="#7abe4d" strokeOpacity="0.2" strokeWidth="2.5" strokeDasharray="6 14" />

    {/* clockwise flow arrows */}
    <path d="M500.7 100.8 A180 180 0 0 1 549.2 149.3" fill="none" stroke="#7abe4d" strokeWidth="3" markerEnd="url(#vcArrow)" />
    <path d="M549.2 350.7 A180 180 0 0 1 500.7 399.2" fill="none" stroke="#7abe4d" strokeWidth="3" markerEnd="url(#vcArrow)" />
    <path d="M299.3 399.2 A180 180 0 0 1 250.8 350.7" fill="none" stroke="#7abe4d" strokeWidth="3" markerEnd="url(#vcArrow)" />
    <path d="M250.8 149.3 A180 180 0 0 1 299.3 100.8" fill="none" stroke="#7abe4d" strokeWidth="3" markerEnd="url(#vcArrow)" />

    {/* nodes */}
    <rect x="305" y="39" width="190" height="62" rx="12" fill="#15211a" stroke="#7abe4d" strokeWidth="1.2" />
    <text x="400" y="76" textAnchor="middle" fill="#a3d97a" fontSize="19" fontWeight="600">Pretrend grows</text>

    <rect x="485" y="219" width="190" height="62" rx="12" fill="#15211a" stroke="#7abe4d" strokeWidth="1.2" />
    <text x="580" y="256" textAnchor="middle" fill="#a3d97a" fontSize="19" fontWeight="600">VTRU strengthens</text>

    <rect x="280" y="399" width="240" height="62" rx="12" fill="#15211a" stroke="#7abe4d" strokeWidth="1.2" />
    <text x="400" y="436" textAnchor="middle" fill="#a3d97a" fontSize="19" fontWeight="600">Vitruveo ecosystem grows</text>

    <rect x="125" y="219" width="190" height="62" rx="12" fill="#15211a" stroke="#7abe4d" strokeWidth="1.2" />
    <text x="220" y="256" textAnchor="middle" fill="#a3d97a" fontSize="19" fontWeight="600">VIBE holders earn</text>

    {/* center split */}
    <text x="400" y="240" textAnchor="middle" fill="#7abe4d" fontSize="44" fontWeight="700">2%</text>
    <text x="400" y="263" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="14">of Pretrend revenue</text>
    <text x="400" y="286" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="14">1% → VTRU liquidity</text>
    <text x="400" y="307" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="14">1% → VIBE holders</text>
  </svg>
);

export default function ProtocolPage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="section-padding bg-dark-custom position-relative" style={{ paddingTop: '140px' }}>
          <HeroBackground />
          <div className="container position-relative" style={{ zIndex: 1 }}>
            <div className="text-center">
              <h1 className="display-4 fw-bold mb-3">
                <span className="text-gradient">Pretrend</span> Protocol
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '800px', margin: '0 auto', fontSize: '1.4rem' }}>
                Continuous trend resolution for prediction markets. Users predict the
                magnitude and direction of change — not just whether an event occurs.
              </p>
              <p className="text-white-50 mt-3">Version 2.0</p>
              <div className="mt-5 mx-auto" style={{ maxWidth: '820px' }}>
                <video
                  src="/videos/pretrend-intro.mp4"
                  poster="/videos/pretrend-intro.jpg"
                  controls
                  playsInline
                  preload="metadata"
                  className="w-100 d-block"
                  style={{ aspectRatio: '16 / 9', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', background: '#000' }}
                  aria-label="Pretrend introduction video"
                />
              </div>
              <div className="mt-5">
                <DomainCarousel />
              </div>
              <div className="d-flex justify-content-center gap-3 flex-wrap mt-5">
                <a href="/whitepaper" className="btn btn-outline-light btn-lg px-5">
                  Read the Whitepaper
                </a>
                <a href="https://www.epicaiwars.com/trends" className="btn btn-signal btn-lg px-5">
                  AIWars Trends
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* About (merged from the former /about page) */}
        <section id="about" className="section-padding bg-dark-alt">
          <div className="container">
            <div className="row g-4 justify-content-center">
              <div className="col-lg-10">
                <div className="row g-4">
                  <div className="col-md-6">
                    <h2 className="h4 text-green mb-3">What it does</h2>
                    <p className="text-muted-custom mb-0">
                      A Pretrend market asks how much something will move, not whether it will.
                      Prices from a live feed are sampled over a fixed window, a trend line is fit
                      across the whole window, and the slope lands in one of five graded outcome
                      buckets. The computation runs inside the chain through the Trend precompile,
                      so settlement is deterministic and verifiable by anyone.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <h2 className="h4 text-green mb-3">Who builds it</h2>
                    <p className="text-muted-custom mb-0">
                      Pretrend is developed by{' '}
                      <a href="https://www.verticalfoundation.net" target="_blank" rel="noopener noreferrer" className="text-green text-decoration-none">
                        Vertical Foundation
                      </a>{' '}
                      as part of the Vitruveo ecosystem. The statistical engine ships inside the
                      Vitruveo protocol itself; TrendPulse, the oracle, publishes the feeds; and
                      AIWars Trends is the first game built on top of them.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Vision */}
        <section id="vision" className="section-padding bg-dark-custom">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="display-6 fw-bold mb-4">Vision</h2>
              <p className="h4 fw-semibold" style={{ maxWidth: '780px', margin: '0 auto', lineHeight: 1.5 }}>
                The <span className="text-gradient">flagship application</span> of the
                Vitruveo ecosystem — backed all the way by Vertical Foundation
              </p>
            </div>

            <div style={{ maxWidth: '820px', margin: '0 auto' }}>
              <p className="text-muted-custom mb-4">
                Pretrend&apos;s statistical engine ships inside the Vitruveo protocol itself —
                compiled Go running at the client layer, not contract bytecode. That depth of
                integration is deliberate: Vertical Foundation is all-in on making Pretrend
                the defining application of the ecosystem, with VTRU as its primary currency.
              </p>
              <p className="text-muted-custom mb-0">
                Polymarket proved the appetite. Pretrend isn&apos;t competing for that
                audience — it&apos;s building the layer beneath: an oracle, an unbiased and
                verifiable source of truth that any marketplace can resolve against. With the
                Pretrend contracts and the Trend Market Starter Kit, launching a trend market
                for your own community becomes a weekend project, not a venture.
              </p>
            </div>
          </div>
        </section>

        {/* TrendPlay */}
        <section id="aiwars-trends" className="section-padding bg-dark-custom">
          <div className="container">
            <div className="row align-items-center g-5">
              <div className="col-lg-6">
                <a href="https://www.epicaiwars.com/trends">
                  <img
                    src="/images/trendplay.png"
                    alt="AIWars Trends gameplay: aiming a trend line at the five outcome buckets"
                    style={{ width: '100%', height: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </a>
              </div>
              <div className="col-lg-6">
                <h2 className="display-6 fw-bold mb-3">
                  Feel the Trend &mdash; Play <span style={{ color: '#2d8cff' }}>AIWars Trends</span>
                </h2>
                <p className="text-muted-custom mb-4">
                  AIWars Trends turns Pretrend&apos;s resolution engine into a live 5-minute game
                  on AI Wars Battle Momentum: aim your line at Crash through Moon as the
                  telemetry streams in &mdash; the earlier you call it, the more points a win pays.
                </p>
                <a href="https://www.epicaiwars.com/trends" className="btn btn-signal btn-lg">
                  AIWars Trends
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The Intersection */}
        <section id="intersection" className="section-padding bg-dark-custom position-relative">
          <div className="intersection-bg" aria-hidden="true" />
          <div className="container position-relative" style={{ zIndex: 1 }}>
            <div className="text-center mb-5">
              <h2 className="display-6 fw-bold mb-3">Three Worlds, One Point</h2>
              <p className="text-muted-custom" style={{ maxWidth: '720px', margin: '0 auto' }}>
                Pretrend sits at the intersection of blockchain, artificial intelligence,
                and the humanities.
              </p>
            </div>
            <div className="row justify-content-center mb-5">
              <div className="col-lg-9">
                <IntersectionSphere />
              </div>
            </div>
            <div style={{ maxWidth: '820px', margin: '0 auto' }}>
              <p className="text-muted-custom mb-4">
                Blockchain is the truth axis. Vitruveo computes every trend natively and
                settles every market on-chain, so no participant has to take anyone&apos;s
                word for an outcome — they can verify it.
              </p>
              <p className="text-muted-custom mb-4">
                Artificial intelligence is the scale axis. The AI Notary watches data
                sources around the clock, explains why probabilities are shifting, and
                helps anyone design a well-calibrated market — work that once took a
                trading desk.
              </p>
              <p className="text-muted-custom mb-4">
                The humanities are the meaning axis. Markets are only interesting when
                they&apos;re about what people care about — music, movies, elections,
                culture, attention. Pretrend turns collective human judgment about those
                things into a measurable, tradable signal.
              </p>
              <p className="text-muted-custom mb-0">
                Vitruveo takes its name from Vitruvius, whose ideas Leonardo drew as a
                human figure inscribed in a circle — humanity at the center of geometry.
                Pretrend keeps that arrangement: the person stays in the middle; the
                mathematics surrounds them.
              </p>
            </div>
          </div>
        </section>

        {/* Pretrend Roadmap */}
        <section id="roadmap" className="section-padding bg-dark-alt">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="display-6 fw-bold mb-3">2026 Roadmap</h2>
              <p className="text-muted-custom" style={{ maxWidth: '700px', margin: '0 auto' }}>
                The path to a live Pretrend oracle — quarter by quarter through 2026.
              </p>
            </div>

            <div className="row g-4">
              {[
                {
                  q: 'Q1 2026',
                  title: 'Shanghai Upgrade & Protocol Contracts',
                  desc: 'Upgrade protocol to Shanghai, remove legacy features and revise tokenomics.',
                  href: 'https://explorer.vitruveo.ai',
                  cta: 'View Explorer',
                  done: true,
                  inProgress: false,
                },
                {
                  q: 'Q2 2026',
                  title: 'On-Chain Trend Algorithm',
                  desc: 'Implement algorithms needed for Pretrend into the protocol as built-in smart contracts and deploy.',
                  href: '/examples',
                  cta: 'Try it out',
                  done: true,
                  inProgress: false,
                },
                {
                  q: 'Q3 2026',
                  title: 'Smart Contracts',
                  desc: 'Develop and deploy the smart contracts that implement the Pretrend protocol.',
                  href: null,
                  cta: null,
                  done: true,
                  inProgress: false,
                },
                {
                  q: 'Q4 2026',
                  title: 'Oracle & Launch',
                  desc: 'Complete development of Pretrend and launch the oracle alongside the reference site.',
                  href: null,
                  cta: null,
                  done: true,
                  inProgress: false,
                },
              ].map((item, i, arr) => (
                <div key={item.q} className="col-lg-3 col-md-6">
                  {/* timeline marker with vertically-centered connecting line */}
                  <div className="position-relative d-flex justify-content-center mb-3" style={{ height: '56px' }}>
                    <div
                      className="d-none d-lg-block position-absolute"
                      style={{
                        top: '50%',
                        left: i === 0 ? '50%' : '-12px',
                        right: i === arr.length - 1 ? '50%' : '-12px',
                        height: '2px',
                        transform: 'translateY(-50%)',
                        background: 'linear-gradient(90deg, rgba(122,190,77,0.4), rgba(122,190,77,0.6))',
                        zIndex: 0,
                      }}
                    />
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        width: '56px',
                        height: '56px',
                        background: 'var(--vf-dark-alt)',
                        border: '2px solid #7abe4d',
                        color: '#a3d97a',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <div className="card-dark p-4 h-100 text-center d-flex flex-column">
                    <div>
                      <div
                        className="d-inline-block px-3 py-1 rounded-pill mb-3"
                        style={{ background: 'rgba(122,190,77,0.12)', border: '1px solid rgba(122,190,77,0.35)' }}
                      >
                        <span className="text-green fw-semibold small">{item.q}</span>
                      </div>
                      <h3 className="h5 text-white mb-3">{item.title}</h3>
                      <p className="text-muted-custom small mb-3">{item.desc}</p>
                      {item.href && (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green small text-decoration-none fw-semibold"
                        >
                          {item.cta} &rarr;
                        </a>
                      )}
                    </div>
                    {item.done && (
                      <div className="mt-auto pt-4">
                        <span
                          className="d-inline-flex align-items-center justify-content-center rounded-circle vf-pulse"
                          style={{ width: '128px', height: '128px', background: '#4ade80' }}
                          aria-label="Complete"
                        >
                          <svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="#0a0f0a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      </div>
                    )}
                    {item.inProgress && (
                      <div className="mt-auto pt-4">
                        <InProgressBadge />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Problem & Solution */}
        <section className="section-padding bg-dark-custom">
          <div className="container">
            <div className="card-dark p-4 mb-5">
              <TrendLineSVG />
            </div>
            <div className="row mb-5">
              <div className="col-lg-6 mb-4 mb-lg-0">
                <h2 className="h3 text-green mb-4">The Problem with Binary Markets</h2>
                <p className="text-muted-custom mb-3">
                  Current prediction markets force complex, continuous phenomena into binary
                  outcomes. A market asking whether Bitcoin will reach $100,000 by a certain date
                  loses all nuance about price movement.
                </p>
                <p className="text-muted-custom mb-3">
                  If Bitcoin rises from $60,000 to $99,000, participants who bet on growth receive
                  nothing — despite being directionally correct. Markets can&apos;t capture the magnitude
                  of movement, only whether a threshold was crossed.
                </p>
                <p className="text-muted-custom">
                  Setting thresholds is arbitrary and can make markets unbalanced from inception.
                  Near-miss outcomes feel punitive to participants who correctly predicted direction
                  but not exact magnitude.
                </p>
              </div>
              <div className="col-lg-6">
                <h2 className="h3 text-green mb-4">The Trend Alternative</h2>
                <p className="text-muted-custom mb-3">
                  Real-world data moves continuously. Prices drift, metrics fluctuate, engagement
                  rises and falls. A prediction system that captures directional movement and
                  magnitude provides richer market dynamics and fairer outcomes.
                </p>
                <p className="text-muted-custom mb-3">
                  Pretrend computes the trend slope over a defined time period using linear
                  regression. The result is a percentage change that maps to one of five outcome
                  buckets, each representing a range of possible movements calibrated to the
                  specific data source.
                </p>
                <p className="text-muted-custom">
                  Users purchase units in one of five buckets — from significant decline to significant
                  growth. Every bucket's price climbs from a dime at open to a dollar at the close,
                  so earlier buyers receive more units per dollar and better returns for early conviction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Compare & Contrast */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Compare &amp; Contrast</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '720px', margin: '0 auto' }}>
              How Pretrend&apos;s trend-based model stacks up against the leading prediction markets.
            </p>
            <div className="card-dark p-3 p-lg-4">
              <div className="table-responsive">
                <table className="table table-dark table-borderless align-middle mb-0">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                      <th style={{ width: '46%' }}>Capability</th>
                      <th className="text-center text-green">Pretrend</th>
                      <th className="text-center text-white-50 fw-normal">Polymarket</th>
                      <th className="text-center text-white-50 fw-normal">Kalshi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: 'Captures magnitude and direction, not just yes/no', poly: false, kalshi: false },
                      { feature: 'Five graded outcome buckets', poly: false, kalshi: false },
                      { feature: 'Native on-chain statistical computation', poly: false, kalshi: false },
                      { feature: 'Timeslope pricing rewards early conviction', poly: false, kalshi: false },
                      { feature: 'Any time-series data source', poly: false, kalshi: false },
                      { feature: 'Cross-chain resolution', poly: false, kalshi: false },
                      { feature: 'Permissionless on-chain settlement', poly: true, kalshi: false },
                      { feature: 'White-label, embeddable markets', poly: false, kalshi: false },
                    ].map((row) => (
                      <tr key={row.feature} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <td className="text-muted-custom">{row.feature}</td>
                        <td className="text-center"><YesMark /></td>
                        <td className="text-center">{row.poly ? <YesMark /> : <NoMark />}</td>
                        <td className="text-center">{row.kalshi ? <YesMark /> : <NoMark />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Why Now */}
        <section className="section-padding bg-dark-custom">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="display-6 fw-bold mb-3">Why Now</h2>
              <p className="text-muted-custom" style={{ maxWidth: '720px', margin: '0 auto' }}>
                Prediction markets have broken into the mainstream — billions in volume, millions of
                participants, headlines worldwide. The appetite is proven, and the category is still early.
              </p>
            </div>

            <div className="row g-4 mb-5">
              <div className="col-md-6">
                <div className="card-dark p-4 p-lg-5 h-100">
                  <div className="d-flex justify-content-between align-items-baseline mb-3">
                    <span className="h5 text-white mb-0">Polymarket</span>
                    <span className="display-6 fw-bold text-green"><CountUp end={9} prefix="$" suffix="B+" /></span>
                  </div>
                  <div className="rounded-pill" style={{ height: '10px', background: 'rgba(255,255,255,0.06)' }}>
                    <div className="rounded-pill" style={{ height: '10px', width: '100%', background: 'linear-gradient(90deg,#7abe4d,#a3d97a)' }} />
                  </div>
                  <div className="small text-white-50 mt-2">Reported trading volume</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card-dark p-4 p-lg-5 h-100">
                  <div className="d-flex justify-content-between align-items-baseline mb-3">
                    <span className="h5 text-white mb-0">Kalshi</span>
                    <span className="display-6 fw-bold text-green"><CountUp end={2} prefix="$" suffix="B+" /></span>
                  </div>
                  <div className="rounded-pill" style={{ height: '10px', background: 'rgba(255,255,255,0.06)' }}>
                    <div className="rounded-pill" style={{ height: '10px', width: '22%', background: 'linear-gradient(90deg,#7abe4d,#a3d97a)' }} />
                  </div>
                  <div className="small text-white-50 mt-2">Reported trading volume</div>
                </div>
              </div>
            </div>

            <div className="card-accent p-4 p-lg-5 text-center">
              <p className="text-white mb-0" style={{ fontSize: '1.2rem', lineHeight: 1.7, maxWidth: '760px', margin: '0 auto' }}>
                Yet every one of those markets still asks a single yes-or-no question. Pretrend opens
                the same momentum to a richer kind of market — one that captures{' '}
                <strong className="text-green">how far</strong> and{' '}
                <strong className="text-green">which way</strong>, not just whether.
              </p>
            </div>
            <p className="text-white-50 text-center small mt-3 mb-0">
              Polymarket and Kalshi figures are approximate, reported trading volumes.
            </p>
          </div>
        </section>

        {/* VIBE Revenue Share — Virtuous Circle */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <div className="text-center mb-5">
              <h2 className="display-6 fw-bold mb-3">A Virtuous Circle</h2>
              <p className="text-muted-custom" style={{ maxWidth: '720px', margin: '0 auto' }}>
                Pretrend doesn&apos;t grow in isolation. A share of every dollar it earns flows back
                into the Vitruveo ecosystem — and that success compounds.
              </p>
            </div>

            <div className="row justify-content-center mb-4">
              <div className="col-lg-10">
                <div className="card-dark p-4 p-lg-5">
                  <VirtuousCircleSVG />
                </div>
              </div>
            </div>

            <div className="row g-4 justify-content-center">
              <div className="col-lg-5 col-md-6">
                <div className="card-accent p-4 p-lg-5 h-100">
                  <h3 className="h5 mb-3">The 2% Revenue Share</h3>
                  <p className="text-muted-custom mb-3">
                    2% of all Pretrend revenue is split straight back into the Vitruveo ecosystem:
                  </p>
                  <div className="d-flex flex-column gap-2">
                    <div className="p-3 rounded" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <span className="text-green fw-bold">1%</span>
                      <span className="text-white ms-2">deepens VTRU liquidity</span>
                    </div>
                    <div className="p-3 rounded" style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <span className="text-green fw-bold">1%</span>
                      <span className="text-white ms-2">flows to every VIBE holder</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-5 col-md-6">
                <div className="card-dark p-4 p-lg-5 h-100 d-flex flex-column justify-content-center">
                  <h3 className="h5 text-green mb-3">Success compounds</h3>
                  <p className="text-muted-custom mb-0">
                    Pretrend&apos;s success drives VTRU&apos;s, and VTRU&apos;s drives the whole
                    Vitruveo ecosystem&apos;s — lifting asset value and rewarding VIBE holders at the same time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Five Outcome Buckets */}
        <section className="section-padding bg-dark-custom">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-5">Five Outcome Buckets</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Every market has exactly five buckets representing ranges of trend movement,
              calibrated to each data source&apos;s historical volatility.
            </p>
            <div className="row g-3 mb-5">
              {[
                { name: 'Crash', desc: 'Significant decline', range: 'Below 20th percentile', color: '#ef4444' },
                { name: 'Bear', desc: 'Moderate decline', range: '20th to 40th percentile', color: '#f97316' },
                { name: 'Flat', desc: 'Minimal change', range: '40th to 60th percentile', color: '#a3a3a3' },
                { name: 'Bull', desc: 'Moderate growth', range: '60th to 80th percentile', color: '#4ade80' },
                { name: 'Moon', desc: 'Significant growth', range: 'Above 80th percentile', color: '#8b5cf6' },
              ].map((bucket) => (
                <div key={bucket.name} className="col">
                  <div className="card-dark p-3 h-100 text-center">
                    <div className="h5 mb-1" style={{ color: bucket.color }}>{bucket.name}</div>
                    <div className="small text-white mb-1">{bucket.desc}</div>
                    <div className="small text-white-50">{bucket.range}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card-dark p-4">
              <BucketDistributionSVG />
            </div>
          </div>
        </section>

        {/* What You Can Predict */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">What You Can Predict</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '680px', margin: '0 auto' }}>
              If it moves over time, it can become a market. A glimpse of what Pretrend makes&nbsp;possible:
            </p>
            <div className="row g-4">
              {[
                { cat: 'Crypto', q: "Where does Bitcoin's 30-day trend land?", hi: 3 },
                { cat: 'Equities', q: "How strong is NVIDIA's momentum this quarter?", hi: 4 },
                { cat: 'AI', q: 'Is demand for AI compute still accelerating?', hi: 4 },
                { cat: 'Social', q: "A creator's follower growth over 90 days", hi: 2 },
                { cat: 'Macro', q: 'Which way is inflation trending?', hi: 1 },
                { cat: 'Culture', q: "A film's opening-month box-office momentum", hi: 3 },
              ].map((m) => (
                <div key={m.q} className="col-lg-4 col-md-6">
                  <div className="card-dark p-4 h-100 d-flex flex-column">
                    <div className="small text-green fw-semibold mb-2" style={{ letterSpacing: '0.08em' }}>
                      {m.cat.toUpperCase()}
                    </div>
                    <p className="text-white mb-4">{m.q}</p>
                    <div className="mt-auto">
                      <AnimatedBuckets start={m.hi} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white-50 text-center small mt-5 mb-0" style={{ maxWidth: '660px', margin: '0 auto' }}>
              Five graded outcomes — Crash, Bear, Flat, Bull, Moon — for any time-series the world produces.
            </p>
          </div>
        </section>

        {/* System Architecture */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">System Architecture</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              Three primary components working together: the Vitruveo Oracle, the Notary Service,
              and the Marketplace Layer.
            </p>

            <div className="row g-4 mb-5">
              {[
                {
                  title: 'Oracle Contract',
                  location: 'Vitruveo Blockchain',
                  desc: 'Stores market state, bucket thresholds, trend results, and fee accounting. Does not compute trends directly — stores results submitted by the authorized Notary.',
                },
                {
                  title: 'Trend Precompile',
                  location: 'Vitruveo Blockchain (native)',
                  desc: 'Computes OLS regression, R-squared, volatility, and bucket quintiles at compiled machine-code speed. What would be impossible in Solidity executes in microseconds.',
                },
                {
                  title: 'Notary Service',
                  location: 'Off-chain',
                  desc: 'Fetches external data, signs results, submits to Oracle. Batches updates for markets sharing the same data source. Sole authorized writer to the Oracle contract.',
                },
                {
                  title: 'Marketplace Contract',
                  location: 'BSC (or other EVM chains)',
                  desc: 'Handles unit purchases, pot tracking, and winner payouts. Deployed on external chains for accessibility and liquidity.',
                },
                {
                  title: 'HOST Bridge',
                  location: 'Vitruveo to external chains',
                  desc: 'Pushes resolution data cross-chain via HTTP Outbound Service Trigger. Validator-signed payloads ensure cryptographic proof of resolution.',
                },
                {
                  title: 'Provider Modules',
                  location: 'Off-chain',
                  desc: 'Per-source adapters that fetch, authenticate, and normalize external time-series data before it reaches the Notary for signing.',
                },
              ].map((component) => (
                <div key={component.title} className="col-lg-4 col-md-6">
                  <div className="card-dark p-4 h-100">
                    <h4 className="h5 text-white mb-1">{component.title}</h4>
                    <p className="small text-green mb-3">{component.location}</p>
                    <p className="text-muted-custom small mb-0">{component.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trend Precompile */}
        <section className="section-padding bg-dark-custom">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Trend Precompile</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              A native precompiled contract on the Vitruveo blockchain that performs statistical
              computation at the Geth client layer — compiled Go code, not interpreted EVM&nbsp;bytecode.
            </p>

            <div className="row g-4 mb-5">
              <div className="col-lg-6">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Mode 1: Full Analysis</h3>
                  <p className="text-muted-custom mb-3">
                    Given a series of timestamp-value pairs, the precompile computes three values:
                  </p>
                  <ul className="text-muted-custom mb-3">
                    <li className="mb-2"><strong className="text-white">Slope percentage</strong> — the fitted trend change from start to end of the series</li>
                    <li className="mb-2"><strong className="text-white">R-squared</strong> — confidence in the linear fit</li>
                    <li className="mb-2"><strong className="text-white">Volatility</strong> — sample standard deviation</li>
                  </ul>
                  <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="small text-white-50">
                      <strong className="text-white">Input:</strong> 40 bytes per point (8-byte timestamp + 32-byte value), sorted chronologically<br/>
                      <strong className="text-white">Output:</strong> 96 bytes (3 &times; 32-byte signed integers, scaled by 10<sup>18</sup>)
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Mode 2: Volatility Buckets</h3>
                  <p className="text-muted-custom mb-3">
                    Given historical data and a window size, the precompile computes quintile
                    thresholds for bucket boundaries:
                  </p>
                  <ul className="text-muted-custom mb-3">
                    <li className="mb-2">Calculates absolute percentage change for every rolling window</li>
                    <li className="mb-2">Sorts deltas and returns 20th, 40th, 60th, and 80th percentile values</li>
                    <li className="mb-2">These four thresholds define the five outcome buckets</li>
                  </ul>
                  <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="small text-white-50">
                      <strong className="text-white">Input:</strong> 8-byte window size + timestamp-value pairs<br/>
                      <strong className="text-white">Output:</strong> 128 bytes (4 &times; 32-byte unsigned integers representing quintile thresholds)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Timeslope Pricing */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Timeslope Pricing</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              A dime at the open, a dollar at the close. Every bucket's price climbs with the
              clock and accelerates with demand — rewarding early conviction with better returns.
            </p>

            <div className="row mb-5">
              <div className="col-lg-5 mb-4 mb-lg-0">
                <div className="card-dark p-4 h-100">
                  <TimeslopeSVG />
                </div>
              </div>
              <div className="col-lg-7">
                <div className="card-accent p-4 mb-4">
                  <h3 className="h5 mb-3">The Formula</h3>
                  <div className="p-3 rounded mb-3" style={{ background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
                    <span className="text-green">price</span> = min($1.00, $0.10 + timeDrift + demandSlippage)
                  </div>
                  <p className="text-muted-custom mb-2">
                    <strong className="text-white">timeDrift:</strong> steady climb to $1.00 at the 80% close &middot;
                    <strong className="text-white"> demandSlippage:</strong> every purchase pushes its bucket further ahead
                  </p>
                </div>
                <div className="card-dark p-4">
                  <h3 className="h5 mb-3">Early Bird Advantage</h3>
                  <div className="table-responsive">
                    <table className="table table-dark table-sm mb-2" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr className="text-green">
                          <th>Buyer</th><th>Price</th><th>Units</th><th>Share</th><th>Return</th>
                        </tr>
                      </thead>
                      <tbody className="text-white-50">
                        <tr><td>Alice (early)</td><td>$0.21</td><td>466</td><td>53.1%</td><td className="text-green">4.78x</td></tr>
                        <tr><td>Carol (mid)</td><td>$0.44</td><td>226</td><td>25.8%</td><td>2.32x</td></tr>
                        <tr><td>Frank (late)</td><td>$0.91</td><td>110</td><td>12.6%</td><td>1.13x</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-muted-custom small mb-0">
                    Same $100 stake, different timing. Betting closes at 80% of the market, when every bucket reaches $1.00 and the trend line is revealed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Data Flow */}
        <section className="section-padding bg-dark-custom">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Market Lifecycle</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              From creation to resolution — a complete flow across chains.
            </p>

            <div className="row g-4 mb-5">
              {[
                {
                  step: '01',
                  title: 'Create',
                  desc: 'Creator specifies data source, start time, and duration. Notary fetches historical data, computes bucket thresholds via the precompile, and initializes the market.',
                },
                {
                  step: '02',
                  title: 'Trade',
                  desc: 'Users purchase units in their chosen bucket. Timeslope pricing fills each purchase, climbing with time and demand until the 80% close. The Notary updates the trend at the source cadence.',
                },
                {
                  step: '03',
                  title: 'Resolve',
                  desc: 'When duration expires, the final trend determines the winning bucket. The Oracle pushes resolution via HOST to marketplace contracts, triggering payouts.',
                },
              ].map((phase) => (
                <div key={phase.step} className="col-lg-4">
                  <div className="card-dark p-4 h-100">
                    <div className="h2 text-green mb-2" style={{ opacity: 0.5 }}>{phase.step}</div>
                    <h3 className="h5 text-white mb-3">{phase.title}</h3>
                    <p className="text-muted-custom mb-0">{phase.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Data Sources</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              Pretrend supports any time-series data. Each source has a provider module that handles
              fetching, authentication, and normalization.
            </p>

            <div className="row g-4 mb-5">
              {[
                { category: 'Cryptocurrency', examples: 'BTC price, ETH price, trading volume, TVL', resolution: '15 minutes', window: '30 days' },
                { category: 'Equities', examples: 'Stock prices, indices, forex rates', resolution: '15-60 minutes', window: '90 days' },
                { category: 'Social Metrics', examples: 'Follower counts, view counts, engagement rates', resolution: '1-4 hours', window: '90 days' },
                { category: 'Economic', examples: 'Inflation, unemployment, interest rates', resolution: '24 hours to weekly', window: '1 year' },
                { category: 'Elections', examples: 'Polling aggregates, approval ratings', resolution: '24 hours', window: '90 days' },
                { category: 'Commodities', examples: 'Oil, gold, natural gas, agricultural futures', resolution: '15-60 minutes', window: '90 days' },
              ].map((source) => (
                <div key={source.category} className="col-lg-4 col-md-6">
                  <div className="card-dark p-4 h-100">
                    <h4 className="h5 text-green mb-2">{source.category}</h4>
                    <p className="text-muted-custom small mb-2">{source.examples}</p>
                    <div className="small text-white-50">
                      Resolution: {source.resolution} &middot; Window: {source.window}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Marketplace Variants */}
        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Marketplace Models</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Multiple deployment models for different use cases.
            </p>

            <div className="card-dark p-4 mb-4">
              <ReachSVG />
            </div>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              One oracle on Vitruveo resolves markets wherever they live — and the more places
              Pretrend runs, the stronger the whole network becomes.
            </p>

            <div className="row g-4">
              <div className="col-lg-4">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Primary Marketplace</h3>
                  <p className="text-muted-custom mb-0">
                    Operated by Pretrend with access to all data sources. Full transaction
                    fee retention. General-purpose interface for retail users.
                  </p>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">White-Label</h3>
                  <p className="text-muted-custom mb-0">
                    Third parties deploy branded marketplaces with custom domains and
                    optional source filtering. 50/50 fee split with Pretrend. No upfront licensing fee.
                  </p>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Open-Source Starter Kit</h3>
                  <p className="text-muted-custom mb-0">
                    React component library, contract ABIs, integration examples, and
                    documentation for building custom marketplace experiences.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="section-padding bg-dark-custom">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-3">Security</h2>
            <p className="text-muted-custom text-center mb-5" style={{ maxWidth: '700px', margin: '0 auto' }}>
              Trust-minimized by design — every result is signed, on-chain, and independently&nbsp;verifiable.
            </p>
            <div className="row g-4">
              <div className="col-lg-6">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Oracle Trust Model</h3>
                  <p className="text-muted-custom mb-0">
                    The Notary is a trusted component. All submissions are signed and on-chain,
                    creating an auditable history. The trend precompile is deterministic — anyone
                    can verify results independently.
                  </p>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Data Integrity</h3>
                  <p className="text-muted-custom mb-0">
                    OLS regression dampens outlier effects. Resolution intervals prevent flash
                    manipulation. Multiple data points over market duration provide redundancy.
                  </p>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Void Protection</h3>
                  <p className="text-muted-custom mb-0">
                    Markets are automatically voided if they receive fewer than 80% of expected
                    updates. Participants receive refunds minus infrastructure costs already incurred.
                  </p>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="card-dark p-4 h-100">
                  <h3 className="h5 text-green mb-3">Cross-Chain Fallback</h3>
                  <p className="text-muted-custom mb-0">
                    If HOST delivery fails, marketplace contracts support manual resolution
                    submission with Oracle signature verification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section-padding bg-dark-alt">
          <div className="container text-center">
            <p className="display-5 fw-bold mb-4" style={{ maxWidth: '820px', margin: '0 auto' }}>
              <span className="d-block">The world runs on trends.</span>
              <span className="text-gradient d-block">Pretrend makes them tradable.</span>
            </p>
            <p className="text-muted-custom mb-4" style={{ maxWidth: '500px', margin: '0 auto' }}>
              Interested in building on Pretrend or deploying a white-label marketplace?
            </p>
            <div className="d-flex gap-3 justify-content-center flex-wrap">
              <a href="mailto:info@verticalfoundation.net" className="btn btn-green btn-lg px-5">
                Contact Us
              </a>
              <a href="/whitepaper" className="btn btn-outline-light btn-lg px-5">
                Read the Whitepaper
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

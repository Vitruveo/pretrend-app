import type { Metadata } from "next";
import Header from '../components/Header';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: "About | Pretrend Protocol",
  description: "What Pretrend is, who builds it, and where to go deeper: the whitepaper, the OLS math behind trend resolution, and worked examples of real markets replayed on the protocol.",
};

const sections = [
  {
    href: '/protocol',
    title: 'Protocol',
    body: 'The protocol overview: continuous trend resolution, five graded buckets, Timeslope pricing, the AIWars Trends launch and the roadmap.',
    cta: 'Read the Protocol',
  },
  {
    href: '/whitepaper',
    title: 'Whitepaper',
    body: 'The full specification: system architecture, oracle design, Timeslope pricing, marketplace mechanics, fees, and security model.',
    cta: 'Read the Whitepaper',
  },
  {
    href: '/ols',
    title: 'OLS',
    body: 'The math behind the trend. How ordinary least squares turns a window of noisy prices into one defensible slope, and why that slope is hard to manipulate.',
    cta: 'Explore the Math',
  },
  {
    href: '/examples',
    title: 'Examples',
    body: 'Real 30-minute BTC markets replayed through the protocol, plus live calls to the Trend precompile running regression and volatility analysis on-chain.',
    cta: 'See the Examples',
  },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '40px' }}>
          <div className="container">
            <div className="text-center mb-5">
              <h1 className="display-4 fw-bold mb-3">
                About <span className="text-gradient">Pretrend</span>
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '820px', margin: '0 auto', textWrap: 'balance' }}>
                Pretrend is a trend-based oracle protocol for prediction markets. Instead of a
                yes-or-no outcome, every market resolves on the magnitude and direction of change,
                measured by an ordinary least squares regression computed natively on the Vitruveo
                blockchain.
              </p>
            </div>
            <div className="row g-4 justify-content-center">
              <div className="col-lg-10">
                <div className="row g-4">
                  <div className="col-md-6">
                    <h2 className="h4 text-green mb-3">What it does</h2>
                    <p className="text-muted-custom">
                      A Pretrend market asks how much something will move, not whether it will.
                      Prices from a live feed are sampled over a fixed window, a trend line is fit
                      across the whole window, and the slope lands in one of five graded outcome
                      buckets. The computation runs inside the chain through the Trend precompile,
                      so settlement is deterministic and verifiable by anyone.
                    </p>
                  </div>
                  <div className="col-md-6">
                    <h2 className="h4 text-green mb-3">Who builds it</h2>
                    <p className="text-muted-custom">
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

        <section className="section-padding bg-dark-alt">
          <div className="container">
            <h2 className="display-6 fw-bold text-center mb-5">Go Deeper</h2>
            <div className="row g-4">
              {sections.map((s) => (
                <div className="col-md-4" key={s.href}>
                  <div className="card-dark h-100 p-4 d-flex flex-column">
                    <h3 className="h4 fw-bold mb-3">{s.title}</h3>
                    <p className="text-muted-custom flex-grow-1">{s.body}</p>
                    <a href={s.href} className="btn btn-outline-light mt-3 align-self-start">{s.cta}</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

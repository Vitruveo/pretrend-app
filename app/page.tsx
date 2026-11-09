import type { Metadata } from "next";
import Header from './components/Header';
import Footer from './components/Footer';
import { MarketCards } from './markets/_components/market-cards';
import LaunchCountdown from './components/LaunchCountdown';

export const metadata: Metadata = {
  title: "Trends | Pretrend",
  description: "Pretrend markets, live: pump.fun buy volume in 5-minute markets, Bitcoin and Ethereum in 30-minute markets, each resolved on the OLS trend of its window.",
};

export default function TrendsPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '60px' }}>
          <div className="container" style={{ maxWidth: '960px' }}>
            <div className="text-center mb-5">
              <h1 className="display-5 fw-bold mb-3">
                <span className="text-gradient">Trends</span>
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '820px', margin: '0 auto', textWrap: 'balance' }}>
                One card per market. Each shows the live pulse the market resolves on,
                with the OLS trend over the market window.
              </p>
              <p className="fw-bold mt-5 mb-0" style={{ fontSize: 'clamp(3rem, 10vw, 7.5rem)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                <span className="text-gradient">And so it begins...</span>
              </p>
              <LaunchCountdown />
            </div>
            <MarketCards />
            <p className="text-muted-custom small text-center mb-0">
              Pulses come from <a href="/trendpulse">TrendPulse</a>, the Pretrend oracle. Read how markets resolve on the <a href="/protocol">Protocol</a> page.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

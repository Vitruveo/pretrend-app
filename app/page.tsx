import type { Metadata } from "next";
import Header from './components/Header';
import Footer from './components/Footer';
import { MarketCards } from './markets/_components/market-cards';

export const metadata: Metadata = {
  title: "Trends | Pretrend",
  description: "Pretrend markets, live: pump.fun buy volume in 5-minute markets, Bitcoin in 15-minute markets, Ethereum in 30-minute markets, each resolved on the OLS trend of its window.",
};

export default function TrendsPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '60px' }}>
          <div className="container" style={{ maxWidth: '1200px' }}>
            <div className="text-center mb-5">
              <h1 className="display-5 fw-bold mb-3">
                <span className="text-gradient">Trends</span>
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '820px', margin: '0 auto', textWrap: 'balance' }}>
                One card per market. Each shows the live pulse the market resolves on,
                with the OLS trend over the market window.
              </p>
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

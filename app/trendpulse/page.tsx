import type { Metadata } from "next";
import Header from '../components/Header';
import Footer from '../components/Footer';
import { TrendPulseStatus } from './_components/trendpulse-status';

export const metadata: Metadata = {
  title: "TrendPulse | Pretrend Protocol",
  description: "Live status of TrendPulse, the Pretrend oracle: AI Wars momentum, pump.fun buy volume, BTC, ETH and weather feeds updating in real time with the OLS trend that resolves Pretrend markets.",
};

export default function TrendPulsePage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '60px' }}>
          <div className="container" style={{ maxWidth: '960px' }}>
            <div className="text-center mb-5">
              <h1 className="display-5 fw-bold mb-3">
                <span className="text-gradient">TrendPulse</span> — Oracle Status
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '820px', margin: '0 auto', textWrap: 'balance' }}>
                The oracle that resolves Pretrend markets, watched live. Every feed runs at
                its own cadence — each card explains what you&apos;re seeing and how often it moves.
              </p>
            </div>
            <TrendPulseStatus />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";
import Header from '../components/Header';
import Footer from '../components/Footer';
import { SwapCard } from './_components/swap-card';

export const metadata: Metadata = {
  title: "Swap VUSD | Pretrend",
  description: "Swap VUSD 1:1 with USDT on BNB Chain or USDT.b on Vitruveo.",
};

export default function SwapPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
          <div className="container" style={{ maxWidth: '960px' }}>
            <div className="text-center mb-4">
              <h1 className="display-6 fw-bold mb-2">
                <span className="text-gradient">Swap VUSD</span>
              </h1>
              <p className="text-muted-custom mb-0" style={{ maxWidth: '620px', margin: '0 auto', textWrap: 'balance' }}>
                VUSD is the market currency on Pretrend. Swap it 1:1 with USDT on BNB Chain or USDT.b on Vitruveo.
              </p>
            </div>
            <SwapCard />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

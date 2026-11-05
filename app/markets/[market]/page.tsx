import type { Metadata } from "next";
import { notFound } from 'next/navigation';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { MARKETS, findMarket } from '../../config/markets';
import { MarketView } from '../_components/market-view';

export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.map((m) => ({ market: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ market: string }> }): Promise<Metadata> {
  const { market } = await params;
  const m = findMarket(market);
  if (!m) return { title: "Market | Pretrend" };
  return { title: `${m.name} | Pretrend`, description: m.desc };
}

export default async function MarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market } = await params;
  const m = findMarket(market);
  if (!m) notFound();
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '60px' }}>
          <div className="container" style={{ maxWidth: '960px' }}>
            <div className="text-center mb-5">
              <p className="text-white-50 mb-2" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                <a href="/" className="text-white-50">Trends</a> / {m.slug}{m.readOnly ? ' / read-only' : ''}
              </p>
              <h1 className="display-5 fw-bold mb-3">
                <span className="text-gradient">{m.name}</span>
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '820px', margin: '0 auto', textWrap: 'balance' }}>
                {m.headline}
              </p>
            </div>
            <MarketView market={m} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

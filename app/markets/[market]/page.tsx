import type { Metadata } from "next";
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { MARKETS, findMarket } from '../../config/markets';
import { MarketView } from '../_components/market-view';
import { MarketGame } from '../_components/market-game';
import { GeoProvider, GeoBand } from '../_components/geo';
import { WalletTile } from '../_components/wallet-tile';
import '../_components/market-game.css';

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
        <GeoProvider>
        {/* the fixed nav is about 70px tall; the band sits directly under it, full width */}
        {/* the region band and money bar only apply to playable (game) markets */}
        <div className="bg-dark-custom" style={{ paddingTop: '72px' }}>
          {m.game && <GeoBand />}
        </div>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '48px', paddingBottom: '60px' }}>
          <div className="container" style={{ maxWidth: m.game ? '1100px' : '960px' }}>
            <div className="text-center mb-4">
              <h1 className="display-5 fw-bold mb-0">
                <span className="text-gradient">{m.name}</span>
              </h1>
            </div>
            <nav className="d-flex align-items-center flex-wrap gap-2 mb-4" aria-label="Markets">
              <span className="text-white-50" style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>Markets:</span>
              {MARKETS.filter((x) => !x.readOnly).map((x) => (
                <Link
                  key={x.slug}
                  href={`/markets/${x.slug}/`}
                  aria-current={x.slug === m.slug ? 'page' : undefined}
                  className="rounded-pill px-3 py-1 text-decoration-none"
                  style={{
                    fontSize: '0.9rem',
                    border: `1px solid ${x.slug === m.slug ? '#2f8fd6' : 'rgba(255,255,255,0.2)'}`,
                    background: x.slug === m.slug ? 'rgba(47,143,214,0.2)' : 'transparent',
                    color: x.slug === m.slug ? '#fff' : '#b9c5da',
                  }}
                >
                  {x.name}
                </Link>
              ))}
            </nav>
            {m.game && <WalletTile />}
            {m.game ? <MarketGame market={m} /> : <MarketView market={m} />}
          </div>
        </section>
        </GeoProvider>
      </main>
      <Footer />
    </>
  );
}

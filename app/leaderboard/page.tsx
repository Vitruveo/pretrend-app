import type { Metadata } from "next";
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Leaderboard } from './_components/leaderboard';
import '../markets/_components/market-game.css';

export const metadata: Metadata = {
  title: "Leaderboard | Pretrend",
  description: "Pretrend standings: buys, winnings, net, win rate and ROI per wallet across pump.fun 5 and Bitcoin 15 markets, read from the market contract on Vitruveo.",
};

export default function LeaderboardPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '60px' }}>
          <div className="container" style={{ maxWidth: '1200px' }}>
            <div className="text-center mb-5">
              <h1 className="display-5 fw-bold mb-3">
                <span className="text-gradient">Leaderboard</span>
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '820px', margin: '0 auto', textWrap: 'balance' }}>
                Every wallet that has bought into a Pretrend market, ranked from the market contract on Vitruveo.
              </p>
            </div>
            <Leaderboard />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

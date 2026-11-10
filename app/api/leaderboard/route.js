import { events, standings } from './_lib/leaderboard';
import { MARKET_TYPE_IDS } from '../../config/pretrend-markets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PERIODS = { '24h': 86400, '7d': 7 * 86400, all: null };

// GET /api/leaderboard/?market=all|pumpfun-5|bitcoin-15&period=24h|7d|all
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const market = q.get('market') || 'all';
  const period = q.get('period') || 'all';
  if (market !== 'all' && !MARKET_TYPE_IDS[market]) return Response.json({ error: 'unknown market' }, { status: 400 });
  if (!(period in PERIODS)) return Response.json({ error: 'unknown period' }, { status: 400 });
  try {
    const store = await events();
    const now = Math.floor(Date.now() / 1000);
    const since = PERIODS[period] ? now - PERIODS[period] : 0;
    const rows = standings(store, { slug: market, since });
    return Response.json(
      { market, period, asOfBlock: store.last, updatedAt: Math.floor(store.at / 1000), rows },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }
    );
  } catch (e) {
    return Response.json({ error: e.shortMessage || e.message }, { status: 503 });
  }
}

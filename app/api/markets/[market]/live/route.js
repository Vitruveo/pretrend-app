import { findMarket } from '../../../../config/markets';
import { handleLive } from '../../_lib/core';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req, { params }) {
  const { market } = await params;
  const m = findMarket(market);
  if (!m) return Response.json({ error: 'unknown market' }, { status: 404 });
  try {
    const [status, body] = await handleLive(m);
    return Response.json(body, { status });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 503 });
  }
}

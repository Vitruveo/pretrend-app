// The viewer's country from Vercel's IP geolocation headers. Market pages are static, so the lookup
// runs here per request; without the headers (local dev, other hosts) the client falls back to the
// browser locale.
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const h = req.headers;
  const country = (h.get('x-vercel-ip-country') || '').toUpperCase() || null;
  return Response.json(
    {
      country,
      region: h.get('x-vercel-ip-country-region') || null,
      city: h.get('x-vercel-ip-city') ? decodeURIComponent(h.get('x-vercel-ip-city')) : null,
      source: country ? 'ip' : null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

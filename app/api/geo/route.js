// The viewer's country from Vercel's IP geolocation headers. Market pages are static, so the lookup
// runs here per request; without the headers (local dev, other hosts) the client falls back to the
// browser locale.
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const h = req.headers;
  const ipCountry = (h.get('x-vercel-ip-country') || '').toUpperCase() || null;
  // Local testing: `next dev` with DEV_COUNTRY in .env.local stands in for IP geolocation. Production builds
  // ignore it, and a real Vercel country header always wins.
  const devCountry = process.env.NODE_ENV === 'development' && /^[A-Za-z]{2}$/.test(process.env.DEV_COUNTRY || '') ? process.env.DEV_COUNTRY.toUpperCase() : null;
  const country = ipCountry || devCountry;
  // DEV_COUNTRY_ENFORCEMENT=0 turns off country enforcement (testing): detection and the country band stay as
  // they are, but market features work everywhere. Unset or 1 = enforced.
  const gate = process.env.DEV_COUNTRY_ENFORCEMENT !== '0';
  return Response.json(
    {
      country,
      region: h.get('x-vercel-ip-country-region') || null,
      city: h.get('x-vercel-ip-city') ? decodeURIComponent(h.get('x-vercel-ip-city')) : null,
      source: ipCountry ? 'ip' : devCountry ? 'dev' : null,
      gate,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

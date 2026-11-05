'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Live UTC clock, HH:MM:SS, ticking once a second after mount (never rendered on the server).
function UtcClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span style={{ fontVariantNumeric: 'tabular-nums' }}>--:--:-- UTC</span>;
  const p = (x) => String(x).padStart(2, '0');
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {p(now.getUTCHours())}:{p(now.getUTCMinutes())}:{p(now.getUTCSeconds())} UTC
    </span>
  );
}
import { isRestricted } from '../../config/geo';

const GeoContext = createContext({ loading: true, country: null, name: null, flag: null, allowed: false, source: null });

export function useGeo() {
  return useContext(GeoContext);
}

// Regional indicator pair for an ISO 3166-1 alpha-2 code.
function flagOf(code) {
  if (!code || code.length !== 2) return '\u{1F3F3}️';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function nameOf(code) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch (e) {
    return code;
  }
}

// Country from the browser locale, e.g. en-US -> US. Used only when IP geolocation is unavailable.
function localeCountry() {
  try {
    const tag = navigator.language || (navigator.languages && navigator.languages[0]);
    if (!tag) return null;
    const loc = new Intl.Locale(tag);
    const region = loc.region || (loc.maximize && loc.maximize().region);
    return region && region.length === 2 ? region.toUpperCase() : null;
  } catch (e) {
    return null;
  }
}

export function GeoProvider({ children }) {
  const [state, setState] = useState({ loading: true, country: null, source: null });

  useEffect(() => {
    let stop = false;
    fetch('/api/geo/', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (stop) return;
        if (d.country) setState({ loading: false, country: d.country, source: 'ip' });
        else {
          const c = localeCountry();
          setState({ loading: false, country: c, source: c ? 'locale' : null });
        }
      })
      .catch(() => {
        if (stop) return;
        const c = localeCountry();
        setState({ loading: false, country: c, source: c ? 'locale' : null });
      });
    return () => { stop = true; };
  }, []);

  const value = useMemo(() => ({
    ...state,
    name: nameOf(state.country),
    flag: flagOf(state.country),
    allowed: !state.loading && !isRestricted(state.country),
  }), [state]);

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

// Full-width band under the nav: the viewer's flag and country, and whether market features are on.
export function GeoBand() {
  const geo = useGeo();
  const tone = geo.loading ? 'rgba(255,255,255,0.06)' : geo.allowed ? 'rgba(122,190,77,0.14)' : 'rgba(239,68,68,0.14)';
  const edge = geo.loading ? 'rgba(255,255,255,0.12)' : geo.allowed ? 'rgba(122,190,77,0.45)' : 'rgba(239,68,68,0.45)';
  const text = geo.loading
    ? 'Identifying your country…'
    : !geo.country
      ? 'Country not identified. Features not available in your country.'
      : geo.allowed
        ? 'Features enabled for country'
        : 'Features not available in your country.';
  return (
    <div role="status" style={{ background: tone, borderTop: `1px solid ${edge}`, borderBottom: `1px solid ${edge}` }}>
      <div className="container d-flex align-items-center justify-content-between flex-wrap gap-3 py-2" style={{ maxWidth: '1100px' }}>
        <span className="d-flex align-items-center gap-3">
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }} aria-hidden="true">{geo.flag}</span>
          <span className="fw-bold text-white" style={{ letterSpacing: '0.04em' }}>{geo.name || (geo.loading ? '' : 'Unknown')}</span>
          <span className="text-white-50">{text}</span>
        </span>
        <span className="text-white fw-bold" style={{ letterSpacing: '0.08em' }}><UtcClock /></span>
      </div>
    </div>
  );
}

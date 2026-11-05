'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// RainbowKit connect button, client-only (wallet state has no server render).
const ConnectWallet = dynamic(() => import('../web3/ConnectWallet'), { ssr: false });

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const pathname = usePathname();
  const cleanPath = pathname?.replace(/\/+$/, '') ?? '';
  const isAbout = ['/about', '/protocol', '/whitepaper', '/ols', '/examples'].includes(cleanPath);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`navbar navbar-expand-md navbar-dark fixed-top ${
        scrolled || menuOpen ? 'bg-black' : 'bg-transparent'
      }`}
      style={{ transition: 'background 0.3s' }}
    >
      <div className="container">
        <a className="navbar-brand fw-bold d-flex align-items-center gap-2" href="/" style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
          <img
            src="/assets/pretrend-logomark.png"
            alt="Pretrend"
            width={34}
            height={34}
            style={{ height: '34px', width: 'auto' }}
          />
          <span className="text-gradient">Pretrend</span>
        </a>
        <button
          className={`navbar-toggler ${menuOpen ? '' : 'collapsed'}`}
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`navbar-collapse justify-content-end ${menuOpen ? 'show' : 'collapse'}`} id="navbarNav">
          <ul className="navbar-nav gap-md-4 align-items-md-center">
            <li className="nav-item" onClick={() => setMenuOpen(false)}>
              <a className={`nav-link ${cleanPath === '' || cleanPath.startsWith('/markets') ? 'active' : ''}`} href="/">Trends</a>
            </li>
            <li
              className={`nav-item dropdown ${aboutOpen ? 'show' : ''}`}
              onMouseEnter={() => setAboutOpen(true)}
              onMouseLeave={() => setAboutOpen(false)}
            >
              <a
                className={`nav-link dropdown-toggle ${isAbout ? 'active' : ''}`}
                href="/about"
                role="button"
                aria-expanded={aboutOpen}
                onClick={(e) => {
                  // On touch/mobile the first tap opens the menu; the About page is reachable from the menu.
                  if (window.matchMedia('(max-width: 767.98px)').matches && !aboutOpen) {
                    e.preventDefault();
                    setAboutOpen(true);
                  }
                }}
              >
                About
              </a>
              <ul className={`dropdown-menu dropdown-menu-dark ${aboutOpen ? 'show' : ''}`} onClick={() => { setAboutOpen(false); setMenuOpen(false); }}>
                <li><a className="dropdown-item" href="/about">About Pretrend</a></li>
                <li><a className="dropdown-item" href="/protocol">Protocol</a></li>
                <li><hr className="dropdown-divider" /></li>
                <li><a className="dropdown-item" href="/whitepaper">Whitepaper</a></li>
                <li><a className="dropdown-item" href="/ols">OLS</a></li>
                <li><a className="dropdown-item" href="/examples">Examples</a></li>
              </ul>
            </li>
            <li className="nav-item" onClick={() => setMenuOpen(false)}>
              <a className="nav-link" href="/trendpulse">TrendPulse</a>
            </li>
          </ul>
          <div className="ms-md-4 mt-3 mt-md-0">
            <ConnectWallet />
          </div>
        </div>
      </div>
    </nav>
  );
}

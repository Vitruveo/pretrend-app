import Image from 'next/image';

export default function Footer({ disclaimer }: { disclaimer?: string }) {
  return (
    <footer className="footer-dark py-5">
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-6 text-center text-md-start mb-4 mb-md-0">
            <a href="https://www.verticalfoundation.net" target="_blank" rel="noopener noreferrer">
              <Image
                src="/assets/vertical-foundation-logo.png"
                alt="Vertical Foundation"
                width={100}
                height={25}
                style={{ height: '24px', width: 'auto', opacity: 0.6 }}
              />
            </a>
          </div>
          {/* Flex-wrap, not inline runs: JSX strips the whitespace between sibling
              anchors, which otherwise renders one unbreakable 500px+ line that
              forces horizontal overflow on phones. */}
          <div className="col-md-6 d-flex flex-wrap justify-content-center justify-content-md-end column-gap-4 row-gap-2">
            <a href="/protocol">Protocol</a>
            <a href="/about">About</a>
            <a href="/whitepaper">Whitepaper</a>
            <a href="/ols">OLS</a>
            <a href="/examples">Examples</a>
            <a href="/trendpulse">TrendPulse</a>
            <a href="mailto:info@verticalfoundation.net">Contact</a>
          </div>
        </div>
        <hr className="my-4" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />
        {disclaimer && (
          <p className="text-center text-white-50 small mb-3" style={{ maxWidth: '720px', margin: '0 auto' }}>
            {disclaimer}
          </p>
        )}
        <p className="text-center text-white-50 small mb-0">
          © {new Date().getFullYear()} Pretrend · A Vertical Foundation project
        </p>
      </div>
    </footer>
  );
}

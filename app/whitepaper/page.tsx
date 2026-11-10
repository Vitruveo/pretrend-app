import type { Metadata } from "next";
import Header from '../components/Header';
import Footer from '../components/Footer';
import { whitepaperHtml, whitepaperMeta, whitepaperToc } from './content';

export const metadata: Metadata = {
  title: "Whitepaper | Pretrend Protocol",
  description: "The Pretrend whitepaper v4: a trend prediction marketplace — oracle, Timeslope pricing, payouts, fees, VUSD, availability, and security.",
};

export default function WhitepaperPage() {
  return (
    <>
      <Header />
      <main>
        <section className="section-padding bg-dark-custom" style={{ paddingTop: '140px', paddingBottom: '40px' }}>
          <div className="container">
            <div className="text-center">
              <h1 className="display-4 fw-bold mb-3">
                <span className="text-gradient">Pretrend</span> Whitepaper
              </h1>
              <p className="lead text-muted-custom" style={{ maxWidth: '760px', margin: '0 auto' }}>
                {whitepaperMeta.subtitle}
              </p>
              <p className="text-white-50 mt-3">{whitepaperMeta.version}</p>
            </div>
          </div>
        </section>

        <section className="bg-dark-custom pb-5">
          <div className="container">
            <div className="row">
              <aside className="col-lg-3 d-none d-lg-block">
                <nav className="wp-toc card-dark p-4">
                  <div className="small text-green fw-semibold mb-3" style={{ letterSpacing: '0.08em' }}>
                    CONTENTS
                  </div>
                  <ul className="list-unstyled mb-0">
                    {whitepaperToc.map((item) => (
                      <li key={item.id} className="mb-2">
                        <a href={`#${item.id}`} className="wp-toc-link small">
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
              <div className="col-lg-9">
                <article
                  className="wp-doc"
                  dangerouslySetInnerHTML={{ __html: whitepaperHtml }}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

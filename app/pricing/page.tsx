import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { foundingOffer, plans } from '@/lib/pricing';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: `Pricing · ${site.name}` };

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="band">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">Launch pricing</p>
              <h1 className="page-title">Pay per Halo instance, not per plan</h1>
              <p>
                Plans are free to generate. You pay when {site.name} builds, and the price follows how many Halo
                instances you connect. Swap instances whenever a client changes.
              </p>
            </div>
            <div className="price-grid">
              {plans.map((p) => (
                <article key={p.id} className={`price-card${p.highlight ? ' is-highlight' : ''}`}>
                  {p.highlight ? <span className="tag">Made for partners</span> : null}
                  <h2>{p.name}</h2>
                  <p className="price">
                    <strong>{p.price}</strong> <span>{p.per}</span>
                  </p>
                  {p.annual ? <p className="annual">{p.annual}</p> : <p className="annual">&nbsp;</p>}
                  <p className="price-summary">{p.summary}</p>
                  <ul>
                    {p.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link className={`btn ${p.highlight ? 'btn-primary' : 'btn-ghost'}`} href={p.id === 'partner' ? '/#pilot' : `/signup?plan=${p.id}`}>
                    {p.cta}
                  </Link>
                </article>
              ))}
            </div>
            <p className="founding">
              <b>Founding partners:</b> {foundingOffer} <Link href="/#pilot">Apply for a pilot</Link>
            </p>
            <p className="form-note">Prices exclude VAT. Paid plans open with our first pilots; until then every account starts on Explore.</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

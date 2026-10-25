import Link from 'next/link';
import { site } from '@/lib/site';

/** The Enact mark (public/enact-mark.png, made from the logo with the background cleared). */
export function Mark({ size = 24 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/enact-mark.png" width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', flex: 'none' }} />;
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label={`${site.name} home`}>
      <Mark />
      <span>{site.wordmark}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Brand />
        <nav className="site-nav" aria-label="Main">
          <Link className="hide-sm" href="/#partners">For partners</Link>
          <Link className="hide-sm" href="/example">Example</Link>
          <Link className="hide-sm" href="/#safety">Safety</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
          <Link className="btn btn-primary btn-sm" href="/signup">Start free</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="row-between">
          <span>© 2026 {site.name}. Made by {site.company} in {site.location}.</span>
          <span>
            <Link href="/example">Example plan</Link> &nbsp; <Link href="/pricing">Pricing</Link> &nbsp; <Link href="/login">Sign in</Link>
          </span>
        </div>
        <p>HaloITSM and HaloPSA are products of Halo Service Solutions. {site.name} is independent and not affiliated with or endorsed by Halo.</p>
      </div>
    </footer>
  );
}

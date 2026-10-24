import Link from 'next/link';
import { site } from '@/lib/site';

/** The mark: three lines of a spec, the last one checked off. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="var(--brand)" />
      <path d="M8 9.5h12M8 14h8M8 18.5h12" stroke="var(--on-brand)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="var(--on-brand)" />
    </svg>
  );
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
          <Link className="hide-sm" href="/#how">How it works</Link>
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
            <Link href="/pricing">Pricing</Link> &nbsp; <Link href="/login">Sign in</Link>
          </span>
        </div>
        <p>HaloITSM and HaloPSA are products of Halo Service Solutions. {site.name} is independent and not affiliated with or endorsed by Halo.</p>
      </div>
    </footer>
  );
}

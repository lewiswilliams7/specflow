import Link from 'next/link';
import { site } from '@/lib/site';

export function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="var(--accent)" />
      <path d="M8 9.5h12M8 14h8M8 18.5h12" stroke="var(--paper)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="var(--paper)" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" href="/" aria-label={`${site.name} home`}>
          <Mark />
          <b>{site.wordmark}</b>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link className="hide-sm" href="/#how">How it works</Link>
          <Link className="hide-sm" href="/#safety">Safety</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/signup">Start free</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="row">
          <span>© 2026 {site.name}. Made by {site.company}.</span>
          <span>{site.location}</span>
        </div>
        <p>HaloITSM and HaloPSA are products of Halo Service Solutions. {site.name} is independent and not affiliated with or endorsed by Halo.</p>
      </div>
    </footer>
  );
}

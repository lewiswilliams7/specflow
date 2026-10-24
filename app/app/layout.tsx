import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import { Mark } from '@/components/SiteChrome';
import { plans } from '@/lib/pricing';
import { site } from '@/lib/site';
import { getContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await getContext();
  const planName = plans.find((p) => p.id === workspace.plan)?.name ?? 'Explore';
  return (
    <div className="app-shell">
      <header className="top app-bar">
        <div className="wrap">
          <Link className="brand" href="/app" aria-label={`${site.name} app home`}>
            <Mark />
            <b>{site.wordmark}</b>
          </Link>
          <nav className="nav" aria-label="Account">
            <span className="hide-sm muted">
              {workspace.name} · <span className="pill">{planName}</span>
            </span>
            <span className="hide-sm muted">{user.email}</span>
            <form action={signOut}>
              <button className="btn btn-ghost" type="submit">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="wrap app-main">{children}</main>
    </div>
  );
}

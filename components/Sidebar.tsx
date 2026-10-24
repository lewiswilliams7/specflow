'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/(auth)/actions';
import { IconCard, IconChat, IconClose, IconHome, IconLogOut, IconMenu, IconPlus, IconServer } from '@/components/icons';
import { Brand } from '@/components/SiteChrome';

type Props = {
  workspace: string;
  plan: string;
  email: string;
  instances: { id: string; name: string }[];
  threads: { id: string; title: string }[];
};

/** App navigation: instances and recent conversations. A drawer on small screens. */
export function Sidebar({ workspace, plan, email, instances, threads }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  const current = (href: string) => (path === href ? 'page' : undefined);
  const newHref = instances.length === 1 ? `/app/instances/${instances[0].id}` : '/app';

  return (
    <>
      <div className="mobile-bar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <IconMenu size={18} />
        </button>
        <Brand href="/app" />
      </div>
      {open ? <button className="scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}

      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="App">
        <div className="side-inner">
          <div className="side-top">
            <Brand href="/app" />
            {open ? (
              <button className="btn btn-quiet btn-icon" type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                <IconClose />
              </button>
            ) : null}
          </div>

          <Link className="btn btn-secondary side-new" href={newHref}>
            <IconPlus /> New conversation
          </Link>

          <Link className="side-link" href="/app" aria-current={current('/app')}>
            <IconHome />
            <span>Overview</span>
          </Link>

          <div className="side-label">Halo instances</div>
          {instances.length ? (
            instances.map((i) => (
              <Link key={i.id} className="side-link" href={`/app/instances/${i.id}`} aria-current={current(`/app/instances/${i.id}`)}>
                <IconServer />
                <span>{i.name}</span>
              </Link>
            ))
          ) : (
            <Link className="side-link" href="/app">
              <IconPlus />
              <span>Connect an instance</span>
            </Link>
          )}

          {threads.length ? (
            <>
              <div className="side-label">Recent</div>
              {threads.map((t) => (
                <Link key={t.id} className="side-link" href={`/app/threads/${t.id}`} aria-current={current(`/app/threads/${t.id}`)} title={t.title}>
                  <IconChat />
                  <span>{t.title}</span>
                </Link>
              ))}
            </>
          ) : null}

          <div className="side-foot">
            <div className="side-account">
              <span className="avatar" aria-hidden="true">{(workspace || email).slice(0, 1)}</span>
              <span className="who">
                <b>{workspace}</b>
                <span>{email}</span>
              </span>
            </div>
            <Link className="side-link" href="/pricing">
              <IconCard />
              <span>{plan} plan</span>
            </Link>
            <form action={signOut}>
              <button className="side-link btn-block" type="submit" style={{ border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <IconLogOut />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

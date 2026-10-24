import Link from 'next/link';
import { IconChat, IconServer } from '@/components/icons';
import { getContext } from '@/lib/workspace';

// Run next to Halo UK instances and the Supabase project (London).
export const preferredRegion = 'lhr1';
export const maxDuration = 60;

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default async function Overview() {
  const { supabase, workspace, limits } = await getContext();
  const [{ data: instances }, { data: recent }] = await Promise.all([
    supabase.from('instances').select('id, name, base_url, status, inventory_at').eq('workspace_id', workspace.id).order('created_at'),
    supabase.from('threads').select('id, title, updated_at, instances(name)').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }).limit(8),
  ]);
  const full = limits.instances !== null && (instances?.length ?? 0) >= limits.instances;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Connect a Halo instance, read its configuration, then describe what you need.</p>
        </div>
      </div>

      <section className="card" aria-labelledby="instances-h">
        <div className="card-head">
          <div>
            <h2 id="instances-h">Halo instances</h2>
            <p>{limits.instances === null ? 'Unlimited on your plan.' : `${instances?.length ?? 0} of ${limits.instances} on your plan.`}</p>
          </div>
          <span className="build-actions">
            <Link className="btn btn-quiet btn-sm" href="/app/instances">Manage</Link>
            {full ? null : <Link className="btn btn-secondary btn-sm" href="/app/instances/new">Connect an instance</Link>}
          </span>
        </div>
        {instances?.length ? (
          <ul className="rows">
            {instances.map((i) => (
              <li key={i.id}>
                <IconServer className="muted" />
                <div className="grow">
                  <Link className="title" href={`/app/instances/${i.id}`}>{i.name}</Link>
                  <span className="meta">{i.base_url} · {i.inventory_at ? `read ${when(i.inventory_at)}` : 'configuration not read yet'}</span>
                </div>
                <span className={`badge ${i.status === 'connected' ? 'add' : i.status === 'failed' ? 'danger' : ''}`}>
                  <span className="dot" />
                  {i.status === 'connected' ? 'Connected' : i.status === 'failed' ? 'Needs attention' : 'Not tested'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <IconServer />
            <b>No instances yet</b>
            <span>A test or trial instance is the best place to start.</span>
            <Link className="btn btn-primary btn-sm" href="/app/instances/new">Connect an instance</Link>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="recent-h">
        <div className="card-head"><h2 id="recent-h">Recent conversations</h2></div>
        {recent?.length ? (
          <ul className="rows">
            {recent.map((t) => (
              <li key={t.id}>
                <IconChat className="muted" />
                <div className="grow">
                  <Link className="title" href={`/app/threads/${t.id}`}>{t.title}</Link>
                  <span className="meta">{(t.instances as unknown as { name: string } | null)?.name} · {when(t.updated_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <IconChat />
            <b>No conversations yet</b>
            <span>Open an instance and describe what you need. You’ll get a plan you can refine by replying.</span>
          </div>
        )}
      </section>
    </div>
  );
}

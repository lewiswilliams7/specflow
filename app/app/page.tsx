import Link from 'next/link';
import { IconChat, IconCheck, IconServer } from '@/components/icons';
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
  const ready = instances?.find((i) => i.status === 'connected' && i.inventory_at) ?? null;
  const first = instances?.[0] ?? null;
  // The one next thing to do, so a new account never has to work out where to start.
  const steps = [
    { done: !!instances?.length, title: 'Connect a Halo instance', text: 'A test or trial instance is the best place to start.', href: '/app/instances/new', cta: 'Connect' },
    { done: !!ready, title: 'Read its configuration', text: 'Ticket types, fields, approvals, SLAs, workflows and teams. Never tickets.', href: first ? `/app/instances/${first.id}` : '', cta: 'Read it' },
    { done: !!recent?.length, title: 'Describe what you need', text: 'Type the brief, paste requirements or attach the form design spreadsheet.', href: ready ? `/app/instances/${ready.id}` : '', cta: 'Start' },
  ];
  const next = steps.findIndex((st) => !st.done);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Describe what you need, review the plan, then build it in Halo.</p>
        </div>
        {ready ? <Link className="btn btn-primary" href={`/app/instances/${ready.id}`}>New conversation</Link> : null}
      </div>

      {next >= 0 ? (
        <section className="card" aria-labelledby="start-h">
          <div className="card-head"><div><h2 id="start-h">Get started</h2><p>Three steps to your first plan. Nothing is written to Halo until you approve a build.</p></div></div>
          <div className="card-body">
            <ol className="steps-inline">
              {steps.map((st, i) => (
                <li key={st.title} className={`mini-step${st.done ? ' done' : i === next ? ' now' : ''}`}>
                  <span className="n">{st.done ? <IconCheck size={14} /> : i + 1}</span>
                  <div className="grow">
                    <b>{st.title}</b>
                    <span>{st.text}</span>
                  </div>
                  {i === next && st.href ? <Link className="btn btn-primary btn-sm" href={st.href}>{st.cta}</Link> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

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

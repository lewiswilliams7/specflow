import Link from 'next/link';
import { IconPlus, IconServer, IconSettings } from '@/components/icons';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default async function InstancesPage({ searchParams }: { searchParams: Promise<{ removed?: string }> }) {
  const { removed } = await searchParams;
  const { supabase, workspace, limits } = await getContext();
  const [{ data: instances }, { data: threads }, { data: builds }] = await Promise.all([
    supabase.from('instances').select('id, name, base_url, status, last_error, inventory_at, created_at').eq('workspace_id', workspace.id).order('created_at'),
    supabase.from('threads').select('instance_id').eq('workspace_id', workspace.id),
    supabase.from('builds').select('instance_id, status, started_at').eq('workspace_id', workspace.id).eq('mode', 'apply').order('started_at', { ascending: false }),
  ]);
  const convos = new Map<string, number>();
  for (const t of threads ?? []) convos.set(t.instance_id, (convos.get(t.instance_id) ?? 0) + 1);
  const lastBuild = new Map<string, { status: string; started_at: string }>();
  for (const b of builds ?? []) if (!lastBuild.has(b.instance_id)) lastBuild.set(b.instance_id, b);
  const full = limits.instances !== null && (instances?.length ?? 0) >= limits.instances;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Halo instances</h1>
          <p>{limits.instances === null ? 'Unlimited on your plan.' : `${instances?.length ?? 0} of ${limits.instances} on your plan.`}</p>
        </div>
        {full ? null : (
          <Link className="btn btn-primary" href="/app/instances/new">
            <IconPlus /> Connect an instance
          </Link>
        )}
      </div>
      {removed ? <p className="notice ok">Removed from Specflow. Nothing in Halo was changed.</p> : null}

      <section className="card">
        {instances?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Instance</th>
                  <th>Status</th>
                  <th className="hide-sm">Configuration read</th>
                  <th className="hide-sm">Conversations</th>
                  <th className="hide-sm">Last build</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {instances.map((i) => {
                  const b = lastBuild.get(i.id);
                  return (
                    <tr key={i.id}>
                      <td>
                        <Link className="cell-title" href={`/app/instances/${i.id}`}>
                          <IconServer className="muted" />
                          <span>
                            <b>{i.name}</b>
                            <small>{i.base_url.replace(/^https:\/\//, '')}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {i.status === 'failed' ? (
                          <span className="badge danger" title={i.last_error ?? ''}><span className="dot" />Needs attention</span>
                        ) : i.status === 'connected' ? (
                          <span className="badge add"><span className="dot" />Connected</span>
                        ) : (
                          <span className="badge"><span className="dot" />Not tested</span>
                        )}
                      </td>
                      <td className="hide-sm">{i.inventory_at ? when(i.inventory_at) : <span className="muted">Not read yet</span>}</td>
                      <td className="hide-sm">{convos.get(i.id) ?? 0}</td>
                      <td className="hide-sm">{b ? `${when(b.started_at)}, ${b.status}` : <span className="muted">Never</span>}</td>
                      <td className="cell-actions">
                        <Link className="btn btn-quiet btn-sm" href={`/app/instances/${i.id}/settings`} aria-label={`Settings for ${i.name}`}>
                          <IconSettings /> <span className="hide-sm">Settings</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <IconServer />
            <b>No instances yet</b>
            <span>Connect a test or trial instance first.</span>
            <Link className="btn btn-primary btn-sm" href="/app/instances/new">Connect an instance</Link>
          </div>
        )}
      </section>
    </div>
  );
}

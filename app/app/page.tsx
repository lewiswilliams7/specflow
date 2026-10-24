import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { getContext } from '@/lib/workspace';
import { connectInstance } from './actions';

export const maxDuration = 60;

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'never');

export default async function Dashboard() {
  const { supabase, workspace, limits } = await getContext();
  const [{ data: instances }, { data: recent }] = await Promise.all([
    supabase.from('instances').select('id, name, base_url, status, inventory_at').eq('workspace_id', workspace.id).order('created_at'),
    supabase.from('plans').select('id, request, created_at, errors, instances(name)').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(8),
  ]);
  const full = limits.instances !== null && (instances?.length ?? 0) >= limits.instances;

  return (
    <>
      <div>
        <h1>Your Halo instances</h1>
        <p className="muted">
          Connect an instance, read what&apos;s already configured, then describe what you need. Nothing is written to Halo from here yet.
        </p>
      </div>

      <section className="panel" aria-labelledby="instances-h">
        <h2 id="instances-h">Connected</h2>
        {instances?.length ? (
          <ul className="list">
            {instances.map((i) => (
              <li key={i.id}>
                <div>
                  <Link href={`/app/instances/${i.id}`}><b>{i.name}</b></Link>
                  <div className="muted">{i.base_url} · last read {when(i.inventory_at)}</div>
                </div>
                <span className={`pill ${i.status === 'connected' ? 'ok' : i.status === 'failed' ? 'bad' : ''}`}>{i.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No instances yet. Connect your first one below. A test or trial instance is a good place to start.</p>
        )}
      </section>

      {full ? (
        <p className="muted">Your plan includes {limits.instances} instance{limits.instances === 1 ? '' : 's'}. More open with paid plans.</p>
      ) : (
        <section className="panel" aria-labelledby="connect-h">
          <h2 id="connect-h">Connect a Halo instance</h2>
          <p className="muted">
            In Halo, go to Configuration → Integrations → Halo API, add an application with <b>Client ID and Secret (Services)</b>, and give it access to read configuration. We store the secret encrypted and, for now, only read your configuration: nothing is written to Halo from here.
          </p>
          <ActionForm action={connectInstance} submit="Connect and test" pending="Connecting…">
            <div className="field-row">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" placeholder="Acme test" required maxLength={80} />
              </div>
              <div className="field">
                <label htmlFor="base_url">Halo address</label>
                <input id="base_url" name="base_url" placeholder="acme.haloitsm.com" required />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="client_id">Client ID</label>
                <input id="client_id" name="client_id" required autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="client_secret">Client secret</label>
                <input id="client_secret" name="client_secret" type="password" required autoComplete="off" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="tenant">Tenant (only for hosted Halo with a tenant name; usually blank)</label>
              <input id="tenant" name="tenant" autoComplete="off" />
            </div>
          </ActionForm>
        </section>
      )}

      {recent?.length ? (
        <section className="panel" aria-labelledby="recent-h">
          <h2 id="recent-h">Recent plans</h2>
          <ul className="list">
            {recent.map((p) => (
              <li key={p.id}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/app/plans/${p.id}`}><b>{p.request.slice(0, 90)}{p.request.length > 90 ? '…' : ''}</b></Link>
                  <div className="muted">{(p.instances as unknown as { name: string } | null)?.name} · {when(p.created_at)}</div>
                </div>
                <span className={`pill ${(p.errors as string[]).length ? 'bad' : 'ok'}`}>{(p.errors as string[]).length ? 'needs fixes' : 'ready to review'}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

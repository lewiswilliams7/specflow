import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { ConnectForm } from '@/components/ConnectForm';
import { site } from '@/lib/site';
import { getContext } from '@/lib/workspace';
import { removeInstance, updateConnection } from '../../../actions';

export const preferredRegion = 'lhr1';
export const maxDuration = 60;

export default async function InstanceSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await getContext();
  const { data: inst } = await supabase.from('instances').select('id, name, base_url, client_id, tenant, status, last_error').eq('id', id).eq('workspace_id', workspace.id).single();
  if (!inst) notFound();
  const { count: convos } = await supabase.from('threads').select('id', { count: 'exact', head: true }).eq('instance_id', id);

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div>
        <nav className="crumbs">
          <Link href="/app/instances">Halo instances</Link>
          <span>/</span>
          <Link href={`/app/instances/${inst.id}`}>{inst.name}</Link>
        </nav>
        <div className="page-head"><div><h1>Settings</h1><p>{inst.base_url.replace(/^https:\/\//, '')}</p></div></div>
      </div>

      {inst.status === 'failed' ? <p className="notice error">{inst.last_error ?? 'Halo rejected the saved login.'}</p> : null}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Connection</h2>
            <p>Changed the secret in Halo? Paste the new one here. {site.name} tests the login before saving anything.</p>
          </div>
        </div>
        <div className="card-body">
          <ConnectForm action={updateConnection} submit="Test and save" values={{ id: inst.id, name: inst.name, base_url: inst.base_url, client_id: inst.client_id, tenant: inst.tenant ?? '' }} />
        </div>
      </section>

      <section className="card danger-zone">
        <div className="card-head">
          <div>
            <h2>Remove from {site.name}</h2>
            <p>
              Disconnects this instance and deletes its {convos ?? 0} conversation{convos === 1 ? '' : 's'}, plans and build history from {site.name}. Nothing in Halo is changed or deleted.
            </p>
          </div>
        </div>
        <div className="card-body">
          <ActionForm action={removeInstance} submit="Remove instance" pending="Removing" variant="secondary">
            <input type="hidden" name="instance_id" value={inst.id} />
            <div className="field">
              <label htmlFor="confirm">Type <b>{inst.name}</b> to confirm</label>
              <input id="confirm" name="confirm" autoComplete="off" required />
            </div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConnectForm } from '@/components/ConnectForm';
import { getContext } from '@/lib/workspace';
import { connectInstance } from '../../actions';

export const preferredRegion = 'lhr1';
export const maxDuration = 60;

export default async function NewInstancePage() {
  const { supabase, workspace, limits } = await getContext();
  const { count } = await supabase.from('instances').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id);
  if (limits.instances !== null && (count ?? 0) >= limits.instances) redirect('/app/instances');
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div>
        <nav className="crumbs"><Link href="/app/instances">Halo instances</Link></nav>
        <div className="page-head"><div><h1>Connect a Halo instance</h1><p>Specflow signs in to Halo&apos;s API to read your configuration and, on paid plans, to build.</p></div></div>
      </div>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>In Halo first</h2>
            <p>Go to Configuration, Integrations, Halo API and add an application using <b>Client ID and Secret (Services)</b>. To build, it needs permission to change configuration, not just read it.</p>
          </div>
        </div>
        <div className="card-body">
          <ConnectForm action={connectInstance} submit="Connect and test" />
        </div>
      </section>
    </div>
  );
}

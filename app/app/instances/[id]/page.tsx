import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { Conversation } from '@/components/Conversation';
import { StaleNotice } from '@/components/StaleNotice';
import { IconAlert, IconChat, IconCheck, IconSettings } from '@/components/icons';
import { getContext } from '@/lib/workspace';
import { scanInstance } from '../../actions';

// Reading a big instance can take a couple of minutes. Run next to Halo UK instances and Supabase (London).
export const preferredRegion = 'lhr1';
export const maxDuration = 300;

const SUGGESTIONS = [
  'New starter form: full name, start date, department and laptop type. Start date and department required. Goes to the Service Desk team, done within 5 working days.',
  'Add a stage called Awaiting Equipment to our new starter workflow that pauses the SLA.',
  'Change requests need approval from the CAB group before they can be scheduled.',
];

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function InstancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ connected?: string }> }) {
  const { id } = await params;
  const { connected } = await searchParams;
  const { supabase, workspace, limits } = await getContext();
  const { data: inst } = await supabase
    .from('instances')
    .select('id, name, base_url, status, last_error, inventory_at, inventory')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!inst) notFound();
  const { data: threads } = await supabase.from('threads').select('id, title, updated_at').eq('instance_id', id).order('updated_at', { ascending: false }).limit(8);
  const inv = inst.inventory as { ticket_types?: string[]; custom_fields?: string[]; workflows_and_their_steps?: Record<string, string[]>; teams?: string[] } | null;

  const failed =
    inst.status === 'failed' ? (
      <div className="banner-error" role="alert">
        <IconAlert />
        <span>{inst.last_error ?? 'Halo rejected the saved login.'}</span>
        <Link className="btn btn-secondary btn-sm" href={`/app/instances/${inst.id}/settings`}>Update connection</Link>
      </div>
    ) : null;

  const readForm = (
    <ActionForm action={scanInstance} submit={inst.inventory_at ? 'Read again' : 'Read configuration'} pending="Reading Halo" variant={inst.inventory_at ? 'secondary' : 'primary'} size={inst.inventory_at ? 'sm' : 'md'}>
      <input type="hidden" name="instance_id" value={inst.id} />
    </ActionForm>
  );

  if (!inst.inventory_at) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>{inst.name}</h1>
            <p>{inst.base_url}</p>
          </div>
          <Link className="btn btn-quiet btn-sm" href={`/app/instances/${inst.id}/settings`}><IconSettings /> Settings</Link>
        </div>
        {failed}
        <div className="steps-inline">
          <div className="mini-step done"><span className="n"><IconCheck size={14} /></span><div><b>Connected</b><span>Halo accepted the client ID and secret.</span></div></div>
          <div className="mini-step now"><span className="n">2</span><div><b>Read configuration</b><span>Ticket types, forms, approvals, SLAs, workflows and teams.</span></div></div>
          <div className="mini-step"><span className="n">3</span><div><b>Describe what you need</b><span>Get a plan matched to what you already have.</span></div></div>
        </div>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Read what’s already configured</h2>
              <p>Takes a minute or two on a big instance. It only reads configuration, never tickets, and changes nothing.</p>
            </div>
          </div>
          <div className="card-body">{readForm}</div>
        </section>
        {connected ? <p className="notice ok">Connected. Read the configuration next.</p> : null}
      </div>
    );
  }

  const others = threads?.length ? (
    <section className="card" style={{ width: '100%', maxWidth: 780 }}>
      <div className="card-head"><h2>Conversations on this instance</h2></div>
      <ul className="rows">
        {threads.map((t) => (
          <li key={t.id}>
            <IconChat className="muted" />
            <div className="grow"><Link className="title" href={`/app/threads/${t.id}`}>{t.title}</Link></div>
            <span className="meta">{when(t.updated_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  return (
    <div className="chat-page">
      <header className="chat-head">
        <h1>{inst.name}</h1>
        <div className="stat-strip" style={{ marginRight: 4 }}>
          <span className="hide-sm"><b>{inv?.ticket_types?.length ?? 0}</b> {inv?.ticket_types?.length === 1 ? 'ticket type' : 'ticket types'}</span>
          <span className="hide-sm"><b>{Object.keys(inv?.workflows_and_their_steps ?? {}).length}</b> {Object.keys(inv?.workflows_and_their_steps ?? {}).length === 1 ? 'workflow' : 'workflows'}</span>
          <span title={`Last read ${when(inst.inventory_at)}`}>Read {when(inst.inventory_at)}</span>
        </div>
        {readForm}
        <Link className="btn btn-quiet btn-icon" href={`/app/instances/${inst.id}/settings`} aria-label="Instance settings" title="Settings">
          <IconSettings />
        </Link>
      </header>
      {failed}
      <StaleNotice instanceId={inst.id} inventoryAt={inst.inventory_at} />
      <Conversation
        instanceId={inst.id}
        turns={[]}
        placeholder="Describe the form, fields, approvals, stages and targets you need"
        start={{
          heading: `What do you need built in ${inst.name}?`,
          suggestions: SUGGESTIONS,
        }}
        after={
          <>
            {limits.plansPerMonth !== null ? <p className="subtle">Explore includes {limits.plansPerMonth} plans a month. Each message is one plan.</p> : null}
            {others}
          </>
        }
      />
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm';
import { Composer } from '@/components/Composer';
import { getContext } from '@/lib/workspace';
import { scanInstance, startThread } from '../../actions';

// Reading a big instance and planning can each take a couple of minutes.
// Run next to Halo UK instances and the Supabase project (London).
export const preferredRegion = 'lhr1';
export const maxDuration = 300;

export default async function InstancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ connected?: string }> }) {
  const { id } = await params;
  const { connected } = await searchParams;
  const { supabase, workspace, limits } = await getContext();
  const { data: inst } = await supabase
    .from('instances')
    .select('id, name, base_url, status, inventory_at, inventory')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!inst) notFound();
  const { data: threads } = await supabase.from('threads').select('id, title, updated_at').eq('instance_id', id).order('updated_at', { ascending: false }).limit(20);
  const inv = inst.inventory as { ticket_types?: string[]; custom_fields?: string[]; workflows_and_their_steps?: Record<string, string[]>; teams?: string[] } | null;

  return (
    <>
      <div>
        <p className="muted"><Link href="/app">← Instances</Link></p>
        <h1>{inst.name}</h1>
        <p className="muted">{inst.base_url}</p>
        {connected ? <p className="thanks">Connected: Halo accepted the client ID and secret. Next, read the instance.</p> : null}
      </div>

      <section className="panel" aria-labelledby="scan-h">
        <h2 id="scan-h">1. Read what&apos;s already configured</h2>
        <p className="muted">
          {inst.inventory_at
            ? `Last read ${new Date(inst.inventory_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}: ${inv?.ticket_types?.length ?? 0} ticket types, ${inv?.custom_fields?.length ?? 0} custom fields, ${Object.keys(inv?.workflows_and_their_steps ?? {}).length} workflows, ${inv?.teams?.length ?? 0} teams.`
            : 'Not read yet. This reads ticket types, forms, fields, workflows, approvals, SLAs and teams. It takes a minute or two and changes nothing.'}
        </p>
        <ActionForm action={scanInstance} submit={inst.inventory_at ? 'Read again' : 'Read instance'} pending="Reading Halo… this can take a couple of minutes">
          <input type="hidden" name="instance_id" value={inst.id} />
        </ActionForm>
      </section>

      <section className="panel" aria-labelledby="ask-h">
        <h2 id="ask-h">2. Start a conversation</h2>
        <p className="muted">
          Write it the way you&apos;d explain it to a colleague: the forms, required fields, who approves, the stages and the targets. You can reply to refine the plan, answer its questions or change your mind.
          {limits.plansPerMonth !== null ? ` Explore includes ${limits.plansPerMonth} plans a month.` : ''}
        </p>
        {inst.inventory_at ? (
          <Composer
            action={startThread}
            hidden={{ instance_id: inst.id }}
            placeholder="New starters: we need full name, start date, department (HR, IT, Finance) and laptop type. Start date and department are required. HR approve, then IT. Everything goes to the Service Desk team and should be done within 5 working days."
          />
        ) : (
          <p className="muted">Read the instance first, so the plan knows what already exists.</p>
        )}
      </section>

      {threads?.length ? (
        <section className="panel" aria-labelledby="threads-h">
          <h2 id="threads-h">Conversations</h2>
          <ul className="list">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/app/threads/${t.id}`} style={{ minWidth: 0 }}>{t.title}</Link>
                <span className="muted">{new Date(t.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

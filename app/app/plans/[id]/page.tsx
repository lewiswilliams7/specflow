import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlanView } from '@/components/PlanView';
import type { Inv } from '@/lib/specflow/describe';
import type { Plan } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';

// Run next to Halo UK instances and the Supabase project (London).
export const preferredRegion = 'lhr1';

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await getContext();
  const { data: row } = await supabase
    .from('plans')
    .select('id, request, message, plan, errors, created_at, instance_id, thread_id, instances(name, inventory)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!row) notFound();
  const inst = row.instances as unknown as { name: string; inventory: Inv } | null;
  return (
    <>
      <div>
        <p className="muted">
          {row.thread_id ? <Link href={`/app/threads/${row.thread_id}`}>← Conversation</Link> : <Link href={`/app/instances/${row.instance_id}`}>← {inst?.name}</Link>}
        </p>
        <h1>Plan</h1>
        <p className="muted">{new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · nothing has been written to Halo</p>
      </div>
      <section className="panel">
        <h2>Request</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{row.message ?? row.request}</p>
      </section>
      <PlanView plan={row.plan as Plan | null} errors={(row.errors as string[]) ?? []} inventory={inst?.inventory ?? null} />
      {(row.plan as Plan | null)?.questions?.length ? (
        <section className="panel">
          <h2>Questions</h2>
          <ul className="bullets">{(row.plan as Plan).questions!.map((q) => <li key={q}>{q}</li>)}</ul>
          {row.thread_id ? <p className="muted">Answer them in the <Link href={`/app/threads/${row.thread_id}`}>conversation</Link>.</p> : null}
        </section>
      ) : null}
    </>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PlannerTurn } from '@/components/PlannerTurn';
import type { Inv } from '@/lib/specflow/describe';
import type { Plan } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';

/** Plans made before conversations existed. Plans in a conversation open there. */
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
  if (row.thread_id) redirect(`/app/threads/${row.thread_id}`);
  const inst = row.instances as unknown as { name: string; inventory: Inv } | null;
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div>
        <nav className="crumbs"><Link href={`/app/instances/${row.instance_id}`}>{inst?.name}</Link></nav>
        <div className="page-head"><div><h1>Plan</h1><p>{new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></div>
      </div>
      <div className="msg-user"><div className="bubble">{row.message ?? row.request}</div></div>
      <PlannerTurn plan={row.plan as Plan | null} errors={(row.errors as string[]) ?? []} previous={null} inventory={inst?.inventory ?? null} latest />
    </div>
  );
}

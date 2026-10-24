import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LastBuild } from '@/components/BuildPanel';
import { Conversation, type TurnView } from '@/components/Conversation';
import { IconChevron } from '@/components/icons';
import { PlannerTurn } from '@/components/PlannerTurn';
import type { Inv } from '@/lib/specflow/describe';
import type { Plan } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace, limits } = await getContext();
  const { data: thread } = await supabase
    .from('threads')
    .select('id, title, instance_id, instances(name, base_url, inventory)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!thread) notFound();
  const { data: rows } = await supabase
    .from('plans')
    .select('id, message, request, plan, errors')
    .eq('thread_id', id)
    .is('superseded_at', null)
    .order('created_at');
  const inst = thread.instances as unknown as { name: string; base_url: string; inventory: Inv } | null;
  // Last apply per plan version, for "Last built …" under the plan.
  const { data: builds } = await supabase.from('builds').select('plan_id, status, summary, started_at').eq('thread_id', id).eq('mode', 'apply').order('started_at', { ascending: false });
  const lastApply = new Map<string, LastBuild>();
  for (const b of builds ?? []) if (b.plan_id && !lastApply.has(b.plan_id)) lastApply.set(b.plan_id, { status: b.status, summary: b.summary, started_at: b.started_at });
  const inventory = inst?.inventory ?? null;

  let previous: Plan | null = null;
  const turns: TurnView[] = (rows ?? []).map((r, i, all) => {
    const plan = r.plan as Plan | null;
    const view: TurnView = {
      id: r.id,
      message: r.message ?? r.request,
      planner: <PlannerTurn plan={plan} errors={(r.errors as string[]) ?? []} previous={previous} inventory={inventory} latest={i === all.length - 1} planId={r.id} canBuild={limits.builds} target={{ instanceName: inst?.name ?? 'Halo', baseUrl: inst?.base_url ?? '', lastApply: lastApply.get(r.id) ?? null }} />,
    };
    if (plan) previous = plan;
    return view;
  });

  return (
    <div className="chat-page">
      <header className="chat-head">
        <nav className="crumbs" aria-label="Breadcrumb" style={{ margin: 0 }}>
          <Link href={`/app/instances/${thread.instance_id}`}>{inst?.name ?? 'Instance'}</Link>
          <IconChevron />
        </nav>
        <h1 title={thread.title}>{thread.title}</h1>
      </header>
      <Conversation
        instanceId={thread.instance_id}
        threadId={thread.id}
        turns={turns}
        placeholder="Reply to refine the plan: answer its questions, or change anything"
      />
    </div>
  );
}

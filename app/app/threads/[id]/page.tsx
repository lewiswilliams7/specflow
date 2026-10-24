import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Conversation, type TurnView } from '@/components/Conversation';
import { IconChevron } from '@/components/icons';
import { PlannerTurn } from '@/components/PlannerTurn';
import type { Inv } from '@/lib/specflow/describe';
import type { Plan } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await getContext();
  const { data: thread } = await supabase
    .from('threads')
    .select('id, title, instance_id, instances(name, inventory)')
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
  const inst = thread.instances as unknown as { name: string; inventory: Inv } | null;
  const inventory = inst?.inventory ?? null;

  let previous: Plan | null = null;
  const turns: TurnView[] = (rows ?? []).map((r, i, all) => {
    const plan = r.plan as Plan | null;
    const view: TurnView = {
      id: r.id,
      message: r.message ?? r.request,
      planner: <PlannerTurn plan={plan} errors={(r.errors as string[]) ?? []} previous={previous} inventory={inventory} latest={i === all.length - 1} />,
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

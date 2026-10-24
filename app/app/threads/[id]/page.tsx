import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Composer } from '@/components/Composer';
import { PlanView } from '@/components/PlanView';
import { counts, type Inv } from '@/lib/specflow/describe';
import type { Plan } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';
import { replyThread } from '../../actions';

// Run next to Halo UK instances and the Supabase project (London). Each reply re-plans: allow up to 5 minutes.
export const preferredRegion = 'lhr1';
export const maxDuration = 300;

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
  const { data: turns } = await supabase.from('plans').select('id, message, request, plan, errors, created_at').eq('thread_id', id).order('created_at');
  const inst = thread.instances as unknown as { name: string; inventory: Inv } | null;
  const last = (turns ?? []).at(-1);

  return (
    <>
      <div>
        <p className="muted"><Link href={`/app/instances/${thread.instance_id}`}>← {inst?.name}</Link></p>
        <h1>{thread.title}</h1>
      </div>

      <div className="thread">
        {(turns ?? []).map((t) => {
          const plan = t.plan as Plan | null;
          const errors = (t.errors as string[]) ?? [];
          const c = counts(plan);
          const isLast = t.id === last?.id;
          return (
            <div className="turn" key={t.id}>
              <div className="bubble user">{t.message ?? t.request}</div>
              <div className="bubble planner">
                <p>
                  {errors.length
                    ? 'I couldn’t make a plan that passes the checks. The problems are listed below; reply with more detail and I’ll try again.'
                    : `${c.changes ? `I'd make ${c.changes} change${c.changes === 1 ? '' : 's'}` : 'Nothing needs changing'}${c.reused ? `, reusing ${c.reused} thing${c.reused === 1 ? '' : 's'} you already have` : ''}.${c.cant ? ` ${c.cant} part${c.cant === 1 ? '' : 's'} I can't do yet.` : ''}`}
                </p>
                {plan?.questions?.length ? (
                  <div className="questions">
                    <b>Before you approve, can you tell me:</b>
                    <ol>{plan.questions.map((q) => <li key={q}>{q}</li>)}</ol>
                    {isLast ? <p className="muted">Answer below in your own words; I&apos;ll update the plan.</p> : null}
                  </div>
                ) : null}
                <details open={isLast}>
                  <summary>{isLast ? 'The plan' : 'Earlier version of the plan'}</summary>
                  <PlanView plan={plan} errors={errors} inventory={inst?.inventory ?? null} />
                </details>
              </div>
            </div>
          );
        })}
      </div>

      <Composer
        action={replyThread}
        hidden={{ thread_id: thread.id }}
        placeholder="Reply: answer the questions, or change anything. For example: “The approver is me. Keep Hardware required on HR Onboarding, make a separate section for New Starter.”"
        autoFocus
      />
    </>
  );
}

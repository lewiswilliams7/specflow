import { Mark } from '@/components/SiteChrome';
import { type BuildTarget, PlanView, planState, StateBadge } from '@/components/PlanView';
import { counts, diffPlans, humanise, type Inv } from '@/lib/specflow/describe';
import type { Plan } from '@/lib/specflow/plan-types';
import { site } from '@/lib/site';

/** The planner's side of a turn: what it says, what changed since the last version, its questions, then the plan. */
export function PlannerTurn({ plan, errors, previous, inventory, latest, planId, canBuild, target }: { plan: Plan | null; errors: string[]; previous: Plan | null; inventory: Inv; latest: boolean; planId?: string; canBuild?: boolean; target?: BuildTarget }) {
  const c = counts(plan);
  const state = planState(plan, errors);
  const diff = diffPlans(previous, plan, inventory);
  const fallback = errors.length
    ? 'I couldn’t make a version of this plan that passes the checks. The problems are listed below; reply with more detail and I’ll try again.'
    : `${c.changes ? `This makes ${c.changes} change${c.changes === 1 ? '' : 's'} to your Halo` : 'Nothing needs changing'}${c.reused ? ` and reuses ${c.reused} thing${c.reused === 1 ? '' : 's'} you already have` : ''}.`;
  const reply = plan?.reply ? humanise(plan.reply, inventory) : fallback;
  const nothingChanged = diff && !diff.added.length && !diff.removed.length && !diff.changed.length;

  return (
    <div className="msg-planner">
      <div className="planner-who">
        <Mark size={18} />
        <span>{site.name}</span>
        {latest ? <StateBadge state={state} questions={plan?.questions?.length} /> : null}
      </div>
      <p className="reply">{reply}</p>

      {diff ? (
        <div className="changed" aria-label="What changed since the last version">
          <b>{nothingChanged ? 'No changes to the plan since the last version' : 'Changed since the last version'}</b>
          {diff.added.map((x) => <div key={`a${x}`}><span className="sign" style={{ color: 'var(--add)' }}>+</span>{x}</div>)}
          {diff.changed.map((x) => <div key={`c${x}`}><span className="sign" style={{ color: 'var(--change)' }}>~</span>{x}</div>)}
          {diff.removed.map((x) => <div key={`r${x}`}><span className="sign" style={{ color: 'var(--danger)' }}>−</span>{x} (dropped)</div>)}
        </div>
      ) : null}

      {plan?.questions?.length ? (
        <div className="questions">
          <b>{latest ? 'Before you build, can you tell me:' : 'I asked:'}</b>
          <ol>{plan.questions.map((q) => <li key={q}>{humanise(q, inventory)}</li>)}</ol>
        </div>
      ) : null}

      <PlanView plan={plan} errors={errors} inventory={inventory} open={latest} heading={latest ? 'Plan' : 'Earlier version'} planId={planId} canBuild={canBuild} target={target} />
    </div>
  );
}

import { BuildPanel, type LastBuild } from '@/components/BuildPanel';
import { IconChevron } from '@/components/icons';
import { counts, describe, humanise, type Inv, stageText, title } from '@/lib/specflow/describe';
import type { Plan, PlanStep } from '@/lib/specflow/plan-types';

const KIND: Record<PlanStep['object'], string> = {
  team: 'team', field: 'field', sla: 'SLA', approval_process: 'approval', ticket_type: 'ticket type', status: 'status',
  outcome: 'action', workflow: 'workflow', agent: 'agent', approval_group: 'approval group', field_group: 'form section',
  email_template: 'email template', ticket_rule: 'ticket rule', ticket_template: 'child tickets', category: 'category', notification: 'notification',
};
const COVER: Record<string, { cls: string; sign: string; label: string }> = {
  built: { cls: 'keep', sign: '=', label: 'Already there' },
  partial: { cls: 'change', sign: '~', label: 'Partly there' },
  missing: { cls: 'add', sign: '+', label: 'Missing' },
};

export type PlanState = 'ready' | 'questions' | 'problems';
export function planState(plan: Plan | null, errors: string[]): PlanState {
  if (!plan || errors.length) return 'problems';
  return plan.questions?.length ? 'questions' : 'ready';
}

export function StateBadge({ state, questions }: { state: PlanState; questions?: number }) {
  if (state === 'ready') return <span className="badge add"><span className="dot" />Ready to build</span>;
  if (state === 'questions') return <span className="badge accent"><span className="dot" />{questions === 1 ? '1 question' : `${questions} questions`} to answer</span>;
  return <span className="badge danger"><span className="dot" />Didn’t pass the checks</span>;
}

/** The plan as a change review: + new, ~ changed, = already there, ! can't do yet. */
export type BuildTarget = { instanceId: string; instanceName: string; baseUrl: string; lastApply: LastBuild };

export function PlanView({ plan, errors, inventory, open = true, heading = 'Plan', planId, canBuild = false, target }: { plan: Plan | null; errors: string[]; inventory: Inv; open?: boolean; heading?: string; planId?: string; canBuild?: boolean; target?: BuildTarget }) {
  const steps = plan?.steps ?? [];
  // An update to something created in the same plan (e.g. setting the new ticket type's workflow) is one change, not two.
  const createdKey = (s: PlanStep) => `${s.object}:${(s.name ?? '').toLowerCase()}`;
  const createdByName = new Map(steps.filter((s) => s.action === 'create').map((s) => [createdKey(s), s]));
  const foldInto = (s: PlanStep) => (s.action === 'update' ? createdByName.get(`${s.object}:${(s.match?.name ?? '').toLowerCase()}`) : undefined);
  const folded = new Map<string, PlanStep[]>();
  for (const s of steps) {
    const host = foldInto(s);
    if (host) folded.set(host.id, [...(folded.get(host.id) ?? []), s]);
  }
  const changes = steps.filter((s) => s.action !== 'reuse' && !foldInto(s));
  const says = (s: PlanStep) => {
    if (!plan) return '';
    // A new workflow with stages added over several steps reads as one list, in order.
    if (s.object === 'workflow') {
      const ref = (id?: string) => { const x = steps.find((y) => y.id === id); return x ? title(x, inventory) : id ?? ''; };
      const stages = [...(s.insert_steps ?? []), ...(folded.get(s.id) ?? []).flatMap((u) => u.set?.insert_steps ?? [])].map((i) => stageText(i, ref));
      if (stages.length) return `Copy of "${s.copy_of}", adding ${stages.join('; ')}. Old buttons that skipped past a new stage now lead into it (rule W5).`;
    }
    const extra = (folded.get(s.id) ?? []).map((u) => describe(u, plan, inventory).replace(/\.$/, '')).map((t) => t.charAt(0).toLowerCase() + t.slice(1));
    const base = describe(s, plan, inventory);
    return extra.length ? `${base.replace(/\.$/, '')}; ${extra.join('; ')}.` : base;
  };
  const created = changes.filter((s) => s.action === 'create').length;
  const updated = changes.length - created;
  const c = counts(plan);
  const coverage = plan?.existing_coverage ?? [];
  const state = planState(plan, errors);

  return (
    <details className="plan-card" open={open}>
      <summary>
        <IconChevron className="chev" />
        <b>{heading}</b>
        <span className="counts">
          {created ? <span className="badge add">+{created} new</span> : null}
          {updated ? <span className="badge change">~{updated} changed</span> : null}
          {c.reused ? <span className="badge">={c.reused} reused</span> : null}
          {c.cant ? <span className="badge cant">{c.cant} can’t do yet</span> : null}
        </span>
      </summary>

      {errors.length ? (
        <section className="plan-section">
          <h3>Problems the checks found</h3>
          <p className="note">This version can’t be built. Reply with more detail and it will try again.</p>
          <ul className="diff">
            {errors.map((e) => (
              <li key={e} className="problem">
                <span className="sign">!</span>
                <div className="what"><p>{humanise(e, inventory)}</p></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="plan-section">
        <h3>{changes.length ? 'Changes to your Halo' : 'No changes needed'}</h3>
        {changes.length ? (
          <ul className="diff">
            {changes.map((s) => (
              <li key={s.id} className={s.action === 'create' ? 'add' : 'change'}>
                <span className="sign">{s.action === 'create' ? '+' : '~'}</span>
                <div className="what">
                  <b>{title(s, inventory)}</b> <span className="kind">{s.action === 'create' ? `new ${KIND[s.object]}` : KIND[s.object]}</span>
                  <p>{says(s)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="note">Everything this needs is already in your Halo.</p>
        )}
      </section>

      {plan?.unsupported?.length ? (
        <section className="plan-section">
          <h3>Can’t do yet</h3>
          <ul className="diff">
            {plan.unsupported.map((u) => (
              <li key={u} className="cant">
                <span className="sign">!</span>
                <div className="what"><p>{humanise(u, inventory)}</p><small>Not built. Listed so you or your consultant can set it up in Halo.</small></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {coverage.length ? (
        <details className="plan-section">
          <summary>
            <span>Already in your Halo ({coverage.filter((x) => x.status !== 'missing').length} of {coverage.length} found)</span>
            <IconChevron className="chev" size={14} />
          </summary>
          <ul className="diff">
            {coverage.map((x, i) => {
              const k = COVER[x.status] ?? COVER.missing;
              return (
                <li key={i} className={k.cls === 'keep' ? 'keep' : ''}>
                  <span className="sign" style={k.cls !== 'keep' ? { color: `var(--${k.cls})`, background: `var(--${k.cls}-soft)` } : undefined}>{k.sign}</span>
                  <div className="what">
                    <b>{humanise(x.requirement, inventory)}</b> <span className="kind">{k.label.toLowerCase()}</span>
                    {x.existing ? <p>{humanise(x.existing, inventory)}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {plan?.assumptions?.length ? (
        <details className="plan-section">
          <summary>
            <span>Assumptions to check ({plan.assumptions.length})</span>
            <IconChevron className="chev" size={14} />
          </summary>
          <ul className="diff">
            {plan.assumptions.map((a) => (
              <li key={a} className="keep">
                <span className="sign">?</span>
                <div className="what"><p>{humanise(a, inventory)}</p></div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {state === 'ready' && canBuild && planId && target ? (
        <div className="plan-foot plan-foot-build">
          <BuildPanel planId={planId} instanceId={target.instanceId} instanceName={target.instanceName} baseUrl={target.baseUrl} lastApply={target.lastApply} titles={Object.fromEntries(steps.map((x) => [x.id, title(x, inventory)]))} />
        </div>
      ) : (
        <div className="plan-foot">
          <span>Nothing has been written to Halo.</span>
          {state === 'ready' ? (
            <button className="btn btn-primary btn-sm" type="button" disabled title="Building in Halo is part of the paid plans">
              Build in Halo
            </button>
          ) : (
            <StateBadge state={state} questions={plan?.questions?.length} />
          )}
        </div>
      )}
    </details>
  );
}

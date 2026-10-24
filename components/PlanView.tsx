import { describe, type Inv, title } from '@/lib/specflow/describe';
import type { Plan, PlanStep } from '@/lib/specflow/plan-types';

const OBJECT_LABEL: Record<PlanStep['object'], string> = {
  team: 'Team', field: 'Field', sla: 'SLA', approval_process: 'Approval', ticket_type: 'Ticket type', status: 'Status',
  outcome: 'Action', workflow: 'Workflow', agent: 'Agent', approval_group: 'Approval group', field_group: 'Form section',
};
const CHIP: Record<PlanStep['action'], string> = { create: 'create', update: 'update', reuse: 'built' };
const ACTION_LABEL: Record<PlanStep['action'], string> = { create: 'Create', update: 'Change', reuse: 'Reuse' };
const COVER: Record<string, [string, string]> = { built: ['built', 'Already there'], partial: ['update', 'Partly there'], missing: ['gap', 'Missing'] };

/** The full plan review: what exists, what changes (in plain words), what it can't do, questions, assumptions. */
export function PlanView({ plan, errors, inventory }: { plan: Plan | null; errors: string[]; inventory: Inv }) {
  const steps = plan?.steps ?? [];
  const changes = steps.filter((s) => s.action !== 'reuse');
  return (
    <div className="plan-view">
      {errors.length ? (
        <section className="panel">
          <h2>Problems the checks found</h2>
          <p className="muted">This plan didn&apos;t pass the checks after one round of fixes, so it can&apos;t be built as it is. Reply with more detail, or read the instance again if it has changed.</p>
          <ul className="bullets">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </section>
      ) : null}

      {plan?.existing_coverage?.length ? (
        <section className="panel">
          <h2>Already in your Halo</h2>
          <div className="coverage">
            {plan.existing_coverage.map((c, i) => {
              const [chip, label] = COVER[c.status] ?? ['gap', c.status];
              return (
                <div className="row" key={i}>
                  <span className={`chip ${chip}`}>{label}</span>
                  <p>{c.requirement}{c.existing ? <span>{c.existing}</span> : null}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>{changes.length ? `What it will change (${changes.length})` : 'Nothing to change'}</h2>
        {changes.length ? (
          <ul className="change-list">
            {changes.map((s) => (
              <li key={s.id}>
                <span className={`chip ${CHIP[s.action]}`}>{ACTION_LABEL[s.action]}</span>
                <div>
                  <b>{OBJECT_LABEL[s.object]}: {title(s, inventory)}</b>
                  <p className="muted">{plan ? describe(s, plan, inventory) : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Everything this needs is already in your Halo.</p>
        )}
        {steps.length > changes.length ? (
          <details>
            <summary className="muted">Reuses {steps.length - changes.length} existing item{steps.length - changes.length === 1 ? '' : 's'}</summary>
            <p className="muted">{steps.filter((s) => s.action === 'reuse').map((s) => title(s, inventory)).join(', ')}</p>
          </details>
        ) : null}
      </section>

      {plan?.unsupported?.length ? (
        <section className="panel">
          <h2>Can&apos;t do yet</h2>
          <p className="muted">Not built. Listed so your consultant can pick these up.</p>
          <ul className="bullets">{plan.unsupported.map((u) => <li key={u}>{u}</li>)}</ul>
        </section>
      ) : null}

      {plan?.assumptions?.length ? (
        <section className="panel">
          <h2>Assumptions to check</h2>
          <ul className="bullets">{plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}

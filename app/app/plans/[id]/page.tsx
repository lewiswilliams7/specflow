import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Plan, PlanStep } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';

const OBJECT_LABEL: Record<PlanStep['object'], string> = {
  team: 'Team', field: 'Field', sla: 'SLA', approval_process: 'Approval', ticket_type: 'Ticket type', status: 'Status',
  outcome: 'Action', workflow: 'Workflow', agent: 'Agent', approval_group: 'Approval group', field_group: 'Form section',
};
const CHIP: Record<PlanStep['action'], string> = { create: 'create', update: 'update', reuse: 'built' };
const ACTION_LABEL: Record<PlanStep['action'], string> = { create: 'Create', update: 'Update', reuse: 'Reuse' };
const COVER: Record<string, string> = { built: 'built', partial: 'update', missing: 'gap' };

function detail(s: PlanStep): string {
  const bits: string[] = [];
  if (s.type) bits.push(s.type);
  if (s.options?.length) bits.push(s.options.join(', '));
  if (s.based_on) bits.push(`copied from ${s.based_on}`);
  if (s.copy_of) bits.push(`copy of ${s.copy_of}`);
  const inserts = [...(s.insert_steps ?? []), ...(s.set?.insert_steps ?? [])];
  if (inserts.length) bits.push(`new stages: ${inserts.map((i) => i.name).join(', ')}`);
  if (s.targets) bits.push(Object.entries(s.targets).map(([k, v]) => `${k} ${v}`).join(', '));
  if (s.resolve_days) bits.push(`${s.resolve_days} days`);
  if (s.approvers?.length) bits.push(`${s.approvers.length} approval stage${s.approvers.length === 1 ? '' : 's'}`);
  if (s.set) bits.push(`changes: ${Object.keys(s.set).join(', ')}`);
  return bits.join(' · ');
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await getContext();
  const { data: row } = await supabase
    .from('plans')
    .select('id, request, plan, errors, model, created_at, instance_id, instances(name)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!row) notFound();
  const plan = row.plan as Plan | null;
  const errors = (row.errors as string[]) ?? [];
  const steps = plan?.steps ?? [];
  const toBuild = steps.filter((s) => s.action !== 'reuse');

  return (
    <>
      <div>
        <p className="muted"><Link href={`/app/instances/${row.instance_id}`}>← {(row.instances as unknown as { name: string } | null)?.name}</Link></p>
        <h1>Plan</h1>
        <p className="muted">{new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · nothing has been written to Halo</p>
      </div>

      <section className="panel">
        <h2>Request</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{row.request}</p>
      </section>

      {errors.length ? (
        <section className="panel">
          <h2>Problems the checks found</h2>
          <p className="muted">The plan didn&apos;t pass Specflow&apos;s checks after one round of fixes, so it can&apos;t be built as it is. Try rewording the request, or read the instance again if it has changed.</p>
          <ul className="bullets">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </section>
      ) : null}

      {plan?.existing_coverage?.length ? (
        <section className="panel">
          <h2>Already in your Halo</h2>
          <div className="coverage">
            {plan.existing_coverage.map((c, i) => (
              <div className="row" key={i}>
                <span className={`chip ${COVER[c.status] ?? 'gap'}`}>{c.status}</span>
                <p>{c.requirement}{c.existing ? <span>{c.existing}</span> : null}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Will build ({toBuild.length} change{toBuild.length === 1 ? '' : 's'}, {steps.length - toBuild.length} reused)</h2>
        <div className="table-scroll">
          <table className="plan-steps">
            <thead>
              <tr><th>Action</th><th>What</th><th>Name</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.id}>
                  <td><span className={`chip ${CHIP[s.action]}`}>{ACTION_LABEL[s.action]}</span></td>
                  <td>{OBJECT_LABEL[s.object] ?? s.object}</td>
                  <td>{s.name ?? s.match?.name}{s.label && s.label !== s.name ? <div className="muted">{s.label}</div> : null}</td>
                  <td className="muted">{detail(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {plan?.unsupported?.length ? (
        <section className="panel">
          <h2>Can&apos;t do yet</h2>
          <p className="muted">Not built. Listed so your consultant can pick these up.</p>
          <ul className="bullets">{plan.unsupported.map((u) => <li key={u}>{u}</li>)}</ul>
        </section>
      ) : null}

      {plan?.questions?.length ? (
        <section className="panel">
          <h2>Questions</h2>
          <ul className="bullets">{plan.questions.map((q) => <li key={q}>{q}</li>)}</ul>
        </section>
      ) : null}

      {plan?.assumptions?.length ? (
        <section className="panel">
          <h2>Assumptions to check</h2>
          <ul className="bullets">{plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      ) : null}

      <section className="panel">
        <h2>Build</h2>
        <p className="muted">Building from the app opens with our partner pilots. It will show a preview of every change and write nothing unless that preview is clean.</p>
        <button className="btn btn-ghost" type="button" disabled>Preview and build (coming with pilots)</button>
      </section>
    </>
  );
}

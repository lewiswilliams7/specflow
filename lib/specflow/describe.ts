/** Plain-English descriptions of plan steps, using the instance's own labels instead of internal names. */
import type { Plan, PlanStep } from './plan-types';

type Details = {
  custom_fields?: Record<string, string>;
  ticket_types?: Record<string, { groups?: Record<string, string[]> }>;
};
export type Inv = { details?: Details } | null;

const OBJECT: Record<PlanStep['object'], string> = {
  team: 'team', field: 'field', sla: 'SLA', approval_process: 'approval process', ticket_type: 'ticket type', status: 'status',
  outcome: 'action', workflow: 'workflow', agent: 'agent', approval_group: 'approval group', field_group: 'form section',
};

/** "CFhardware" → "Hardware" (its label on this instance), falling back to the name. */
export function fieldLabel(inv: Inv, name?: string): string {
  if (!name) return '';
  const d = inv?.details?.custom_fields?.[name];
  return d?.match(/^"([^"]*)"/)?.[1] || name;
}

/** Ticket types whose form includes this section. */
export function sectionUsedBy(inv: Inv, section?: string): string[] {
  if (!section) return [];
  return Object.entries(inv?.details?.ticket_types ?? {})
    .filter(([, t]) => Object.keys(t.groups ?? {}).some((g) => g.toLowerCase() === section.toLowerCase()))
    .map(([n]) => n);
}

export function title(step: PlanStep, inv: Inv): string {
  const name = step.name ?? step.match?.name ?? '';
  if (step.object === 'field') return step.action === 'create' ? step.label || name : fieldLabel(inv, name) || step.label || name;
  return name;
}

export function describe(step: PlanStep, plan: Plan, inv: Inv): string {
  const ref = (id?: string) => {
    const s = plan.steps.find((x) => x.id === id);
    if (!s) return id ?? '';
    return s.object === 'field' ? (s.action === 'create' ? s.label || s.name || '' : fieldLabel(inv, s.match?.name ?? s.name)) : s.name ?? s.match?.name ?? '';
  };
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const out: string[] = [];

  if (step.action === 'reuse') return `Uses the existing ${OBJECT[step.object]}.`;

  if (step.action === 'create') {
    switch (step.object) {
      case 'field':
        out.push(`New ${step.type ?? ''} field "${step.label ?? step.name}"`.replace('  ', ' '));
        if (step.options?.length) out.push(`options: ${list(step.options)}`);
        break;
      case 'field_group':
        out.push(`New section "${step.label ?? step.name}" with ${list((step.fields ?? []).map((f) => `${ref(f.ref)}${f.mandatory ? ' (required)' : ''}`)) || 'no fields'}`);
        break;
      case 'approval_process':
        out.push(`Approval in ${step.approvers?.length ?? 0} stage${step.approvers?.length === 1 ? '' : 's'}: ${list((step.approvers ?? []).map((a) => ('group' in a ? `${ref(a.group)}${a.min ? ` (${a.min} needed)` : ''}` : 'agent' in a ? ref(a.agent) : 'line_manager' in a ? 'line manager' : 'chosen by the agent')))}`);
        break;
      case 'sla':
        out.push(step.targets ? `Targets: ${Object.entries(step.targets).map(([k, v]) => `${k} ${v}`).join(', ')}` : `Resolve within ${step.resolve_days} days`);
        break;
      case 'workflow':
        out.push(`Copy of "${step.copy_of}"${step.insert_steps?.length ? `, adding stages ${list(step.insert_steps.map((i) => `"${i.name}"`))}` : ''}`);
        break;
      case 'ticket_type':
        out.push(`New ticket type${step.based_on ? ` copied from "${step.based_on}"` : ''}${step.fields?.length ? `, fields ${list(step.fields.map((f) => `${ref(f.ref)}${f.mandatory ? ' (required)' : ''}`))}` : ''}${step.groups?.length ? `, sections ${list(step.groups.map(ref))}` : ''}${step.team ? `, team ${ref(step.team)}` : ''}${step.sla ? `, SLA ${ref(step.sla)}` : ''}${step.approval ? `, approval ${ref(step.approval)}` : ''}`);
        break;
      case 'status':
        out.push(`New status${step.sla_action === 'hold' ? ' that pauses the SLA' : ''}`);
        break;
      case 'outcome':
        out.push(`New action button${step.new_status ? ` that sets the status to ${ref(step.new_status)}` : ''}`);
        break;
      case 'team':
      case 'approval_group':
        out.push(`Members: ${list((step.members ?? []).map(ref)) || 'none'}${step.approvals_needed ? `; ${step.approvals_needed} approval needed` : ''}`);
        break;
      default:
        out.push(`New ${OBJECT[step.object]}`);
    }
    return out.join('; ') + '.';
  }

  // update
  const st = step.set ?? {};
  for (const f of st.field_mandatory ?? []) out.push(`make ${ref(f.ref)} ${f.mandatory ? 'required' : 'optional'}`);
  for (const f of st.add_fields ?? []) out.push(`add ${ref(f.ref)}${f.mandatory ? ' (required)' : ''}`);
  for (const g of st.add_groups ?? []) out.push(`add the section ${ref(g)}`);
  if (st.team) out.push(`set the team to ${ref(st.team)}`);
  if (st.sla) out.push(`set the SLA to ${ref(st.sla)}`);
  if (st.approval) out.push(`set the approval to ${ref(st.approval)}`);
  if (st.workflow) out.push(`set the workflow to ${ref(st.workflow)}`);
  if (st.add_options?.length) out.push(`add options ${list(st.add_options)}`);
  if (st.label) out.push(`rename to "${st.label}"`);
  if (st.add_members?.length) out.push(`add ${list(st.add_members.map(ref))}`);
  if (st.sla_action === 'hold') out.push('pause the SLA while in this status');
  if (st.insert_steps?.length) out.push(`add stages ${list(st.insert_steps.map((i) => `"${i.name}"`))}`);
  if (st.department_of) out.push(`move to the same department as ${ref(st.department_of)}`);
  let text = out.length ? out.join('; ') : 'Update';
  text = text.charAt(0).toUpperCase() + text.slice(1) + '.';
  if (step.object === 'field_group') {
    const users = sectionUsedBy(inv, step.match?.name);
    if (users.length > 1) text += ` This section is also on ${list(users)}: they change too.`;
  }
  return text;
}

export function counts(plan: Plan | null) {
  const steps = plan?.steps ?? [];
  return {
    changes: steps.filter((s) => s.action !== 'reuse').length,
    reused: steps.filter((s) => s.action === 'reuse').length,
    cant: plan?.unsupported?.length ?? 0,
    questions: plan?.questions?.length ?? 0,
  };
}

/** Swap internal field names in planner text for their labels: "CFhardwareRequired" → "Do you require hardware…". */
export function humanise(text: string, inv: Inv): string {
  return text.replace(/\bCF[A-Za-z0-9_]+\b/g, (name) => {
    const label = fieldLabel(inv, name);
    return label === name ? name : `“${label}”`;
  });
}

export type PlanDiff = { added: string[]; removed: string[]; changed: string[] };

/** What changed between two versions of a plan, in plain words. Steps are matched by what they touch, not by id. */
export function diffPlans(before: Plan | null, after: Plan | null, inv: Inv): PlanDiff | null {
  if (!before || !after) return null;
  // Keyed by action too: a plan can create a ticket type and then update it (e.g. to set its workflow).
  const key = (s: PlanStep) => `${s.object}:${(s.name ?? s.match?.name ?? '').toLowerCase()}:${s.action}`;
  // Compare what the step says in plain words (refs resolved to names), so a swapped team or SLA shows as a change.
  const said = (s: PlanStep, plan: Plan) => `${title(s, inv)}|${describe(s, plan, inv)}`;
  const label = (s: PlanStep) => `${OBJECT[s.object]} ${title(s, inv)}`.replace(/^./, (c) => c.toUpperCase());
  const was = new Map(before.steps.filter((s) => s.action !== 'reuse').map((s) => [key(s), s]));
  const now = new Map(after.steps.filter((s) => s.action !== 'reuse').map((s) => [key(s), s]));
  const diff: PlanDiff = { added: [], removed: [], changed: [] };
  for (const [k, s] of now) {
    const old = was.get(k);
    if (!old) diff.added.push(label(s));
    else if (said(old, before) !== said(s, after)) diff.changed.push(label(s));
  }
  for (const [k, s] of was) if (!now.has(k)) diff.removed.push(label(s));
  return diff;
}

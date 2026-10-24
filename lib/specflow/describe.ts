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
  email_template: 'email template', ticket_rule: 'ticket rule', ticket_template: 'child ticket template',
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

/** One new stage, with where it sits and the buttons in and out: "Pre-checks" after Request Fulfilment (in: Checks Done; out: Resolve Ticket to Closed). */
export function stageText(ins: { name: string; after_step: string; enter_via: string; exits: { via: string; to_step: string }[] }, ref: (id?: string) => string): string {
  const outs = ins.exits.map((e) => `${ref(e.via)} to ${e.to_step}`).join(', ');
  return `"${ins.name}" after ${ins.after_step} (in: ${ref(ins.enter_via)}; out: ${outs || 'none'})`;
}

export function describe(step: PlanStep, plan: Plan, inv: Inv): string {
  const ref = (id?: string) => {
    const s = plan.steps.find((x) => x.id === id);
    if (!s) return id ?? '';
    return s.object === 'field' ? (s.action === 'create' ? s.label || s.name || '' : fieldLabel(inv, s.match?.name ?? s.name)) : s.name ?? s.match?.name ?? '';
  };
  const stageWho = (a: NonNullable<PlanStep['approvers']>[number]) =>
    'group' in a ? `${ref(a.group)}${a.min ? ` (${a.min} needed)` : ''}` : 'agent' in a ? ref(a.agent) : 'line_manager' in a ? 'line manager' : 'rules' in a ? `${a.rules.map((r) => `${ref(r.group ?? r.agent)} if ${ref(r.field)} is "${r.equals}"`).join(', ')} (otherwise approved automatically)` : 'chosen by the agent';
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
        out.push(`Approval in ${step.approvers?.length ?? 0} stage${step.approvers?.length === 1 ? '' : 's'}: ${list((step.approvers ?? []).map(stageWho))}`);
        break;
      case 'sla':
        out.push(step.targets ? `Targets: ${Object.entries(step.targets).map(([k, v]) => `${k} ${v}`).join(', ')}` : `Resolve within ${step.resolve_days} days`);
        break;
      case 'workflow':
        out.push(`Copy of "${step.copy_of}"${step.insert_steps?.length ? `, adding ${step.insert_steps.map((i) => stageText(i, ref)).join('; ')}` : ''}`);
        break;
      case 'ticket_type':
        out.push(`New ticket type${step.based_on ? ` copied from "${step.based_on}"` : ''}${step.fields?.length ? `, fields ${list(step.fields.map((f) => `${ref(f.ref)}${f.mandatory ? ' (required)' : ''}`))}` : ''}${step.groups?.length ? `, sections ${list(step.groups.map(ref))}` : ''}${step.team ? `, team ${ref(step.team)}` : ''}${step.sla ? `, SLA ${ref(step.sla)}` : ''}${step.approval ? `, approval ${ref(step.approval)}` : ''}`);
        break;
      case 'status':
        out.push(`New status${step.sla_action === 'hold' ? ' that pauses the SLA' : ''}`);
        break;
      case 'outcome':
        out.push(`New action button${step.new_status ? ` that sets the status to ${ref(step.new_status)}` : ''}${step.send_email ? ` and emails the requester "${ref(step.send_email)}"` : ''}`);
        break;
      case 'email_template':
        out.push(`New email template, subject "${step.subject ?? step.name}"`);
        break;
      case 'ticket_rule': {
        const when = (step.when ?? []).map((c) => ('ticket_type' in c ? `the ticket type is ${ref(c.ticket_type)}` : `${ref(c.field)} is "${c.equals}"`));
        const t = step.then ?? {};
        const then = [t.team && `team ${ref(t.team)}`, t.agent && `agent ${ref(t.agent)}`, t.priority && `priority ${t.priority}`].filter(Boolean) as string[];
        out.push(`When ${list(when) || 'any ticket'}, set ${list(then) || 'nothing'}`);
        break;
      }
      case 'ticket_template':
        out.push(`Each ${ref(step.attach_to)} raises ${list((step.children ?? []).map((c) => `"${c.summary}" (${ref(c.ticket_type)}${c.team ? `, ${ref(c.team)}` : ''})`)) || 'no child tickets'}`);
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
  if (st.insert_steps?.length) out.push(`add ${st.insert_steps.map((i) => stageText(i, ref)).join('; ')}. Old buttons that skipped past a new stage now lead into it (rule W5)`);
  if (st.department_of) out.push(`move to the same department as ${ref(st.department_of)}`);
  if (st.add_stages?.length) out.push(`add ${st.add_stages.length === 1 ? 'a final stage' : 'final stages'}: ${list(st.add_stages.map(stageWho))}`);
  for (const c of st.add_actions ?? []) out.push(`add a "${ref(c.via)}" button on ${c.step} that goes to ${c.to_step}`);
  for (const c of st.retarget_actions ?? []) out.push(`make "${ref(c.via)}" on ${c.step} go to ${c.to_step}`);
  if (st.send_email) out.push(`email the requester "${ref(st.send_email)}" when it's pressed`);
  for (const c of st.show_section_when ?? []) out.push(`show the section ${ref(c.group)} only when ${ref(c.field)} is ${list(c.equals.map((e) => `"${e}"`))}`);
  if (st.subject) out.push(`set the subject to "${st.subject}"`);
  if (st.body) out.push('change the body');
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

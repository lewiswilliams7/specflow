/** Plain-English descriptions of plan steps, using the instance's own labels instead of internal names. */
import { SQL_LISTS } from './build/translators';
import type { Plan, PlanStep } from './plan-types';

type Details = {
  custom_fields?: Record<string, string>;
  ticket_types?: Record<string, { groups?: Record<string, string[]> }>;
};
export type Inv = { details?: Details } | null;

const OBJECT: Record<PlanStep['object'], string> = {
  team: 'team', field: 'field', sla: 'SLA', approval_process: 'approval process', ticket_type: 'ticket type', status: 'status',
  outcome: 'action', workflow: 'workflow', agent: 'agent', approval_group: 'approval group', field_group: 'form section',
  email_template: 'email template', ticket_rule: 'ticket rule', ticket_template: 'child ticket template', category: 'category', notification: 'agent notification',
  service: 'service', service_category: 'service category', user: 'user', site: 'site', organisation: 'organisation', working_hours: 'working hours', holiday: 'bank holiday', canned_text: 'canned text', lookup_value: 'list value', kb_article: 'knowledge base article', faq_list: 'FAQ list', role: 'role', asset_type: 'asset type', asset_group: 'asset group',
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

/** One sentence for a step. */
export function describe(step: PlanStep, plan: Plan, inv: Inv): string {
  const parts = describeParts(step, plan, inv);
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

/** Every change a step makes, one per line, so the plan can show them in full. */
export function describeParts(step: PlanStep, plan: Plan, inv: Inv): string[] {
  const ref = (id?: string) => {
    const s = plan.steps.find((x) => x.id === id);
    if (!s) return id ?? '';
    return s.object === 'field' ? (s.action === 'create' ? s.label || s.name || '' : fieldLabel(inv, s.match?.name ?? s.name)) : s.name ?? s.match?.name ?? '';
  };
  const stageWho = (a: NonNullable<PlanStep['approvers']>[number]) =>
    'group' in a ? `${ref(a.group)}${a.min ? ` (${a.min} needed)` : ''}` : 'agent' in a ? ref(a.agent) : 'line_manager' in a ? 'line manager' : 'rules' in a ? `${a.rules.map((r) => `${ref(r.group ?? r.agent)} if ${ref(r.field)} is "${r.equals}"`).join(', ')} (otherwise approved automatically)` : 'chosen by the agent';
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const out: string[] = [];

  if (step.action === 'reuse') return [`uses the existing ${OBJECT[step.object]}`];

  if (step.action === 'create') {
    switch (step.object) {
      case 'field':
        out.push(`New ${step.type ?? ''} field "${step.label ?? step.name}"`.replace('  ', ' '));
        if (step.options?.length) out.push(`options: ${list(step.options)}`);
        if (step.dynamic) out.push(`options are a live list from Halo: ${SQL_LISTS[step.dynamic.list]?.what ?? step.dynamic.list} (settings copied from ${ref(step.dynamic.copy_settings_from)})`);
        if (step.hint) out.push(`hint "${step.hint}"`);
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
        out.push(`New ticket type${step.based_on ? ` copied from "${step.based_on}"` : ''}${step.fields?.length ? `, fields ${list(step.fields.map((f) => `${ref(f.ref)}${f.mandatory ? ' (required)' : ''}${f.hint !== undefined ? ` (help text here: "${f.hint}")` : ''}`))}` : ''}${step.groups?.length ? `, sections ${list(step.groups.map(ref))}` : ''}${step.team ? `, team ${ref(step.team)}` : ''}${step.sla ? `, SLA ${ref(step.sla)}` : ''}${step.approval ? `, approval ${ref(step.approval)}` : ''}`);
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
        const when = (step.when ?? []).map((c) => ('ticket_type' in c ? `the ticket type is ${ref(c.ticket_type)}` : 'impact' in c ? `impact is ${c.impact}` : 'urgency' in c ? `urgency is ${c.urgency}` : `${ref(c.field)} is "${c.equals}"`));
        const t = step.then ?? {};
        const then = [t.team && `team ${ref(t.team)}`, t.agent && `agent ${ref(t.agent)}`, t.priority !== undefined && `priority level ${t.priority}`, t.category && `category ${ref(t.category)}`].filter(Boolean) as string[];
        out.push(`When ${list(when) || 'any ticket'}, set ${list(then) || 'nothing'}`);
        break;
      }
      case 'category':
        out.push(`New category ${String(step.name ?? '').split('>').map((x) => x.trim()).join(' › ')}`);
        break;
      case 'notification': {
        const ev: Record<string, string> = { new_ticket: 'a new ticket is logged', new_ticket_for_team: 'a new ticket is logged to their team', p1_logged: 'a P1 ticket is logged', updated_by_user: 'the user updates a ticket', reassigned: 'a ticket is re-assigned', mentioned: 'they are mentioned' };
        const who = [step.team ? `the ${ref(step.team)} team's members` : '', ...(step.agents ?? []).map(ref)].filter(Boolean);
        const scope = (step.when ?? []).map((c) => ('ticket_type' in c ? ref(c.ticket_type) : 'field' in c ? `${ref(c.field)} is "${c.equals}"` : '')).filter(Boolean);
        out.push(`${step.by === 'email' ? 'Emails' : 'Pop-up for'} ${list(who) || 'nobody'} when ${ev[step.event ?? ''] ?? step.event}${scope.length ? `, only for ${list(scope)}` : ''}`);
        break;
      }
      case 'service':
        out.push(`New service in ${ref(step.service_category)}, logging ${ref(step.ticket_type)}${step.show_on_portal === false ? ', hidden from the portal' : ', on the portal'}${step.summary ? `: "${step.summary}"` : ''}`);
        break;
      case 'site':
        out.push(`New site for ${ref(step.organisation)}`);
        break;
      case 'user':
        out.push(`New user ${step.email ?? ''} at ${ref(step.site)}`);
        break;
      case 'working_hours':
        out.push(`New working hours${step.start ? `, ${step.start} to ${step.end}` : ''}${step.days?.length ? ` on ${step.days.join(', ')}` : ''}`);
        break;
      case 'holiday':
        out.push(`Bank holiday on ${step.date} for ${ref(step.working_hours)}`);
        break;
      case 'kb_article':
        out.push(`New article in ${ref(step.faq_list)}: "${String(step.body ?? '').slice(0, 80)}${String(step.body ?? '').length > 80 ? '…' : ''}"`);
        break;
      case 'role':
        out.push(`New role with the same permissions as ${ref(step.based_on_role)}`);
        break;
      case 'asset_type':
        out.push(`New asset type in ${ref(step.asset_group)}`);
        break;
      case 'canned_text':
        out.push(`New canned text: "${String(step.text ?? '').slice(0, 80)}${String(step.text ?? '').length > 80 ? '…' : ''}"`);
        break;
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
    return out;
  }

  // update
  const st = step.set ?? {};
  for (const f of st.read_only ?? []) out.push(`make ${ref(f)} read-only`);
  if (st.retire) out.push('retire it (hidden from lists and the portal; nothing deleted)');
  for (const f of st.remove_fields ?? []) out.push(`take ${ref(f)} off the form (the field stays in Halo)`);
  if (st.summary !== undefined) out.push(`summary "${st.summary}"`);
  if (st.ticket_type) out.push(`log ${ref(st.ticket_type)}`);
  if (st.service_category) out.push(`move to ${ref(st.service_category)}`);
  if (st.show_on_portal !== undefined) out.push(st.show_on_portal ? 'show on the portal' : 'hide from the portal');
  for (const f of st.field_mandatory ?? []) out.push(`make ${ref(f.ref)} ${f.mandatory ? 'required' : 'optional'}`);
  for (const f of st.add_fields ?? []) out.push(`add ${ref(f.ref)}${f.mandatory ? ' (required)' : ''}${f.hint !== undefined ? ` with this form's help text "${f.hint}"` : ''}`);
  for (const h of st.field_hints ?? []) out.push(`${ref(h.ref)} help text on this form: "${h.hint}"`);
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
  for (const c of st.show_field_when ?? []) out.push(`show ${ref(c.field)} only when ${ref(c.when)} is "${c.equals}"`);
  if (st.acknowledgement_email) out.push(`email the requester "${ref(st.acknowledgement_email)}" as soon as a ticket is logged (Halo sends it only if the agent account it sends as is verified)`);
  if (st.subject) out.push(`set the subject to "${st.subject}"`);
  if (st.priority !== undefined && step.object === 'ticket_rule') out.push(`set the priority to level ${st.priority}`);
  if (st.body) out.push('change the body');
  if (st.hint !== undefined) out.push(st.hint ? `set the hint to "${st.hint}"` : 'clear the hint');
  if (st.dynamic_list) out.push(`make its options a live list from Halo: ${SQL_LISTS[st.dynamic_list]?.what ?? st.dynamic_list}`);
  for (const r of st.replace_fields ?? []) out.push(`replace ${ref(r.old)} with ${ref(r.new)}, in the same place with the same required setting`);
  // Never a bare "Update": name whatever else it sets.
  if (!out.length) out.push(`change ${Object.keys(st).join(', ').replace(/_/g, ' ') || 'nothing'}`);
  if (step.object === 'field_group') {
    const users = sectionUsedBy(inv, step.match?.name);
    if (users.length > 1) out.push(`this section is also on ${list(users)}: they change too`);
  }
  return out;
}

export function counts(plan: Plan | null) {
  const steps = plan?.steps ?? [];
  return {
    changes: steps.filter((s) => s.action !== 'reuse').length,
    reused: steps.filter((s) => s.action === 'reuse').length,
    cant: plan?.unsupported?.length ?? 0,
    questions: (plan?.questions?.length ?? 0) + (plan?.choices?.length ?? 0),
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

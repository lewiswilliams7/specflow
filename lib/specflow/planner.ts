/**
 * The planner: plain English in, a plan the builder can run out. Ported from the spike's spike/plan.ts
 * (prompt, rules and validator unchanged). Keep the two in step until the builder moves here.
 */
import approvalTest2 from './examples/approval-test-2.json';
import onboarding from './examples/onboarding.json';
import tier1Test2 from './examples/tier1-test-2.json';
import workflowTest from './examples/workflow-test.json';
import type { readInventory } from './inventory';
import { complete, parseJsonReply } from './llm';
import { type Plan, type PlanStep, refsOf } from './plan-types';

export type Inventory = Awaited<ReturnType<typeof readInventory>>;
const EXAMPLES = [onboarding, workflowTest, approvalTest2, tier1Test2];

export type PlanContext = {
  /** The signed-in person: "me" in a request means them. */
  requester?: { email: string; name?: string };
  /** Earlier turns of the conversation, oldest first: the user's messages and short notes of what was planned. */
  history?: { role: 'user' | 'planner'; text: string }[];
  /** The plan from the previous turn, to revise rather than start again. */
  previous?: Plan | null;
};

export function makePlanner(inventory: Inventory, request: string, ctx: PlanContext = {}) {
  const workflowSteps = inventory.workflows_and_their_steps;
  const { details: _details, ...namesOnly } = inventory;
  // Halo's standard (non-CF) fields seen on forms and sections can be reused too, e.g. to make one mandatory.
  const standardFields = [...new Set(
    [...Object.values(inventory.details?.field_groups ?? {}).flat(), ...Object.values(inventory.details?.ticket_types ?? {}).flatMap((t) => [...((t.fields as string[]) ?? []), ...Object.values((t.groups as Record<string, string[]>) ?? {}).flat()])]
      .map((n) => String(n).replace(/\*$/, '')).filter((n) => n && !n.startsWith('CF')),
  )];
  const all = new Set([...Object.values(namesOnly).flatMap((v) => (Array.isArray(v) ? v : Object.keys(v ?? {}))), ...standardFields].map((n) => n.toLowerCase()));
  const slaPriorities = new Set(Object.values(inventory.details?.sla_targets ?? {}).flatMap((t) => String(t).split(', ').map((x) => x.replace(/ \S+$/, '').toLowerCase())));
  const wfActions = inventory.details?.workflow_actions_by_stage ?? {};
  /** Existing names per plan object, for the near-copy check. */
  const NAMES_BY_OBJECT: Record<string, string[]> = {
    ticket_type: inventory.ticket_types, field: inventory.custom_fields, field_group: inventory.field_groups,
    workflow: Object.keys(inventory.workflows_and_their_steps), status: inventory.statuses, outcome: inventory.actions,
    sla: inventory.slas, approval_process: inventory.approval_processes, approval_group: inventory.approval_groups, team: inventory.teams,
  };

  const examples = EXAMPLES.map((e) => JSON.stringify(e)).join('\n\n');

  const SYSTEM = `You plan Halo ITSM configuration changes. You output ONE JSON object (no prose) that a deterministic builder executes after a human approves it.

  THE BUILDER CAN ONLY DO THIS (anything else is unsupported):
  Plan = { "request": string, "existing_coverage": [{ "requirement": string, "status": "built" | "partial" | "missing", "existing": string }], "steps": Step[], "unsupported": string[], "assumptions": string[], "questions": string[] }
  Every step: { "id": unique snake_case, "object": one of below, "action": "create" | "reuse" | "update" }
  - reuse: { "match": { "name": exact existing name from the inventory } }. Use for anything that already exists.
  - create needs "name". Optional "based_on": exact name of an existing record of the same kind to copy settings from (choose a sensible, plain one; say which in assumptions).
  Objects and their create properties:
  - field: name "CF"+PascalCase (unique, not in inventory), label, type: text|memo|date|dropdown|checkbox|multiselect, options: string[] (dropdown/multiselect only)
  - field_group: name, label (section header), fields: [{ref, mandatory?}]
  - team: name, members: [agent step refs], department_of: ref of a REUSED team whose department it joins (use with based_on that team). Always set both, or the team lands in a random department.
  - agent: REUSE ONLY (people with licences; never create)
  - approval_group: name, members: [agent refs], approvals_needed: number
  - approval_process: name, approvers: ordered list, each ONE of {"group": ref, "min": n} | {"agent": ref} | {"line_manager": true} | {"adhoc": true}
  - sla: name, and EITHER resolve_days: number (same target for every priority) OR targets: { "<priority name>": "4h" | "2d" } (per-priority)
  - status: create { name, sla_action: "hold" to pause the SLA while in it } or reuse an existing status by name
  - outcome (an action button): name, new_status: status ref (optional; set one when the action should move the ticket out of a hold status), icon: Font Awesome name (optional, default arrow-right)
  - workflow: name, copy_of: exact existing workflow name, optional insert_steps: [{ name, after_step: a step of copy_of or an EARLIER inserted step, enter_via: outcome ref (the action on after_step that moves into the new step), exits: [{ via: outcome ref, to_step: step name }] }] to chain several new stages in order. The last new stage needs an exit (e.g. to Closed). Existing steps cannot be renamed or removed.
  - ticket_type: create: name, based_on, fields: [{ref, mandatory?}], groups: [field_group refs], team: team ref, sla: sla ref, approval: approval_process ref. A ticket type created in this plan can be updated later in the same plan (e.g. to set a workflow created after it).
    Its form = exactly the fields and groups you list, plus Halo's standard fields. based_on does NOT bring the source's sections: reuse those field groups and list them. (Listing none at all keeps the source's form unchanged.)
  UPDATES TO THINGS THAT ALREADY EXIST (action "update", "match": { "name": existing name }, "set": {...}). Prefer these over creating anything new:
  - ticket_type set: { team?: ref, sla?: ref, approval?: ref, workflow?: ref, add_groups?: [field_group refs], add_fields?: [{ref, mandatory?}], field_mandatory?: [{ref, mandatory: true|false}] } (field_mandatory = fields placed directly on the form, not inside a group)
  - field_group set: { add_fields?: [{ref, mandatory?}], field_mandatory?: [{ref, mandatory}] }
  - field set: { add_options?: string[], label?: string } (add missing dropdown/multi-select options; existing options stay)
  - workflow set: { insert_steps: [ same shape as above ] } adds stages to the EXISTING workflow in place. Use it when the request is to change that workflow; copy a workflow only when a new, separate one is wanted.
  - status set: { sla_action: "hold" }
  - team set: { department_of?: ref, add_members?: [agent refs] }
  - approval_group set: { add_members: [agent refs] }
  Not updatable: removing anything, renaming or removing workflow steps, changing approval process stages (create a new process instead), changing a field's type.
  Refs are step ids and must be defined by an EARLIER step (reuse or create).

  RULES
  - FIRST compare the request with the inventory, part by part (each ticket type, its fields, team, approvals, SLA, workflow), and fill existing_coverage. The customer's Halo is rarely empty.
    inventory.details holds the SETTINGS: for each ticket type its team, SLA, approval, workflow and form (fields with * are mandatory); each custom field's label, type and options; field group contents; statuses that pause the SLA; approval group members; approval process stages; SLA targets per priority. Decide from these, don't guess: if details show it, it is a fact, not a question.
    Match by meaning, not exact name: an approval group with the same members, a field with the same label and options, a team with the same people already exists.
    - built: it already exists as asked. Reuse it; add NO steps for it.
    - partial: it exists but is missing something. Reuse it and add only the missing pieces (or an update step).
    - missing: create it.
    Never create a parallel copy of something that exists ("v2", "(People Ops)", "New ..."): update it. If the change isn't updatable, say so in unsupported.
    A field matches only if its name/label fits the request; when unsure it has the right options, ask in questions rather than reuse silently.
  - Reuse what exists (exact names from the inventory), but only when it matches what the request asks for. Never create something whose name matches an existing one ignoring case (CFLaptopType vs CFlaptopType). Never invent names of existing things: anything not in the inventory must be created by an earlier step.
  - When the request describes stages a ticket moves through, build them: copy a workflow and add the stages with insert_steps.
  - based_on must name an EXISTING record, never the thing being created. Never invent agents, teams, workflows or step names that aren't in the inventory unless you create them.
  - If the request needs something not listed above (e.g. conditional field visibility, auto-assignment rules, email templates, notifications, child tickets, categories, renaming or removing existing workflow steps, rules based on field values (routing, priority, skipping approval), roles/permissions, reports), DO NOT approximate it: describe it plainly in "unsupported" and build only the supported parts.
  - Line-manager approval only works if the instance syncs managers from Active Directory / Entra (rule P6: Halo users' managers can't be set by hand). If you use {"line_manager": true}, ask in questions whether they sync managers from AD, and say the fallback (a named approver or group) in assumptions.
  - Fields: a requirement already met by a field on the form or in a section (standard Halo fields like symptom, risk or fbackoutplan count) is met: reuse that field and use field_mandatory to make it required. Never add a second field with the same meaning.
  - Ticket types: if an existing type already covers a requested type (e.g. "Change Request" for normal changes), update it; create a new type only for a genuinely separate one.
  - Workflow stages: match by meaning ("Implementing" = an existing "In Progress" stage). An inserted stage's enter_via must be an action NOT already on its after_step (inventory.details.workflow_actions_by_stage lists them); create a new action for it.
  - SLA targets: use only priority names that appear in inventory.details.sla_targets.
  - Every object you create must be used by a later step (an approval process attached to a ticket type, a field placed on a form...). Don't create things "for later": put that in questions.
  - The requester is the person writing the request. "me", "I", "my" mean them: their Halo agent is the one whose email (inventory.details.agent_emails) or name matches the requester. If none matches, ask.
- A rule on a number (cost over £300, more than 10 users) can't use a number field yet: capture it as a dropdown of bands ("Under £300", "£300 or more") so the rule has something to test, and put the rule itself in unsupported until conditional approvals are supported.
- Questions: at most 4, only for decisions the customer must make that the inventory can't answer (e.g. a business rule the request leaves open). Never ask about something inventory.details shows. Still plan the rest.
  - Be concise in names. Output JSON only.

  EXAMPLE PLANS (hand-written, proven on a real instance):
  ${examples}`;

  const who = ctx.requester ? `REQUESTER: ${ctx.requester.name ? `${ctx.requester.name}, ` : ''}${ctx.requester.email}\n\n` : '';
  const convo = ctx.history?.length
    ? `CONVERSATION SO FAR (oldest first):\n${ctx.history.map((h) => `${h.role === 'user' ? 'USER' : 'PLANNER'}: ${h.text}`).join('\n')}\n\n`
    : '';
  const prev = ctx.previous
    ? `PREVIOUS PLAN (revise it to reflect the LATEST message; return the complete updated plan, keep what still applies):\n${JSON.stringify(ctx.previous)}\n\n`
    : '';
  const userMsg = (extra = '') => `INSTANCE INVENTORY (what already exists on this Halo):
${JSON.stringify(inventory)}

${who}${convo}${prev}${ctx.history?.length ? 'LATEST MESSAGE' : 'REQUEST'}:
${request}
${extra}`;

  const OBJECTS = new Set(['team', 'field', 'sla', 'approval_process', 'ticket_type', 'status', 'outcome', 'workflow', 'agent', 'approval_group', 'field_group']);
  function validate(plan: Plan): string[] {
    const errors: string[] = [];
    if (!Array.isArray(plan.steps)) return ['"steps" must be an array'];
    const seen = new Set<string>();
    const createdHere = new Set<string>();
    for (const s of plan.steps as PlanStep[]) {
      const where = `step "${s.id}"`;
      if (!s.id) errors.push('a step has no id');
      if (seen.has(s.id)) errors.push(`${where}: duplicate id`);
      if (!OBJECTS.has(s.object)) errors.push(`${where}: unknown object "${s.object}"`);
      if (!['create', 'reuse', 'update'].includes(s.action)) errors.push(`${where}: unknown action "${s.action}"`);
      if (s.action === 'create' && !s.name) errors.push(`${where}: create needs a name`);
      if (s.object === 'agent' && s.action === 'create') errors.push(`${where}: agents can only be reused`);
      if (s.action === 'update' && !s.set) errors.push(`${where}: update needs "set"`);
      if ((s.action === 'reuse' || s.action === 'update') && !all.has(String(s.match?.name ?? '').toLowerCase()) && !createdHere.has(`${s.object}:${String(s.match?.name ?? '').toLowerCase()}`))
        errors.push(`${where}: "${s.match?.name}" is not in the inventory`);
      if (s.based_on && !all.has(s.based_on.toLowerCase())) errors.push(`${where}: based_on "${s.based_on}" is not in the inventory`);
      if (s.based_on && s.name && s.based_on.toLowerCase() === s.name.toLowerCase()) errors.push(`${where}: based_on is the thing being created; pick an existing record to copy from`);
      // A new field whose label means the same as an existing field's label is a duplicate (CFEmergencyReason vs CFemergencyChangeReason).
      if (s.object === 'field' && s.action === 'create' && s.label) {
        const stem = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.replace(/(ing|ed|s)$/, '')).join(' ');
        const hit = Object.entries(inventory.details?.custom_fields ?? {}).find(([, d]) => stem(String(d).match(/^"([^"]*)"/)?.[1] ?? '') === stem(s.label!));
        if (hit) errors.push(`${where}: field "${hit[0]}" already exists with the label "${s.label}": reuse it`);
      }
      const twin = s.action === 'create' && s.name ? (NAMES_BY_OBJECT[s.object] ?? []).find((n) => n.length >= 6 && s.name!.toLowerCase().startsWith(n.toLowerCase()) && s.name!.length > n.length) : undefined;
      if (twin) errors.push(`${where}: "${s.name}" is a copy of the existing "${twin}": update "${twin}" instead`);
      if ((plan.questions?.length ?? 0) > 4 && s === plan.steps[0]) errors.push(`${plan.questions!.length} questions: keep at most 4, and drop any that inventory.details answers`);
      if (s.action === 'create' && s.name && / v\d+$|\(copy\)|\bcopy of\b/i.test(s.name))
        errors.push(`${where}: "${s.name}" looks like a copy of something that exists; reuse or update the original, or explain in questions`);
      if (s.action === 'create' && s.name && all.has(s.name.toLowerCase()))
        errors.push(`${where}: "${s.name}" already exists (names are case-insensitive): reuse it, or pick a different name`);
      if (s.copy_of && !workflowSteps[s.copy_of]) errors.push(`${where}: copy_of "${s.copy_of}" is not an existing workflow`);
      const inserts = [...(s.insert_steps ?? []), ...(s.insert_step ? [s.insert_step] : []), ...(s.set?.insert_steps ?? [])];
      const baseWf = s.copy_of ?? (s.object === 'workflow' && s.action === 'update' ? s.match?.name : undefined);
      if (inserts.length && baseWf && workflowSteps[baseWf]) {
        const stepsOf = workflowSteps[baseWf].map((n) => n.toLowerCase());
        for (const ins of inserts) if (stepsOf.includes(ins.name.toLowerCase())) errors.push(`${where}: "${baseWf}" already has a stage "${ins.name}"`);
        for (const ins of inserts) {
          if (!stepsOf.includes(String(ins.after_step).toLowerCase())) errors.push(`${where}: "${ins.after_step}" is not a step of "${baseWf}" (or an earlier inserted step)`);
          stepsOf.push(ins.name.toLowerCase()); // an exit may stay on the new step itself (e.g. Equipment Ordered)
          for (const n of ins.exits.map((e) => e.to_step))
            if (!stepsOf.includes(String(n).toLowerCase())) errors.push(`${where}: "${n}" is not a step of "${baseWf}" (or an earlier inserted step)`);
        }
      }
      for (const r of refsOf(s)) if (!seen.has(r)) errors.push(`${where}: uses "${r}" before it is defined`);
      for (const prio of Object.keys(s.targets ?? {}))
        if (slaPriorities.size && !slaPriorities.has(prio.toLowerCase())) errors.push(`${where}: SLA priority "${prio}" isn't on this instance's SLAs (${[...slaPriorities].join(', ')})`);
      if (baseWf && wfActions[baseWf]) {
        for (const ins of inserts) {
          const onStep = (wfActions[baseWf][ins.after_step] ?? []).map((a: string) => a.split(' → ')[0].toLowerCase());
          const via = plan.steps.find((x) => x.id === ins.enter_via);
          const viaName = String(via?.name ?? via?.match?.name ?? '').toLowerCase();
          if (viaName && onStep.includes(viaName)) errors.push(`${where}: "${via?.name ?? via?.match?.name}" is already an action on "${ins.after_step}"; create a new action to enter "${ins.name}"`);
        }
      }
      seen.add(s.id);
      if (s.action === 'create' && s.name) createdHere.add(`${s.object}:${s.name.toLowerCase()}`);
    }
    // Every created object (except ticket types, the end product) must be used by a later step.
    const used = new Set((plan.steps as PlanStep[]).flatMap((x) => refsOf(x)));
    for (const s of plan.steps as PlanStep[])
      if (s.action === 'create' && s.object !== 'ticket_type' && !used.has(s.id)) errors.push(`step "${s.id}": "${s.name}" is created but nothing uses it; attach it or drop it (ask in questions instead)`);
    return errors;
  }
  return { SYSTEM, userMsg, validate };
}

export type PlanResult = { plan: Plan | null; errors: string[]; model: string };

/** Ask the model, check the plan, send the problems back once for a fix. Never touches Halo. */
export async function generatePlan(inventory: Inventory, request: string, ctx: PlanContext = {}): Promise<PlanResult> {
  const { SYSTEM, userMsg, validate } = makePlanner(inventory, request, ctx);
  let plan: Plan | null = null;
  let errors: string[] = [];
  let model = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = await complete(
      SYSTEM,
      userMsg(attempt === 1 ? '' : `\nYOUR PREVIOUS PLAN HAD THESE ERRORS, return a corrected full plan:\n- ${errors.join('\n- ')}\n\nPREVIOUS PLAN:\n${JSON.stringify(plan)}`),
    );
    model = reply.model;
    try {
      plan = parseJsonReply<Plan>(reply.text);
    } catch {
      errors = ['The planner reply was not valid JSON.'];
      continue;
    }
    errors = validate(plan);
    if (!errors.length) break;
  }
  if (plan) plan.request = ctx.history?.length ? `${ctx.history.find((h) => h.role === 'user')?.text ?? ''}\n\n(Latest: ${request})` : request;
  return { plan, errors, model };
}

/**
 * The planner: plain English in, a plan the builder can run out. Ported from the spike's spike/plan.ts
 * (prompt, rules and validator unchanged). Keep the two in step until the builder moves here.
 */
import approvalTest2 from './examples/approval-test-2.json';
import onboarding from './examples/onboarding.json';
import tier1Test2 from './examples/tier1-test-2.json';
import workflowTest from './examples/workflow-test.json';
import type { readInventory } from './inventory';
import { formRequest, splitForms } from './forms';
import { complete, parseJsonReply } from './llm';
import { mandatoryEverywhere, planChecks } from './plan-checks';
import { type Plan, type PlanStep, notReadyFeatureNames, readyFeaturePrompt, refsOf } from './plan-types';

const PLAN_OBJECTS = ['team', 'field', 'sla', 'approval_process', 'ticket_type', 'status', 'outcome', 'workflow', 'agent', 'approval_group', 'field_group', 'email_template', 'ticket_rule', 'ticket_template', 'category', 'notification', 'service', 'service_category', 'user', 'site', 'organisation', 'working_hours', 'holiday', 'canned_text', 'lookup_value', 'kb_article', 'faq_list', 'role', 'asset_type', 'asset_group'];

export type Inventory = Awaited<ReturnType<typeof readInventory>>;
const EXAMPLES = [onboarding, workflowTest, approvalTest2, tier1Test2];

export type PlanContext = {
  /** The signed-in person: "me" in a request means them. */
  requester?: { email: string; name?: string };
  /** Earlier turns of the conversation, oldest first: the user's messages and short notes of what was planned. */
  history?: { role: 'user' | 'planner'; text: string }[];
  /** The plan from the previous turn, to revise rather than start again. */
  previous?: Plan | null;
  /** Questions asked on earlier turns (rule M7: never ask them again). */
  askedBefore?: string[];
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
  /** Priorities each existing SLA has, by SLA name (rule M10). */
  const slaPrioritiesOf = new Map(Object.entries(inventory.details?.sla_targets ?? {}).map(([n, t]) => [n.toLowerCase(), String(t).split(', ').map((x) => x.replace(/ \S+$/, '')).filter(Boolean)]));
  const wfActions = inventory.details?.workflow_actions_by_stage ?? {};
  const alwaysMandatory = mandatoryEverywhere([
    ...Object.values(inventory.details?.field_groups ?? {}),
    ...Object.values(inventory.details?.ticket_types ?? {}).flatMap((t) => [((t.fields as string[]) ?? []), ...Object.values((t.groups as Record<string, string[]>) ?? {})]),
  ] as string[][]);
  /** Existing names per plan object, for the near-copy check. */
  const NAMES_BY_OBJECT: Record<string, string[]> = {
    ticket_type: inventory.ticket_types, field: inventory.custom_fields, field_group: inventory.field_groups,
    workflow: Object.keys(inventory.workflows_and_their_steps), status: inventory.statuses, outcome: inventory.actions,
    sla: inventory.slas, approval_process: inventory.approval_processes, approval_group: inventory.approval_groups, team: inventory.teams,
    category: (inventory as unknown as { categories?: string[] }).categories ?? [],
    service: (inventory as unknown as { services?: string[] }).services ?? [],
  // Paths in the inventory; plans reuse a category by the last part of its path (SC1).
  service_category: ((inventory as unknown as { service_categories?: string[] }).service_categories ?? []).flatMap((p) => [p, p.split(' > ').at(-1)!.trim()]),
  organisation: (inventory as unknown as { organisations?: string[] }).organisations ?? [],
  working_hours: (inventory as unknown as { working_hours?: string[] }).working_hours ?? [],
  canned_text: (inventory as unknown as { canned_text?: string[] }).canned_text ?? [],
  kb_article: (inventory as unknown as { kb_articles?: string[] }).kb_articles ?? [],
  faq_list: (inventory as unknown as { faq_lists?: string[] }).faq_lists ?? [],
  role: (inventory as unknown as { roles?: string[] }).roles ?? [],
  asset_type: (inventory as unknown as { asset_types?: string[] }).asset_types ?? [],
};

  // Names of the same kind of object: "Payroll" the category isn't "Payroll" the ticket type (11 Nov: a plan updated a
  // ticket type that didn't exist, and the fix then refused to create it, both because a category had that name).
  const sameKind = (object: string): Set<string> | null => {
    const names = NAMES_BY_OBJECT[object];
    return names ? new Set((Array.isArray(names) ? names : Object.keys(names ?? {})).map((n) => n.toLowerCase())) : null;
  };
  const exists = (object: string, name: string) => (sameKind(object) ?? all).has(name.toLowerCase());

  const examples = EXAMPLES.map((e) => JSON.stringify(e)).join('\n\n');

  const SYSTEM = `You plan Halo ITSM configuration changes. You output ONE JSON object (no prose) that a deterministic builder executes after a human approves it.

  THE BUILDER CAN ONLY DO THIS (anything else is unsupported):
  Plan = { "request": string, "reply": string, "existing_coverage": [{ "requirement": string, "status": "built" | "partial" | "missing", "existing": string }], "steps": Step[], "unsupported": string[], "assumptions": string[], "questions": string[], "choices": [{ "question": string, "options": string[] }] }
  Every step: { "id": unique snake_case, "object": one of below, "action": "create" | "reuse" | "update" }
  - reuse: { "match": { "name": exact existing name from the inventory } }. Use for anything that already exists.
  - create needs "name". Optional "based_on": exact name of an existing record of the same kind to copy settings from (choose a sensible, plain one; say which in assumptions).
  Objects and their create properties:
  - field: name "CF"+PascalCase (unique, not in inventory), label, type: text|memo|richtext|date|dropdown|checkbox|multiselect (richtext = formatted text, e.g. a design that says "Rich text"), options: string[] (dropdown/multiselect only)
  - field_group: name, label (section header), fields: [{ref, mandatory?}]
  - team: name, members: [agent step refs], department_of: ref of a REUSED team whose department it joins (use with based_on that team). Always set both, or the team lands in a random department.
  - agent: REUSE ONLY (people with licences; never create)
  - approval_group: name, members: [agent refs], approvals_needed: number
  - approval_process: name, approvers: ordered list, each ONE of {"group": ref, "min": n} | {"agent": ref} | {"line_manager": true} | {"adhoc": true} | {"rules": [{"field": ref of a DROPDOWN field step, "equals": one of its options, "group": ref} or {"field", "equals", "agent": ref}]} (a stage whose approver depends on the answer; when no rule matches it approves itself, P7)
  - sla: name, and EITHER resolve_days: number (same target for every priority) OR targets: { "<priority name>": "4h" | "2d" } (per-priority); optional working_hours: working_hours ref (the hours its clock counts, e.g. office hours with bank holidays). To change an existing SLA's hours: sla update set: { working_hours: ref }
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
- workflow set may also have add_actions: [{ step, via: outcome ref, to_step }] to put a button on an EXISTING stage, and retarget_actions: [{ step, via: outcome ref of a button ALREADY on that stage (inventory.details.workflow_actions_by_stage), to_step }] to send it somewhere else (W8). Use these to fix flows: a stage with no way out, or buttons that skip a stage. Removing a button is not supported: list it in unsupported.
  - status set: { sla_action: "hold" }
  - approval_process set: { add_stages: [approvers, same shapes as above] } adds stages at the END of an EXISTING process in place (P8). Use it to add a final approval (including a rules stage); other stage changes aren't supported.
- team set: { department_of?: ref, add_members?: [agent refs] }
  - approval_group set: { add_members: [agent refs] }
${readyFeaturePrompt()}
  Not updatable: removing anything (including buttons on stages), renaming or removing workflow steps, changing or removing existing approval stages (adding at the end is supported), changing a field's type.
  Refs are step ids and must be defined by an EARLIER step (reuse or create).

  RULES
  - FIRST compare the request with the inventory, part by part (each ticket type, its fields, team, approvals, SLA, workflow), and fill existing_coverage. The customer's Halo is rarely empty.
    inventory.details holds the SETTINGS: for each ticket type its team, SLA, approval, workflow and form (fields with * are mandatory); each custom field's label, type and options; field group contents; statuses that pause the SLA; approval group members; approval process stages; SLA targets per priority. Decide from these, don't guess: if details show it, it is a fact, not a question.
    Match by meaning, not exact name: an approval group with the same members, a field with the same label and options, a team with the same people already exists.
    - built: it already exists as asked. Reuse it; add NO steps for it.
    - partial: it exists but is missing something. Reuse it and add only the missing pieces (or an update step).
    - missing: create it.
    Never create a parallel copy of something that exists ("v2", "(People Ops)", "New ..."): update it. If the change isn't updatable, say so in unsupported.
    A field matches only if its name/label fits the request AND, for a dropdown or multi-select, its options are exactly the ones asked for (same wording; extra existing options are fine only if the request's are all there). Different options: create a new field. Never map the request's options onto different existing ones. Help text never decides reuse: a form can show its own help text for a shared field (Override Field Hint, rule F14), so reuse the field and put the form's hint on its field entry ({ ref, mandatory, hint }, or set: { field_hints } for a field already on the form). A form with no help text in the request must not show another form's: when a shared field's own hint is one form's wording, give each form that has help text its override and clear the field's own hint (field update set: { hint: "" }).
  - Reuse what exists (exact names from the inventory), but only when it matches what the request asks for. Never create something whose name matches an existing one ignoring case (CFLaptopType vs CFlaptopType). Never invent names of existing things: anything not in the inventory must be created by an earlier step.
  - When the request describes stages a ticket moves through, build them: copy a workflow and add the stages with insert_steps.
  - based_on must name an EXISTING record, never the thing being created. Never invent agents, teams, workflows or step names that aren't in the inventory unless you create them.
  - If the request needs something not listed above (e.g. ${[...notReadyFeatureNames(), 'notifications on events', 'categories', 'renaming or removing existing workflow steps', 'roles/permissions', 'reports'].join(', ')}), DO NOT approximate it: describe it plainly in "unsupported" and build only the supported parts.
  - Line-manager approval only works if the instance syncs managers from Active Directory / Entra (rule P6: Halo users' managers can't be set by hand). If you use {"line_manager": true}, ask in questions whether they sync managers from AD, and say the fallback (a named approver or group) in assumptions.
  - Fields: a requirement already met by a field on the form or in a section (standard Halo fields like symptom, risk or fbackoutplan count) is met: reuse that field and use field_mandatory to make it required. Never add a second field with the same meaning.
  - Choosing what to copy (12 Nov): pick by what the request IS. Something broken or not working = an incident; asking for something (access, equipment, a change to HR records, information) = a service request; a planned change to systems = a change. Copy a new ticket type (based_on) from an existing type of that kind (inventory.details.ticket_types[].kind), the closest in purpose; never from a task, project or problem type. If the instance has none of that kind, leave based_on out and say so in assumptions.
  - Choosing a workflow: reuse the instance's workflow that fits the kind and the approvals. A service request WITH an approval process gets the service request workflow with approval; one with no approval gets the one without; incidents get the incident workflow; changes the change workflow. Match by name and stages in inventory.workflows_and_their_steps, set it on every new ticket type, and name the choice in assumptions. To set an existing workflow: a REUSE step { "object": "workflow", "action": "reuse", "match": { "name": exact name } } and a ticket_type update set: { "workflow": that step's id }. Never an update step on the workflow itself. Copy a workflow only when the request asks for a stage it doesn't have.
  - Ticket types: if an existing type already covers a requested type (e.g. "Change Request" for normal changes), update it; create a new type only for a genuinely separate one.
  - Workflow stages: match by meaning ("Implementing" = an existing "In Progress" stage). An inserted stage's enter_via must be an action NOT already on its after_step (inventory.details.workflow_actions_by_stage lists them); create a new action for it.
  - SLA targets: use only priority names that appear in inventory.details.sla_targets. A new SLA with targets must set based_on to an existing SLA that has EVERY priority you target (M10); give targets only for that SLA's priorities. A new SLA with targets must set based_on to an existing SLA that has EVERY priority you target (M10); give targets only for that SLA's priorities.
  - CHOICES (rule M13): when the request leaves a decision with a few clear answers, ask it in choices, not questions: { "question": short plain question naming the field or object, "options": 2 to 4 short answers }. Typical: a dropdown whose options aren't given ("Site / Building: where should the options come from?" options "A live list from Halo's sites", "A fixed list I'll give you", "Something else"); reuse an existing field or make a new one; which of two overlapping fields to keep. Build nothing for that part until it's answered (leave that step out and say so in reply). At most 3 choices; a choice the inventory or the request already answers is not a choice. Never ask the same thing again in questions: questions are only for facts you can't offer as options (a list of names, a date). Keep the choice question short (under 12 words).
  - Fields, sections, approval processes, actions, workflows and email templates you create must be used by a later step (placed on a form, attached to a ticket type...). Everything else the request asks for (teams, approval groups, SLAs, statuses, categories, services, organisations, sites, users, working hours, holidays, canned text, articles, roles, asset types, list values) is built as asked even when nothing else in the plan uses it. NEVER attach something to a ticket type the request didn't name just to use it.
  - The requester is the person writing the request. "me", "I", "my" mean them: their Halo agent is the one whose email (inventory.details.agent_emails) or name matches the requester. If none matches, ask.
  - A rule on a number (cost over £300, more than 10 users) is captured as its OWN new dropdown field holding only the bands ("Under £300", "£300 or more"), placed on the form. Never add band options to an existing field, and never mix the band into another answer ("Laptop (£300 or more)"). Then use a rules stage for the approval that depends on it (P7). (M5)
  - An approval that should only happen for some answers of a dropdown is a rules stage (P7): {"rules": [{"field", "equals", "group" or "agent"}]}, and the process IS attached to the ticket type (the rules stage approves itself when no rule matches). Conditions on anything other than a dropdown's answer (a number, text, a date) can't be built: capture a band dropdown (M5), or if that's not possible, do NOT attach the approval, list it in unsupported, and only attach an approval that must run on every ticket, saying so in an assumption starting "Every ticket of this type is approved by". (M6)
  - Questions (M7): at most 4 on the first plan, at most 2 on a follow-up, and only for decisions that change what gets built and that the inventory can't answer. Never ask the user to confirm a name or detail they gave you. Never ask again something already asked in the conversation: use their answer. If they leave a choice to you ("either", "up to you", "don't mind"), choose the option that changes the least on their instance, state your choice in assumptions, and don't ask again. Still plan the rest.
  - Least change (M9): a field asked for on a NEW form goes directly on that form (ticket_type "fields"), not into a section other ticket types share. Change a shared section only when the user wants the field on every form that uses it.
  - "Category" next to a FORM (in a request form design: form name, category, description, workflow) usually means the portal service category the form appears under, not the ticket's category. Unless the request says it's the ticket category, don't create ticket categories or rules for it: ask as a choice ("Category: portal service category or ticket category?").
  - A field, section or ticket type you REUSE stays as it is: never rename it or change its label, options or type unless the request explicitly asks to change that one (it is used on other forms too).
  - Mandatory: inventory.details marks mandatory fields with *. Never ask whether to make a field mandatory when it already is. A field inside a section is mandatory on every form that uses that section; to make it mandatory on one form only, place it directly on that form.
  - Names: if you name something differently from the user's own words, say the name you chose in reply.
  - Write every text for the customer (reply, existing_coverage, unsupported, assumptions, questions) in plain English with field LABELS (inventory.details.custom_fields), never internal names like CFhardware.
  - reply: one or two sentences, as a colleague would say them: what the plan does, and on a follow-up what you changed and why. No lists, no repeating the plan.
  - Be concise in names. Output JSON only.

  EXAMPLE PLANS (hand-written, proven on a real instance):
  ${examples}`;

  const who = ctx.requester ? `REQUESTER: ${ctx.requester.name ? `${ctx.requester.name}, ` : ''}${ctx.requester.email}\n\n` : '';
  const convo = ctx.history?.length
    ? `CONVERSATION SO FAR (oldest first):\n${ctx.history.map((h) => `${h.role === 'user' ? 'USER' : 'PLANNER'}: ${h.text}`).join('\n')}\n\n`
    : '';
  const prev = ctx.previous ? `CURRENT PLAN (shown to the user on the previous turn):\n${JSON.stringify(ctx.previous)}\n\n` : '';
  const asked = ctx.askedBefore?.length ? `QUESTIONS ALREADY ASKED (the user has replied since; never ask these again):\n- ${ctx.askedBefore.join('\n- ')}\n\n` : '';
  const userMsg = (extra = '') => `INSTANCE INVENTORY (what already exists on this Halo):
${JSON.stringify(inventory)}

${who}${convo}${prev}${asked}${ctx.history?.length ? 'LATEST MESSAGE' : 'REQUEST'}:
${request}
${ctx.previous ? REVISE : ''}${extra}`;

  const OBJECTS = new Set(PLAN_OBJECTS);
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
      if ((s.action === 'reuse' || s.action === 'update') && !exists(s.object, String(s.match?.name ?? '')) && !createdHere.has(`${s.object}:${String(s.match?.name ?? '').toLowerCase()}`))
        errors.push(`${where}: there is no ${s.object.replace(/_/g, ' ')} named "${s.match?.name}" in the inventory${all.has(String(s.match?.name ?? '').toLowerCase()) ? ' (something else has that name)' : ''}`);
      if (s.based_on && !exists(s.object, s.based_on)) errors.push(`${where}: based_on "${s.based_on}" is not in the inventory`);
      if (s.based_on && s.name && s.based_on.toLowerCase() === s.name.toLowerCase()) errors.push(`${where}: based_on is the thing being created; pick an existing record to copy from`);
      // A new field whose label means the same as an existing field's label is a duplicate (CFEmergencyReason vs CFemergencyChangeReason).
      if (s.object === 'field' && s.action === 'create' && s.label) {
        const stem = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.replace(/(ing|ed|s)$/, '')).join(' ');
        // Only the same kind of field is a duplicate: a text field doesn't stand in for a dropdown, nor a fixed list
        // for a live one (11 Nov: forcing that reuse put a text "Department" where a list was asked for).
        const kind = (d: string) => `${d.match(/^"[^"]*"\s+(\w+)/)?.[1] ?? ''}${/\[dynamic list\]/.test(d) ? ':dynamic' : ''}`;
        const want = `${s.type === 'dropdown' ? 'dropdown' : s.type}${s.dynamic ? ':dynamic' : ''}`;
        // A dropdown or multi-select is only a duplicate when the existing one has every option asked for: different
        // options is a separate field (13 Nov: this check said "reuse it" for General Enquiry's own Enquiry category,
        // and the fix pass went back to Benefits & Reward's list, rule M15).
        const optionsOf = (d: string) => (d.match(/^"[^"]*"\s+[^:]+:\s*(.*)$/)?.[1] ?? '').replace(/\s+\(hint: .*\)\s*$/, '').split(' | ').map((o) => o.trim().toLowerCase());
        const hasAll = (d: string) => !(s.type === 'dropdown' || s.type === 'multiselect') || (s.options ?? []).every((o) => optionsOf(d).includes(String(o).trim().toLowerCase()));
        const hit = Object.entries(inventory.details?.custom_fields ?? {}).find(([, d]) => stem(String(d).match(/^"([^"]*)"/)?.[1] ?? '') === stem(s.label!) && kind(String(d)) === want && hasAll(String(d)));
        // F12: a dynamic field that replaces the old one on forms keeps the old one's label on purpose.
        const swapsIn = Boolean(s.dynamic) && plan.steps.some((x) => (x.set?.replace_fields ?? []).some((r) => r.new === s.id));
        if (hit && !swapsIn) errors.push(`${where}: field "${hit[0]}" already exists with the label "${s.label}": reuse it`);
      }
      // A near-copy is the same name plus a copy marker ("Joiner Workflow (People Ops)", "New Starter v2", "CFhardware2"),
      // not a longer name that happens to share a prefix ("CFHardwareCostBand" is a different field from "CFhardware").
      const copyMarker = (rest: string) => (s.object === 'field' ? /^(v?\d+|copy|new|old)$/i.test(rest) : /^[\s\-_(]/.test(rest));
      const twin = s.action === 'create' && s.name ? (NAMES_BY_OBJECT[s.object] ?? []).find((n) => n.length >= 6 && s.name!.toLowerCase().startsWith(n.toLowerCase()) && s.name!.length > n.length && copyMarker(s.name!.slice(n.length))) : undefined;
      if (twin) errors.push(`${where}: "${s.name}" is a copy of the existing "${twin}": update "${twin}" instead`);
      if ((plan.questions?.length ?? 0) > 4 && s === plan.steps[0]) errors.push(`${plan.questions!.length} questions: keep at most 4, and drop any that inventory.details answers`);
      if (s.action === 'create' && s.name && / v\d+$|\(copy\)|\bcopy of\b/i.test(s.name))
        errors.push(`${where}: "${s.name}" looks like a copy of something that exists; reuse or update the original, or explain in questions`);
      if (s.action === 'create' && s.name && exists(s.object, s.name))
        errors.push(`${where}: a ${s.object.replace(/_/g, ' ')} named "${s.name}" already exists (names are case-insensitive): reuse it, or pick a different name`);
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
      // Rule W8: buttons on existing stages. The stages must exist; a re-pointed button must already be on its stage.
      const buttonWf = s.object === 'workflow' ? (s.copy_of ?? s.match?.name) : undefined;
      if (buttonWf && workflowSteps[buttonWf]) {
        const stagesOf = [...workflowSteps[buttonWf], ...inserts.map((i) => i.name)].map((n) => n.toLowerCase());
        for (const c of [...(s.set?.add_actions ?? []), ...(s.set?.retarget_actions ?? [])])
          for (const n of [c.step, c.to_step]) if (!stagesOf.includes(String(n).toLowerCase())) errors.push(`${where}: "${n}" is not a stage of "${buttonWf}"`);
        for (const c of s.set?.retarget_actions ?? []) {
          const on = (wfActions[buttonWf]?.[c.step] ?? []).map((a: string) => a.split(' → ')[0].toLowerCase());
          const via = plan.steps.find((x) => x.id === c.via);
          const viaName = String(via?.name ?? via?.match?.name ?? '').toLowerCase();
          if (on.length && viaName && !on.includes(viaName)) errors.push(`${where}: "${via?.name ?? via?.match?.name}" isn't a button on "${c.step}" (it has ${on.join(', ')}); use add_actions to add it`);
        }
      }
      for (const r of refsOf(s)) if (!seen.has(r)) errors.push(`${where}: uses "${r}" before it is defined`);
      for (const prio of Object.keys(s.targets ?? {}))
        if (slaPriorities.size && !slaPriorities.has(prio.toLowerCase())) errors.push(`${where}: SLA priority "${prio}" isn't on this instance's SLAs (${[...slaPriorities].join(', ')})`);
      // Rule M10 (2026-10-24): a new SLA is copied from an existing one and can only set targets on the priorities THAT
      // SLA has ("Urgent" existed on another SLA, not on the copied one, and the build stopped).
      if (s.object === 'sla' && s.action === 'create' && s.targets && Object.keys(s.targets).length) {
        const src = s.based_on ? slaPrioritiesOf.get(s.based_on.toLowerCase()) : undefined;
        const options = [...slaPrioritiesOf].map(([n, ps]) => `"${n}" (${ps.join(', ')})`).join('; ');
        if (!src) errors.push(`${where}: an SLA with per-priority targets needs based_on: an existing SLA that has every priority you target. Options: ${options}`);
        else {
          const missing = Object.keys(s.targets).filter((p) => !src.some((x) => x.toLowerCase() === p.toLowerCase()));
          if (missing.length) errors.push(`${where}: "${s.based_on}" has no ${missing.map((x) => `"${x}"`).join(' or ')} priority (it has ${src.join(', ')}). Drop those targets, or base the SLA on one that has them. Options: ${options}`);
        }
      }
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
    // Parts of something else (a field, a section, an approval process, an action, a workflow, an email template) must
    // be used by a later step. Everything else is a deliverable in its own right. (12 Nov enterprise test: this check
    // made the planner drop the organisation, sites, users and working hours, and wire an SLA, approval and categories
    // onto an unrelated ticket type just to "use" them.)
    const used = new Set((plan.steps as PlanStep[]).flatMap((x) => refsOf(x)));
    const parts = new Set(['field', 'field_group', 'approval_process', 'outcome', 'workflow', 'email_template']);
    const endProducts = new Set(PLAN_OBJECTS.filter((o) => !parts.has(o)));
    for (const s of plan.steps as PlanStep[])
      if (s.action === 'create' && !endProducts.has(s.object) && !used.has(s.id)) errors.push(`step "${s.id}": "${s.name}" is created but nothing uses it; attach it or drop it (ask in questions instead)`);
    errors.push(...planChecks(plan, {
      fieldDetails: inventory.details?.custom_fields as Record<string, string> | undefined,
      userMessages: [...(ctx.history ?? []).filter((h) => h.role === 'user').map((h) => h.text), request],
      askedBefore: ctx.askedBefore,
      alwaysMandatory,
      previousSteps: ctx.previous?.steps,
    }));
    return errors;
  }
  return { SYSTEM, userMsg, validate };
}

export type PlanResult = { plan: Plan | null; errors: string[]; model: string };

/** A follow-up returns only what changes, so it comes back in seconds instead of re-writing the whole plan. */
const REVISE = `
THIS IS A FOLLOW-UP. First decide what the LATEST message is (rule M12):
- A NEW REQUEST: a fresh brief for things to build that aren't a change to the CURRENT PLAN (for example, other ticket types, or the same objects described again from scratch as a new specification). Then return ONLY { "new_request": true } and nothing else: a fresh plan is made from the message alone.
- A CHANGE to the CURRENT PLAN (corrections, answers to questions, "also add", "remove", "instead"). Then revise it as below.
Revise the CURRENT PLAN to reflect the LATEST message and change nothing else.
Return ONLY this JSON (a patch, not the whole plan):
{ "reply": string,
  "remove_steps": [ids of current steps to drop],
  "upsert_steps": [complete steps to add, or to replace the current step with the same id],
  "existing_coverage": [only if it changed: the complete new list],
  "unsupported": [the complete current list], "assumptions": [the complete current list], "questions": [the complete current list: usually fewer than before, never repeated], "choices": [the complete current list: drop any the LATEST message answers] }
Re-check every item in unsupported against what the builder can do NOW (the list above): build any that are now supported. Never drop a step the user didn't ask to drop; if you do drop one, name it in reply (M11).
If the message only answers questions and the answers change nothing, upsert nothing: drop the answered questions and record the answers in assumptions. Every change your reply describes MUST be in upsert_steps or remove_steps (rule M8).
`;

type Patch = {
  /** M12: the latest message is a new brief, not a change to the current plan. */
  new_request?: boolean;
  reply?: string;
  remove_steps?: string[];
  upsert_steps?: PlanStep[];
  existing_coverage?: Plan['existing_coverage'];
  unsupported?: string[];
  assumptions?: string[];
  questions?: string[];
  choices?: Plan['choices'];
};

/** Apply a revision patch, then order steps so every ref is defined before it is used. */
export function applyPatch(base: Plan, patch: Patch): Plan {
  const drop = new Set(patch.remove_steps ?? []);
  const steps = base.steps.filter((s) => !drop.has(s.id)).map((s) => ({ ...s }));
  for (const u of patch.upsert_steps ?? []) {
    const at = steps.findIndex((s) => s.id === u.id);
    if (at >= 0) steps[at] = u;
    else steps.push(u);
  }
  const ordered: PlanStep[] = [];
  const placed = new Set<string>();
  const ids = new Set(steps.map((s) => s.id));
  const visiting = new Set<string>();
  const place = (s: PlanStep) => {
    if (placed.has(s.id) || visiting.has(s.id)) return;
    visiting.add(s.id);
    for (const r of refsOf(s)) if (ids.has(r)) place(steps.find((x) => x.id === r)!);
    visiting.delete(s.id);
    placed.add(s.id);
    ordered.push(s);
  };
  steps.forEach(place);
  return {
    ...base,
    reply: patch.reply ?? '',
    steps: ordered,
    existing_coverage: patch.existing_coverage ?? base.existing_coverage,
    unsupported: patch.unsupported ?? base.unsupported,
    assumptions: patch.assumptions ?? base.assumptions,
    questions: patch.questions ?? [],
    choices: patch.choices ?? [],
  };
}

/** M13: a question that asks what a choice already asks is noise; keep the choice (it has buttons). */
function dropRepeatedQuestions(plan: Plan) {
  if (!plan.choices?.length || !plan.questions?.length) return;
  const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3));
  const asked = plan.choices.map((c) => words(`${c.question} ${c.options.join(' ')}`));
  plan.questions = plan.questions.filter((q) => {
    const w = [...words(q)];
    return !asked.some((a) => w.length && w.filter((x) => a.has(x)).length / w.length >= 0.5);
  });
}

export type Stage = 'planning' | 'revising' | 'checking' | 'fixing';
export type GenerateOptions = { signal?: AbortSignal; onStage?: (stage: Stage, detail?: string) => void; cacheKey?: string; effort?: 'low' | 'medium' | 'high'; /** Epoch ms the request must finish by: a fix pass that can't finish in time is skipped, so the user gets the plan and its problems instead of a timeout (13 Nov run-through: 504s). */ deadline?: number; /** Plan once with no second full pass: the caller runs its own, cheaper fix (a patch). 13 Nov: a failing form part paid for two full plans and then a fix. */ once?: boolean };

// Plan text that is never a step id, even when it happens to match one (a label, an option, a stage name...).
const TEXT_KEYS = new Set(['name', 'label', 'hint', 'subject', 'body', 'summary', 'equals', 'copy_of', 'based_on', 'after_step', 'to_step', 'step', 'description', 'options', 'add_options', 'list', 'type', 'object', 'action', 'by', 'event', 'sla_action', 'resolve_days', 'targets']);
function renameRefs<T>(v: T, map: Map<string, string>, key?: string): T {
  if (typeof v === 'string') return (key && TEXT_KEYS.has(key) ? v : map.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => renameRefs(x, map, key)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, renameRefs(x, map, k)])) as T;
  return v;
}
const pascal = (t: string) => t.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

/**
 * Every step after the steps it uses (by id, or by the name of something created in the plan), otherwise in the
 * planner's order. Done in code, so an ordering slip never costs another model call (and never fails the checks).
 */
export function orderByDependency(input: PlanStep[]): PlanStep[] {
  // An update that changes nothing is a reuse (12 Nov: "Service Request Workflow (without approval)": change nothing).
  const steps = input.map((s) => (s.action === 'update' && (!s.set || !Object.keys(s.set).length) ? (({ set: _set, ...rest }) => ({ ...rest, action: 'reuse' as const, match: rest.match ?? { name: String(rest.name ?? '') } }))(s) : s));
  const merged: PlanStep[] = [];
  const placed = new Set<string>();
  const ids = new Set(steps.map((s) => s.id));
  const createdBy = new Map(steps.filter((s) => s.action === 'create' && s.name).map((s) => [`${s.object}:${s.name!.toLowerCase()}`, s.id] as [string, string]));
  const needs = (s: PlanStep) => {
    const byName = s.action !== 'create' && s.match?.name ? createdBy.get(`${s.object}:${String(s.match.name).toLowerCase()}`) : undefined;
    return [...refsOf(s), ...(byName ? [byName] : [])];
  };
  const pending = [...steps];
  while (pending.length) {
    const i = pending.findIndex((s) => needs(s).every((r) => !ids.has(r) || placed.has(r) || r === s.id));
    const [next] = pending.splice(i < 0 ? 0 : i, 1); // a cycle can't be ordered: keep it and let the checks say so
    merged.push(next);
    placed.add(next.id);
  }
  return merged;
}

/** Merge per-form plans: ids made unique per form, identical objects kept once, clashing field names made unique. */
export function mergePlans(parts: { title: string; plan: Plan }[], request: string): Plan {
  const steps: PlanStep[] = [];
  const seen = new Map<string, string>(); // what a step makes → the id kept for it
  const names = new Map<string, string>(); // created field name → its key, to catch two different fields with one name
  const alias = new Map<string, string>();
  const keyOf = (s: PlanStep) => {
    if (s.action === 'reuse') return `reuse|${s.object}|${String(s.match?.name ?? '').toLowerCase()}`;
    if (s.action !== 'create') return null;
    // Help text isn't part of the key: a form overrides a shared field's hint on its own row (F14, round 36).
    if (s.object === 'field') return `field|${String(s.label ?? s.name).trim().toLowerCase()}|${s.type}|${[...(s.options ?? [])].map((o) => o.toLowerCase()).sort().join(';')}|${s.dynamic?.list ?? ''}`;
    return `${s.object}|${String(s.name ?? '').trim().toLowerCase()}`;
  };
  const formHint = new Map<string, string>();
  parts.forEach(({ title, plan }, i) => {
    const ids = new Map(plan.steps.map((s) => [s.id, `f${i + 1}_${s.id}`] as [string, string]));
    for (const raw of plan.steps) {
      const s = renameRefs({ ...raw }, ids);
      s.id = ids.get(raw.id)!;
      const key = keyOf(s);
      if (key && seen.has(key)) {
        // Same field in another part with its own help text: that part's forms show it as their override (F14).
        if (s.object === 'field') {
          const kept = steps.find((x) => x.id === seen.get(key));
          if (s.hint !== undefined && String(s.hint).trim() !== String(kept?.hint ?? '').trim()) formHint.set(s.id, s.hint);
        }
        // A ticket type split across parts (one long form): one ticket type with every part's fields, in order.
        if (s.object === 'ticket_type' && s.action === 'create' && s.fields?.length) {
          const kept = steps.find((x) => x.id === seen.get(key));
          if (kept) kept.fields = [...(kept.fields ?? []), ...s.fields];
        }
        alias.set(s.id, seen.get(key)!);
        continue;
      }
      if (key) seen.set(key, s.id);
      if (s.object === 'field' && s.action === 'create' && s.name) {
        const n = s.name.toLowerCase();
        if (names.has(n) && names.get(n) !== key) s.name = `${s.name}${pascal(title)}`;
        names.set(s.name.toLowerCase(), key!);
      }
      steps.push(s);
    }
  });
  // M18 (13 Nov run-through): a part that reuses something by name another part creates (a form reusing the approval
  // process or team the shared part makes) points at that create, instead of failing "no such ... in the inventory".
  const createdByName = new Map(steps.filter((x) => x.action === 'create' && x.object !== 'field' && x.name).map((x) => [`${x.object}|${String(x.name).trim().toLowerCase()}`, x.id]));
  for (let k = steps.length - 1; k >= 0; k--) {
    const x = steps[k];
    if (x.action !== 'reuse' || x.object === 'field') continue;
    const target = createdByName.get(`${x.object}|${String(x.match?.name ?? '').trim().toLowerCase()}`);
    if (target && target !== x.id) { alias.set(x.id, target); steps.splice(k, 1); }
  }
  const withHint = <T extends { ref: string; hint?: string }>(f: T): T => (formHint.has(f.ref) && f.hint === undefined ? { ...f, hint: formHint.get(f.ref) } : f);
  const hinted = steps.map((s) => (s.object !== 'ticket_type' ? s : {
    ...s,
    ...(s.fields ? { fields: s.fields.map(withHint) } : {}),
    ...(s.set?.add_fields ? { set: { ...s.set, add_fields: s.set.add_fields.map(withHint) } } : {}),
  }));
  const deduped = hinted.map((s) => renameRefs(s, alias)).map((s) => {
    // A field merged into one already on the form appears once.
    if (!s.fields?.length) return s;
    const at = new Set<string>();
    return { ...s, fields: s.fields.filter((f) => (at.has(f.ref) ? false : (at.add(f.ref), true))) };
  });
  const merged = orderByDependency(deduped);
  const tag = (title: string, xs: string[] = []) => xs.map((x) => (x.toLowerCase().includes(title.toLowerCase()) ? x : `${title}: ${x}`));
  return {
    request,
    reply: parts.map(({ title, plan }) => `${title}: ${plan.reply ?? ''}`.trim()).join('\n'),
    steps: merged,
    existing_coverage: parts.flatMap(({ plan }) => plan.existing_coverage ?? []),
    unsupported: parts.flatMap(({ title, plan }) => tag(title, plan.unsupported)),
    // One question asked by several parts (line managers synced from Entra...) is asked once; at most 6 in all, the
    // rest kept as assumptions to check (12 Nov: 11 questions on a five-part brief).
    ...(() => {
      const seenQ = new Set<string>();
      const all = parts.flatMap(({ title, plan }) => (plan.questions ?? []).map((q) => ({ q, key: q.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(), title })));
      // Same question in other words (12 Nov: two parts asked about line managers synced from Entra differently).
      const STOP = new Set(['the', 'a', 'an', 'to', 'so', 'can', 'do', 'you', 'your', 'from', 'for', 'of', 'and', 'or', 'is', 'are', 'each', 'work', 'be', 'it', 'this', 'that', 'in', 'on', 'with', 'users', 'user']);
      const words = (k: string) => new Set(k.split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
      const same = (a: string, b: string) => { const A = words(a), B = words(b); const both = [...A].filter((w) => B.has(w)).length; return both / Math.max(1, Math.min(A.size, B.size)) >= 0.6; };
      const kept: string[] = [];
      const unique = all.filter((x) => (seenQ.has(x.key) || kept.some((k) => same(k, x.key)) ? false : (seenQ.add(x.key), kept.push(x.key), true)));
      const shown = unique.slice(0, 6).map((x) => (x.q.toLowerCase().includes(x.title.toLowerCase()) || all.filter((y) => same(y.key, x.key)).length > 1 ? x.q : `${x.title}: ${x.q}`));
      const extra = unique.slice(6).map((x) => `Not asked yet (tell us if it matters): ${x.title}: ${x.q}`);
      return { questions: shown, assumptions: [...parts.flatMap(({ title, plan }) => tag(title, plan.assumptions)), ...extra] };
    })(),
    choices: parts.flatMap(({ title, plan }) => (plan.choices ?? []).map((c) => ({ ...c, question: c.question.toLowerCase().includes(title.toLowerCase()) ? c.question : `${title}: ${c.question}` }))),
  };
}

/**
 * A brief written field by field ("- Label: type, mandatory | conditional | optional") says exactly which fields are
 * required: mandatory and conditional (required when shown, V3) are required, optional isn't. Set that in code on every
 * ticket type the brief names, so the planner's guess never wins (12 Nov Compleat plan: conditional fields such as
 * "Hiring Manager decision" came out optional, and others flipped between parts).
 */
export function applyWrittenRequirement(plan: Plan, request: string, inventory: Inventory) {
  // One block per form: the "=== FORM ===" parts, or the whole request when it has none.
  const blocks = splitForms(request, 1)?.forms.map((f) => f.text) ?? [request];
  const byType = new Map<string, Map<string, boolean>>();
  for (const text of blocks) {
    // 'Ticket type: "X"' (design sheets, M14 briefs) or 'Ticket type "X"' (written briefs). One form per block only:
    // with several ticket types in one block we can't tell whose field a line is, so nothing is applied.
    const names = [...text.matchAll(/Ticket type:?\s*"([^"]+)"/gi)].map((m) => m[1].trim().toLowerCase());
    if (new Set(names).size !== 1) continue;
    const m = byType.get(names[0]) ?? new Map<string, boolean>();
    for (const line of text.split('\n')) {
      // "- Label: type, mandatory|conditional|optional" or "- Label, type, required|optional"
      const hit = line.match(/^\s*-\s+(.+?)(?::\s+|,\s+)[^,]+?,\s+(mandatory|conditional|required|optional)\b/i);
      if (hit) m.set(hit[1].trim().toLowerCase(), hit[2].toLowerCase() !== 'optional');
    }
    if (m.size) byType.set(names[0], m);
  }
  if (!byType.size) return;
  const cf = (inventory as unknown as { details?: { custom_fields?: Record<string, string> } }).details?.custom_fields ?? {};
  const labelOf = (ref: string) => {
    const st = plan.steps.find((x) => x.id === ref);
    if (!st) return '';
    if (st.action === 'create') return String(st.label ?? '').trim().toLowerCase();
    return String(cf[st.match?.name ?? '']?.match(/^"([^"]*)"/)?.[1] ?? '').trim().toLowerCase();
  };
  for (const st of plan.steps as PlanStep[]) {
    if (st.object !== 'ticket_type') continue;
    const want = byType.get(String(st.name ?? st.match?.name ?? '').trim().toLowerCase());
    if (!want) continue;
    for (const f of st.fields ?? []) { const w = want.get(labelOf(f.ref)); if (w !== undefined) f.mandatory = w; }
    for (const f of st.set?.add_fields ?? []) { const w = want.get(labelOf(f.ref)); if (w !== undefined) f.mandatory = w; }
    if (st.set?.field_mandatory) {
      for (const f of st.set.field_mandatory) { const w = want.get(labelOf(f.ref)); if (w !== undefined) f.mandatory = w; }
    }
  }
}

/**
 * Rule M15 (13 Nov, Compleat General Enquiry): a brief that writes out a dropdown's options decides whether an existing
 * field fits. The planner reused Benefits & Reward's "Enquiry category" (benefits options) for General Enquiry's own
 * list, the checks failed, and the fix pass made the same mistake. So in code: when a reused dropdown or multi-select
 * lacks any written option, the step becomes a new field with the written label, options and help text (same step id,
 * so every reference still holds). Nothing is ever changed on the existing field.
 */
export function applyWrittenOptions(plan: Plan, request: string, inventory: Inventory) {
  const blocks = splitForms(request, 1)?.forms.map((f) => f.text) ?? [request];
  const written = new Map<string, { label: string; type: 'dropdown' | 'multiselect'; options: string[]; hint?: string; form: string }>();
  for (const text of blocks) {
    const form = text.match(/Ticket type:?\s*"([^"]+)"/i)?.[1]?.trim() ?? '';
    for (const line of text.split('\n')) {
      const hit = line.match(/^\s*-\s+(.+?):\s+(single selection|dropdown|multiple selection|multi-select|multiselect)\b.*?\bOptions:\s*(.+?)(?:\.\s+(?:Show rules|Help text)\b|\.?\s*$)/i);
      if (!hit || /agreed|halo site|site\s*\/\s*location list/i.test(hit[3])) continue;
      const options = hit[3].split(';').map((o) => o.trim().replace(/\.$/, '')).filter(Boolean);
      if (!options.length) continue;
      const hint = line.match(/Help text:\s*"([^"]*)"/i)?.[1];
      const label = hit[1].trim();
      written.set(label.toLowerCase(), { label, type: /multi/i.test(hit[2]) ? 'multiselect' : 'dropdown', options, hint, form });
    }
  }
  if (!written.size) return;
  const cf = (inventory as unknown as { details?: { custom_fields?: Record<string, string> } }).details?.custom_fields ?? {};
  const taken = new Set([...Object.keys(cf), ...plan.steps.map((x) => String(x.name ?? ''))].map((n) => n.toLowerCase()));
  for (const [i, st] of (plan.steps as PlanStep[]).entries()) {
    if (st.object !== 'field' || st.action !== 'reuse') continue;
    const details = cf[st.match?.name ?? ''];
    const label = String(details?.match(/^"([^"]*)"/)?.[1] ?? st.match?.name ?? '').trim().toLowerCase();
    const w = written.get(label);
    if (!w || !details) continue;
    const optsOf = (d: string) => (d.match(/^"[^"]*"\s+[^:]+:\s*(.*)$/)?.[1] ?? '').replace(/\s+\(hint: .*\)\s*$/, '').split(' | ').map((o) => o.trim().toLowerCase());
    const have = optsOf(details);
    const added = plan.steps.filter((x) => x.object === 'field' && x.action === 'update' && x.match?.name === st.match?.name).flatMap((x) => x.set?.add_options ?? []).map((o) => o.toLowerCase());
    if (w.options.every((o) => have.includes(o.toLowerCase()) || added.includes(o.toLowerCase()))) continue;
    // Another existing field with this label may already have exactly these options (e.g. made for this form before).
    const fits = Object.entries(cf).find(([, d]) => String(d.match(/^"([^"]*)"/)?.[1] ?? '').trim().toLowerCase() === label && / (dropdown|multiselect|multi-select)/.test(d) && w.options.every((o) => optsOf(d).includes(o.toLowerCase())));
    if (fits) { st.match = { name: fits[0] }; continue; }
    let name = `CF${pascal(w.label)}${pascal(w.form)}`;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `CF${pascal(w.label)}${pascal(w.form)}${n}`;
    taken.add(name.toLowerCase());
    plan.steps[i] = { id: st.id, object: 'field', action: 'create', name, label: w.label, type: w.type, options: w.options, ...(w.hint !== undefined ? { hint: w.hint } : {}) } as PlanStep;
    plan.assumptions = [...(plan.assumptions ?? []), `"${w.label}": the existing field has different options, so a new field is made with the ones written (the existing one is left as it is).`];
  }
}

/** One fix pass on a merged plan, as a single plan gets (13 Nov: briefs failed the checks on the first try and the user
 * had to reply to get a second attempt). The fix is kept only if it has fewer problems. */
async function fixMerged(inventory: Inventory, request: string, plan: Plan, errors: string[], keep: number, ctx: PlanContext, opts: GenerateOptions, validate: (p: Plan) => string[]): Promise<{ plan: Plan; errors: string[] }> {
  if (errors.length <= keep || opts.signal?.aborted) return { plan, errors };
  // A fix pass takes a minute or two: not if the request would time out first.
  if (opts.deadline && Date.now() + 150_000 > opts.deadline) return { plan, errors };
  opts.onStage?.('fixing', `${errors.length - keep}`);
  const fix = await generatePlan(inventory, `Fix these problems in the current plan and change nothing else:\n- ${errors.slice(keep).join('\n- ')}`, { requester: ctx.requester, previous: plan, history: [{ role: 'user', text: request }] }, { ...opts, effort: 'low' }).catch(() => null);
  if (!fix?.plan || fix.plan.fresh) return { plan, errors };
  applyWrittenOptions(fix.plan, request, inventory);
  codeRepairs(fix.plan, inventory);
  applyWrittenRequirement(fix.plan, request, inventory);
  fix.plan.request = request;
  const again = [...errors.slice(0, keep), ...validate(fix.plan)];
  return again.length < errors.length ? { plan: fix.plan, errors: again } : { plan, errors };
}

/**
 * M19 (13 Nov run-through): the planner made a new workflow for a new ticket type but never attached it ("created but
 * nothing uses it" + "has no workflow"). When a plan has both, attach each such ticket type to the unused new workflow
 * whose name matches it best (the only one, if there's one). Never touches a type that already has a workflow.
 */
export function attachUnusedWorkflows(plan: Plan) {
  const steps = plan.steps as PlanStep[];
  const used = new Set(steps.flatMap((x) => refsOf(x)));
  const free = steps.filter((x) => x.object === 'workflow' && x.action === 'create' && !used.has(x.id));
  if (!free.length) return;
  const words = (t: string) => new Set(String(t).toLowerCase().replace(/^zz\s+\S+\s+/, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['workflow', 'request', 'the', 'and'].includes(w)));
  const needs = steps.filter((x) => x.object === 'ticket_type' && x.action === 'create' && !steps.some((u) => u.object === 'ticket_type' && u.action === 'update' && String(u.match?.name ?? '').toLowerCase() === String(x.name ?? '').toLowerCase() && u.set?.workflow));
  for (const tt of needs) {
    const tw = words(String(tt.name));
    const scored = free.map((w) => ({ w, n: [...words(String(w.name))].filter((x) => tw.has(x)).length })).sort((a, b) => b.n - a.n);
    const pick = scored[0].n > 0 ? scored[0].w : free.length === 1 ? free[0] : null;
    if (!pick) continue;
    steps.push({ id: `wf_for_${tt.id}`, object: 'ticket_type', action: 'update', match: { name: String(tt.name) }, set: { workflow: pick.id } } as PlanStep);
    plan.assumptions = [...(plan.assumptions ?? []), `"${tt.name}" uses the new workflow "${pick.name}" (it was made for it but not attached).`];
  }
  plan.steps = orderByDependency(steps);
}

/**
 * Code repairs for mistakes the planner keeps making and the fix pass doesn't always mend (13 Nov run-through t2un).
 * Each one only applies when the answer is unambiguous; anything else is left for the checks to report.
 * M20 action "set" means update; M21 a new field identical to an existing one is reused (its own help text becomes the
 * forms' override, F14); M22 an SLA with per-priority targets and no based_on copies an existing SLA that has every
 * priority it targets; M23 a reference written as an existing record's name gets a reuse step for that record.
 */
export function codeRepairs(plan: Plan, inventory: Inventory) {
  attachUnusedWorkflows(plan);
  const steps = plan.steps as PlanStep[];
  for (const st of steps) if ((st.action as string) === 'set') st.action = 'update';

  const cf = inventory.details?.custom_fields ?? {};
  const stem = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.replace(/(ing|ed|s)$/, '')).join(' ');
  const kind = (d: string) => `${d.match(/^"[^"]*"\s+(\w+)/)?.[1] ?? ''}${/\[dynamic list\]/.test(d) ? ':dynamic' : ''}`;
  const optionsOf = (d: string) => (d.match(/^"[^"]*"\s+[^:]+:\s*(.*)$/)?.[1] ?? '').replace(/\s+\(hint: .*\)\s*$/, '').split(' | ').map((o) => o.trim().toLowerCase());
  const hintOf = (d: string) => d.match(/\(hint: (.*)\)\s*$/)?.[1];
  for (const [i, st] of steps.entries()) {
    if (st.object !== 'field' || st.action !== 'create' || !st.label) continue;
    if (st.dynamic && steps.some((x) => (x.set?.replace_fields ?? []).some((r) => r.new === st.id))) continue;
    const want = `${st.type}${st.dynamic ? ':dynamic' : ''}`;
    const hits = Object.entries(cf).filter(([, d]) => stem(String(d).match(/^"([^"]*)"/)?.[1] ?? '') === stem(st.label!) && kind(String(d)) === want
      && (!(st.type === 'dropdown' || st.type === 'multiselect') || (st.options ?? []).every((o) => optionsOf(String(d)).includes(String(o).trim().toLowerCase()))));
    if (!hits.length) continue;
    // Several identical fields: Halo's own before test copies, as the duplicate check picks (13 Nov re-check: three
    // "Start Date" fields and the repair stood aside).
    const [name, d] = hits.find(([n]) => !/^CFzz/i.test(n)) ?? hits[0];
    const own = st.hint;
    steps[i] = { id: st.id, object: 'field', action: 'reuse', match: { name } } as PlanStep;
    if (own !== undefined && own !== (hintOf(String(d)) ?? '')) {
      for (const t of steps) {
        if (t.object !== 'ticket_type') continue;
        for (const f of [...(t.fields ?? []), ...(t.set?.add_fields ?? [])]) if (f.ref === st.id && f.hint === undefined) f.hint = own;
      }
    }
    plan.assumptions = [...(plan.assumptions ?? []), `"${st.label}" reuses the existing field ${name} instead of making a duplicate.`];
  }

  const slaTargets = inventory.details?.sla_targets ?? {};
  for (const st of steps) {
    if (st.object !== 'sla' || st.action !== 'create' || st.based_on || !st.targets || !Object.keys(st.targets).length) continue;
    const want = Object.keys(st.targets).map((p) => p.toLowerCase());
    const fits = Object.entries(slaTargets).filter(([, t]) => { const has = String(t).split(', ').map((x) => x.replace(/ \S+$/, '').toLowerCase()); return want.every((p) => has.includes(p)); }).map(([n]) => n);
    // Prefer Halo's own SLAs over test copies, and one whose name shares a word with this one.
    const words = new Set(String(st.name ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
    const ranked = fits.sort((a, b) => Number(/^zz/i.test(a)) - Number(/^zz/i.test(b)) || [...b.toLowerCase().split(/[^a-z]+/)].filter((w) => words.has(w)).length - [...a.toLowerCase().split(/[^a-z]+/)].filter((w) => words.has(w)).length);
    if (ranked[0]) { st.based_on = ranked[0]; plan.assumptions = [...(plan.assumptions ?? []), `"${st.name}" is copied from the existing SLA "${ranked[0]}", which has every priority it sets.`]; }
  }

  // New stages listed before the stage they follow ("Facilities" after "IT Provisioning", listed first) are put in order.
  for (const st of steps) {
    for (const list of [st.insert_steps, st.set?.insert_steps]) {
      if (!list || list.length < 2) continue;
      const done: typeof list = [];
      const left = [...list];
      while (left.length) {
        const k = left.findIndex((x) => !left.some((y) => y !== x && y.name.toLowerCase() === x.after_step.toLowerCase()));
        done.push(...left.splice(k < 0 ? 0 : k, 1));
      }
      list.splice(0, list.length, ...done);
    }
  }

  // A new type copied from an existing one, with no workflow chosen, keeps that type's workflow, said explicitly
  // (13 Nov: new Incident and Major Incident types copied from Halo's failed "has no workflow").
  const ttDetails = (inventory.details?.ticket_types ?? {}) as Record<string, { workflow?: string }>;
  for (const tt of [...steps]) {
    if (tt.object !== 'ticket_type' || tt.action !== 'create' || !tt.based_on) continue;
    if (steps.some((u) => u.object === 'ticket_type' && u.action === 'update' && String(u.match?.name ?? '').toLowerCase() === String(tt.name ?? '').toLowerCase() && u.set?.workflow)) continue;
    const base = Object.entries(ttDetails).find(([n]) => n.toLowerCase() === tt.based_on!.toLowerCase())?.[1]?.workflow;
    const wf = base ? Object.keys(inventory.workflows_and_their_steps ?? {}).find((w) => w.toLowerCase() === base.toLowerCase()) : undefined;
    if (!wf) continue;
    let wfStep = steps.find((x) => x.object === 'workflow' && x.action === 'reuse' && String(x.match?.name ?? '').toLowerCase() === wf.toLowerCase());
    if (!wfStep) { wfStep = { id: `wf_${wf.replace(/\W+/g, '_').toLowerCase()}`, object: 'workflow', action: 'reuse', match: { name: wf } } as PlanStep; steps.unshift(wfStep); }
    steps.push({ id: `wf_for_${tt.id}`, object: 'ticket_type', action: 'update', match: { name: String(tt.name) }, set: { workflow: wfStep.id } } as PlanStep);
    plan.assumptions = [...(plan.assumptions ?? []), `"${tt.name}" keeps the workflow of "${tt.based_on}" ("${wf}"), which it's copied from.`];
  }

  const ids = new Set(steps.map((x) => x.id));
  const lists: [PlanStep['object'], string[]][] = [
    ['ticket_type', inventory.ticket_types], ['workflow', Object.keys(inventory.workflows_and_their_steps ?? {})], ['outcome', inventory.actions],
    ['team', inventory.teams], ['sla', inventory.slas], ['approval_process', inventory.approval_processes], ['approval_group', inventory.approval_groups], ['status', inventory.statuses],
  ];
  for (const st of [...steps]) {
    for (const r of refsOf(st)) {
      if (!r || ids.has(r)) continue;
      const found = lists.filter(([, names]) => (names ?? []).some((n) => String(n).toLowerCase() === r.toLowerCase()));
      if (found.length !== 1) continue;
      const exact = (found[0][1] ?? []).find((n) => String(n).toLowerCase() === r.toLowerCase())!;
      steps.unshift({ id: r, object: found[0][0], action: 'reuse', match: { name: String(exact) } } as PlanStep);
      ids.add(r);
    }
  }
  plan.steps = orderByDependency(steps);
}

/** Re-run the code repairs and checks on a saved plan, with no model call (the run-through's free re-check). */
export function recheckPlan(inventory: Inventory, request: string, plan: Plan): string[] {
  applyWrittenOptions(plan, request, inventory);
  codeRepairs(plan, inventory);
  applyWrittenRequirement(plan, request, inventory);
  // Same allowance as a merged plan: up to 6 questions across the parts.
  return makePlanner(inventory, request, {}).validate(plan).filter((e) => !(/^\d+ questions: keep at most 4/.test(e) && (plan.questions?.length ?? 0) <= 6));
}

/** M14: merge forms planned separately (in their own requests) and check the result like any plan. */
export async function mergeAndCheck(inventory: Inventory, request: string, parts: { title: string; plan: Plan | null; errors: string[] }[], ctx: PlanContext = {}, opts: GenerateOptions = {}): Promise<PlanResult> {
  const ok = parts.filter((r) => r.plan) as { title: string; plan: Plan }[];
  let plan = mergePlans(ok, request);
  applyWrittenOptions(plan, request, inventory);
  codeRepairs(plan, inventory);
  applyWrittenRequirement(plan, request, inventory);
  const { validate } = makePlanner(inventory, request, ctx);
  // Up to 4 questions per part: a merged plan carries every part's.
  const failed = parts.filter((r) => !r.plan).map((r) => `"${r.title}": no plan could be made for this part (${r.errors[0] ?? 'the planner reply was not usable'}). Send it again on its own.`);
  const check = (p: Plan) => validate(p).filter((e) => !(/^\d+ questions: keep at most 4/.test(e) && (p.questions?.length ?? 0) <= 6));
  let errors = [...failed, ...check(plan)];
  ({ plan, errors } = await fixMerged(inventory, request, plan, errors, failed.length, ctx, opts, check));
  dropRepeatedQuestions(plan);
  return { plan, errors, model: '' };
}

async function planInParts(inventory: Inventory, request: string, split: import('./forms').FormSplit, ctx: PlanContext, opts: GenerateOptions): Promise<PlanResult> {
  const n = split.forms.length;
  let done = 0;
  opts.onStage?.('planning', `${n} forms, one at a time`);
  const results = await Promise.all(
    split.forms.map(async (f, i) => {
      const r = await generatePlan(inventory, formRequest(split, i), { requester: ctx.requester }, { signal: opts.signal, cacheKey: opts.cacheKey, effort: 'low' });
      opts.onStage?.('planning', `${++done} of ${n} forms planned`);
      return { title: f.title, ...r };
    }),
  );
  const ok = results.filter((r) => r.plan) as { title: string; plan: Plan; errors: string[]; model: string }[];
  opts.onStage?.('checking');
  let plan = mergePlans(ok.map((r) => ({ title: r.title, plan: r.plan })), request);
  applyWrittenOptions(plan, request, inventory);
  codeRepairs(plan, inventory);
  applyWrittenRequirement(plan, request, inventory);
  const { validate } = makePlanner(inventory, request, ctx);
  const failed = results.filter((r) => !r.plan).map((r) => `"${r.title}": no plan could be made for this form (${r.errors[0] ?? 'the planner reply was not usable'}). Send it again on its own.`);
  let errors = [...failed, ...validate(plan)];
  ({ plan, errors } = await fixMerged(inventory, request, plan, errors, failed.length, ctx, opts, validate));
  if (plan) dropRepeatedQuestions(plan);
  return { plan, errors, model: results[0]?.model ?? '' };
}

/** Ask the model, check the plan, send the problems back once for a fix. Never touches Halo. */
export async function generatePlan(inventory: Inventory, request: string, ctx: PlanContext = {}, opts: GenerateOptions = {}): Promise<PlanResult> {
  const split = ctx.previous ? null : splitForms(request);
  if (split) return planInParts(inventory, request, split, ctx, opts);
  const { SYSTEM, userMsg, validate } = makePlanner(inventory, request, ctx);
  const revising = Boolean(ctx.previous);
  const effort = opts.effort ?? (revising ? ((process.env.PLANNER_REVISE_EFFORT as 'low' | undefined) ?? 'low') : undefined);
  let plan: Plan | null = null;
  let errors: string[] = [];
  let model = '';
  const started = Date.now();
  for (let attempt = 1; attempt <= (opts.once ? 1 : 2); attempt++) {
    // A second pass takes about as long as the first: skip it if it would run past the deadline.
    if (attempt > 1 && opts.deadline && Date.now() + (Date.now() - started) + 10_000 > opts.deadline) break;
    opts.onStage?.(attempt === 1 ? (revising ? 'revising' : 'planning') : 'fixing', attempt === 1 ? undefined : `${errors.length}`);
    const extra =
      attempt === 1
        ? ''
        : revising && plan
          ? `\nYOUR REVISION HAD THESE PROBLEMS. Return a corrected patch against the CURRENT PLAN above:\n- ${errors.join('\n- ')}\n\nWHAT YOUR PATCH PRODUCED:\n${JSON.stringify(plan)}`
          : `\nYOUR PREVIOUS PLAN HAD THESE ERRORS, return a corrected full plan:\n- ${errors.join('\n- ')}\n\nPREVIOUS PLAN:\n${JSON.stringify(plan)}`;
    const reply = await complete(SYSTEM, userMsg(extra), { effort, signal: opts.signal, cacheKey: opts.cacheKey });
    model = reply.model;
    opts.onStage?.('checking');
    try {
      const parsed = parseJsonReply<Plan & Patch>(reply.text);
      if (revising && attempt === 1 && parsed.new_request === true && !Array.isArray(parsed.steps)) {
        // M12: a new brief in the same conversation. Plan it from the message alone, without the old plan or the turns
        // before it, so nothing from the earlier request leaks in.
        const fresh = await generatePlan(inventory, request, { requester: ctx.requester }, opts);
        if (fresh.plan) fresh.plan.fresh = true;
        return fresh;
      }
      plan = revising && !Array.isArray(parsed.steps) ? applyPatch(ctx.previous!, parsed) : parsed;
      // A revision is never a fresh plan, even when the plan it revises was (M12).
      if (revising && plan) delete plan.fresh;
      if (plan && Array.isArray(plan.steps)) plan.steps = orderByDependency(plan.steps);
      if (plan && Array.isArray(plan.steps)) applyWrittenOptions(plan, request, inventory);
      if (plan && Array.isArray(plan.steps)) codeRepairs(plan, inventory);
      if (plan && Array.isArray(plan.steps)) applyWrittenRequirement(plan, request, inventory);
    } catch {
      errors = ['The planner reply was not valid JSON.'];
      continue;
    }
    errors = validate(plan);
    if (!errors.length) break;
  }
  if (plan) dropRepeatedQuestions(plan);
  if (plan) plan.request = ctx.history?.length ? `${ctx.history.find((h) => h.role === 'user')?.text ?? ''}\n\n(Latest: ${request})` : request;
  return { plan, errors, model };
}

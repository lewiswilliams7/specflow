/** Plan format shared with the builder (halo-config-spike: spike/lib/translators.ts). Keep the two in step. */

// ---------- plan types ----------


export interface PlanStep {
  id: string;
  object: 'team' | 'field' | 'sla' | 'approval_process' | 'ticket_type' | 'status' | 'outcome' | 'workflow' | 'agent' | 'approval_group' | 'field_group';
  action: 'create' | 'reuse' | 'update';
  name?: string;
  label?: string;
  type?: string;
  options?: string[];
  resolve_days?: number;
  approver?: string;
  match?: { name: string };
  fields?: { ref: string; mandatory?: boolean }[];
  team?: string;
  sla?: string;
  approval?: string;
  /** status: SLA behaviour while in this status, e.g. 'hold'. Omit to keep the template's. */
  sla_action?: string;
  colour?: string;
  /** outcome (action): ref of the status the ticket moves to. */
  new_status?: string;
  /** workflow: insert one new step after an existing one. */
  insert_step?: InsertStep;
  /** workflow: insert several steps, in order; later ones may come after earlier inserted ones. */
  insert_steps?: InsertStep[];
  /** sla: per-priority resolve targets by priority name, e.g. { "Critical": "4h", "Low": "5d" }. */
  targets?: Record<string, string>;
  /** team / approval_group: agent refs. */
  members?: string[];
  /** approval_group: how many members must approve. */
  approvals_needed?: number;
  /** ticket_type: field group refs, added after the plain fields. */
  groups?: string[];
  /** workflow: name of an existing workflow on THIS instance to copy. */
  copy_of?: string;
  /** any create: name of an existing record on THIS instance to copy the shape from (rule D3). */
  based_on?: string;
  /** approval_process: approval stages in order. Each stage is ONE of these (rule P1). */
  approvers?: Approver[];
  /** update: properties to change on an existing record, as refs (e.g. { workflow: "wf" }). */
  set?: {
    // ticket_type
    workflow?: string;
    approval?: string;
    team?: string;
    sla?: string;
    add_groups?: string[];
    add_fields?: { ref: string; mandatory?: boolean }[];
    /** ticket_type: add back Halo's standard fields (Details, Followers...) from this REUSED ticket type (rule T5). */
    copy_standard_fields_from?: string;
    // ticket_type (its own loose fields) and field_group: change mandatory on fields already there
    field_mandatory?: { ref: string; mandatory: boolean }[];
    // team
    department_of?: string;
    // status
    sla_action?: string;
    // workflow: add stages to an EXISTING workflow in place (rule W3)
    insert_steps?: InsertStep[];
    // field: add dropdown/multi-select options, change the label
    add_options?: string[];
    label?: string;
    // approval_group / team
    add_members?: string[];
  };
  /** team: put the team in the same department as this reused team (step ref). Rule T3. */
  department_of?: string;
  /** outcome: Font Awesome icon name for the action button (default arrow-right). Rule O3. */
  icon?: string;
}

export interface InsertStep {
  name: string;
  after_step: string; //                         existing (or earlier inserted) step name
  enter_via: string; //                          outcome ref: action on after_step that moves into the new step
  exits: { via: string; to_step: string }[]; //  outcome refs: actions on the new step, to step names
}

export type Approver =
  | { line_manager: true } //                 type 10
  | { agent: string } //                      type 1, ref to an agent step
  | { group: string; min?: number } //        type 3, ref to an approval_group step
  | { adhoc: true }; //                       type 8, agent picks at the time

export interface Plan {
  request: string;
  steps: PlanStep[];
  /** Planner output: parts of the request the builder can't do yet, in plain words. */
  /** What the instance already has for each part of the request, so the plan only builds the gap. */
  existing_coverage?: { requirement: string; status: 'built' | 'partial' | 'missing'; existing?: string }[];
  unsupported?: string[];
  /** Planner output: choices it made that the user should check (e.g. which template it based things on). */
  assumptions?: string[];
  /** Planner output: things it needs answered before the plan is safe to build. */
  questions?: string[];
}

/** Every ref a step points at, so the builder can check order before running. */
export function refsOf(step: PlanStep): string[] {
  return [
    step.team,
    step.sla,
    step.approval,
    step.new_status,
    step.set?.workflow,
    step.set?.approval,
    step.set?.department_of,
    step.set?.copy_standard_fields_from,
    step.set?.team,
    step.set?.sla,
    ...(step.set?.add_groups ?? []),
    ...(step.set?.add_fields ?? []).map((f) => f.ref),
    ...(step.set?.field_mandatory ?? []).map((f) => f.ref),
    ...(step.set?.add_members ?? []),
    ...(step.set?.insert_steps ?? []).flatMap((x) => [x.enter_via, ...x.exits.map((e) => e.via)]),
    step.department_of,
    ...(step.approvers ?? []).map((a) => ('agent' in a ? a.agent : 'group' in a ? a.group : undefined)),
    ...[...(step.insert_steps ?? []), ...(step.insert_step ? [step.insert_step] : [])].flatMap((x) => [x.enter_via, ...x.exits.map((e) => e.via)]),
    ...(step.fields ?? []).map((f) => f.ref),
    ...(step.members ?? []),
    ...(step.groups ?? []),
  ].filter((r): r is string => Boolean(r));
}

/**
 * Expected results for the run-through briefs (13 Nov): a checklist of what the RIGHT build must contain, scored
 * against a plan with no model calls. It measures what the plan checks can't: did Enact plan what the brief asked for.
 * Only our own briefs live here (this repo is public); pasted briefs are scored only by the checks.
 */
import type { Plan, PlanStep } from './specflow/plan-types';

type Check = { what: string; ok: (p: Plan) => boolean };

const strip = (t: unknown) => String(t ?? '').toLowerCase().replace(/^zz\s+(s\w+|enact test)\s+/, '').trim();
const nameOf = (s: PlanStep) => strip(s.name ?? s.match?.name ?? s.label);
const steps = (p: Plan) => (p.steps ?? []) as PlanStep[];
const find = (p: Plan, object: PlanStep['object'], re: RegExp) => steps(p).filter((s) => s.object === object && re.test(nameOf(s)));
const has = (object: PlanStep['object'], re: RegExp, pred: (s: PlanStep, p: Plan) => boolean = () => true): Check['ok'] => (p) => find(p, object, re).some((s) => pred(s, p));
const byId = (p: Plan, id?: string) => steps(p).find((s) => s.id === id);
const refName = (p: Plan, id?: string) => { const s = byId(p, id); return s ? nameOf(s) : strip(id); };
const fieldLabel = (p: Plan, id?: string) => { const s = byId(p, id); return strip(s?.label ?? s?.name ?? s?.match?.name ?? id).replace(/^cf/, ''); };
const norm = (t: string) => t.replace(/[^a-z0-9]/g, '');

/** Every field entry on ticket types whose name matches. */
function formFields(p: Plan, tt: RegExp) {
  const out: { ref: string; mandatory?: boolean }[] = [];
  for (const s of find(p, 'ticket_type', tt)) {
    out.push(...(s.fields ?? []), ...(s.set?.add_fields ?? []));
    for (const m of s.set?.field_mandatory ?? []) out.push(m);
  }
  return out;
}
const onForm = (tt: RegExp, label: RegExp, required?: boolean): Check['ok'] => (p) =>
  formFields(p, tt).some((f) => (label.test(fieldLabel(p, f.ref)) || label.test(norm(fieldLabel(p, f.ref)))) && (required === undefined || Boolean(f.mandatory) === required));
const showRule = (tt: RegExp, field: RegExp, when: RegExp, equals: RegExp): Check['ok'] => (p) =>
  find(p, 'ticket_type', tt).some((s) => (s.set?.show_field_when ?? []).some((c) => field.test(fieldLabel(p, c.field)) && when.test(fieldLabel(p, c.when)) && [c.equals].flat().some((e) => equals.test(String(e).toLowerCase()))));
const withApproval = (tt: RegExp): Check['ok'] => (p) => find(p, 'ticket_type', tt).some((s) => s.approval || s.set?.approval);
const withTeam = (tt: RegExp, team: RegExp): Check['ok'] => (p) => find(p, 'ticket_type', tt).some((s) => team.test(refName(p, s.team ?? s.set?.team)));
const options = (label: RegExp, want: string[]): Check['ok'] => (p) =>
  steps(p).some((s) => s.object === 'field' && label.test(strip(s.label ?? s.name)) && want.every((w) => (s.options ?? []).some((o) => o.toLowerCase() === w.toLowerCase())))
  || steps(p).some((s) => s.object === 'field' && s.action === 'reuse' && label.test(strip(s.match?.name).replace(/^cf/, '')));
const members = (object: PlanStep['object'], re: RegExp, people: RegExp[]): Check['ok'] => (p) =>
  find(p, object, re).some((s) => { const all = [...(s.members ?? []), ...(s.set?.add_members ?? [])].map((m) => String(m).toLowerCase()); return people.every((r) => all.some((m) => r.test(m))); });
const pauses = (re: RegExp): Check['ok'] => has('status', re, (s) => /pause|hold|stop/i.test(String(s.sla_action ?? s.set?.sla_action ?? '')));
const routes = (value: RegExp, team: RegExp): Check['ok'] => (p) =>
  steps(p).some((s) => s.object === 'ticket_rule' && (s.when ?? []).some((w) => value.test(JSON.stringify(w).toLowerCase())) && team.test(refName(p, s.then?.team)));
const insertsStage = (re: RegExp): Check['ok'] => (p) =>
  steps(p).some((s) => s.object === 'workflow' && [...(s.insert_steps ?? []), ...(s.set?.insert_steps ?? []), ...(s.insert_step ? [s.insert_step] : [])].some((i) => re.test(i.name.toLowerCase().replace(/^zz\s+(s\w+|enact test)\s+/, ''))));
const count = (object: PlanStep['object'], re: RegExp, n: number): Check['ok'] => (p) => find(p, object, re).length >= n;

const C = (what: string, ok: Check['ok']): Check => ({ what, ok });

export const EXPECTED: Record<string, Check[]> = {
  northgate: [
    C('Organisation Northgate Housing', has('organisation', /northgate/)),
    C('Three sites (Head Office, Leeds Depot, Hull Office)', (p) => [/head office/, /leeds/, /hull/].every((r) => find(p, 'site', r).length)),
    C('Five users, Tom Reilly at Leeds Depot', (p) => find(p, 'user', /./).length >= 5 && find(p, 'user', /tom|reilly/).some((s) => /leeds/.test(refName(p, s.site)))),
    C('Office Hours 08:00–18:00', has('working_hours', /office hours/, (s) => /08:?00|8:00/.test(String(s.start)) && /18:?00/.test(String(s.end)))),
    C('Eight 2027 bank holidays', (p) => steps(p).filter((s) => s.object === 'holiday' && /2027/.test(String(s.date))).length >= 8),
    C('Teams: Service Desk, Infrastructure, HR Operations', (p) => [/service desk/, /infrastructure/, /hr operations/].every((r) => find(p, 'team', r).length)),
    C('Infrastructure team has James Brown', members('team', /infrastructure/, [/james|brown/])),
    C('CAB: 3 members, 2 approvals', has('approval_group', /cab/, (s) => (s.members?.length ?? 0) >= 3 && Number(s.approvals_needed) === 2)),
    C('IT Security approval group', count('approval_group', /it security/, 1)),
    C('Request SLA with 4 targets', has('sla', /request sla/, (s) => Object.keys(s.targets ?? {}).length >= 4)),
    C('Awaiting Third Party pauses the SLA', pauses(/awaiting third party/)),
    C('Role Service Desk Lead copied from IT Agent', has('role', /service desk lead/, (s) => /it agent/i.test(String(s.based_on_role ?? s.based_on)))),
    C('Two canned replies', count('canned_text', /./, 2)),
    C('Two KB articles', count('kb_article', /./, 2)),
    C('Laptop asset type', count('asset_type', /laptop/, 1)),
    C('Four ticket types', (p) => [/new starter/, /access request/, /normal change/, /facilities repair/].every((r) => find(p, 'ticket_type', r).length)),
    C('New Starter: Equipment Needed is multi-select', options(/equipment needed/, ['Laptop', 'Mobile', 'Monitor', 'Headset', 'Other'])),
    C('New Starter: Other Equipment shown for Other', showRule(/new starter/, /other equipment/, /equipment/, /other/)),
    C('New Starter: workflow gets Awaiting Equipment', insertsStage(/awaiting equipment/)),
    C('Access Request: Admin Reason shown for Admin', showRule(/access request/, /admin reason/, /access level/, /admin/)),
    C('Access Request: Access End Date shown for Temporary', showRule(/access request/, /end date/, /duration/, /temporary/)),
    C('Normal Change: CAB Review stage', insertsStage(/cab review/)),
    C('Normal Change has an approval', withApproval(/normal change/)),
    C('Water Leak routed to Infrastructure', routes(/water leak/, /infrastructure/)),
  ],
  'service-requests': [
    C('Seven request types', (p) => [/new starter/, /leaver/, /access request/, /software/, /hardware/, /mobile/, /connectivity|ip|port/].every((r) => find(p, 'ticket_type', r).length)),
    C('Teams IT Services and Connectivity', (p) => find(p, 'team', /it services/).length > 0 && find(p, 'team', /connectivity/).length > 0),
    C('New Starter goes to IT Services', withTeam(/new starter/, /it services/)),
    C('Connectivity goes to Connectivity', withTeam(/connectivity|ip|port/, /connectivity/)),
    C('Site / Building list (5 options)', options(/site/, ['Head Office', 'City Tower', 'Science Park', 'Riverside', 'Other'])),
    C('New Starter: Start Date required', onForm(/new starter/, /start date|startdate/, true)),
    C('New Starter: Other Equipment Details shown for Other', showRule(/new starter/, /other equipment/, /equipment/, /other/)),
    C('Access: Admin Access Justification shown for Admin', showRule(/access/, /admin/, /access level/, /admin/)),
    C('Access: Access End Date shown for Temporary', showRule(/access/, /end date/, /duration/, /temporary/)),
    C('Access has an approval', withApproval(/access/)),
    C('Connectivity: IP / VLAN shown for IP Address', showRule(/connectivity|ip|port/, /ip|vlan/, /request type/, /ip address/)),
    C('Acknowledgement email', count('email_template', /ack|logged|received/, 1)),
    C('A service for each request type', count('service', /./, 7)),
  ],
  change: [
    C('Normal and Emergency change types', (p) => find(p, 'ticket_type', /normal/).length > 0 && find(p, 'ticket_type', /emergency/).length > 0),
    C('Systems affected: multi-select with 5 systems', options(/system/, ['Network', 'Servers', 'Microsoft 365', 'Line-of-business apps', 'Telephony'])),
    C('Risk: Low, Medium, High', options(/risk/, ['Low', 'Medium', 'High'])),
    C('Outage question optional', onForm(/normal/, /outage|notice/, false)),
    C('Backout plan required', onForm(/normal/, /backout/, true)),
    C('Emergency: reason it can’t wait', onForm(/emergency/, /reason|wait|urgen/)),
    C('CAB: James Brown, Mary Johnson, Olivia Chen, 2 approvals', has('approval_group', /cab/, (s) => (s.members?.length ?? 0) >= 3 && Number(s.approvals_needed) === 2)),
    C('Emergency approvers: one of Patricia Jones or Ken Yang', has('approval_group', /emergency|ecab/, (s) => Number(s.approvals_needed ?? 1) === 1)),
    C('Rolled Back status', count('status', /rolled back/, 1)),
    C('A status that pauses the SLA (change window)', (p) => steps(p).some((s) => s.object === 'status' && /pause|hold|stop/i.test(String(s.sla_action ?? s.set?.sla_action ?? '')))),
    C('Both go to Infrastructure', (p) => withTeam(/normal/, /infrastructure/)(p) && withTeam(/emergency/, /infrastructure/)(p)),
  ],
  mi: [
    C('Incident and Major Incident types', (p) => find(p, 'ticket_type', /^incident|incidents?$/).length > 0 && find(p, 'ticket_type', /major/).length > 0),
    C('Affected service list (7)', options(/affected service/, ['Email', 'Microsoft Teams', 'VPN', 'Finance system', 'HR system', 'Website', 'Phones'])),
    C('Workaround description shown for Yes', showRule(/incident/, /workaround/, /workaround/, /yes/)),
    C('Priority rules from impact and urgency', (p) => steps(p).filter((s) => s.object === 'ticket_rule' && (s.then?.priority !== undefined || s.set?.priority !== undefined)).length >= 3),
    C('Awaiting User pauses the SLA', pauses(/awaiting user/)),
    C('Finance system routed to Finance Applications', routes(/finance/, /finance/)),
    C('Acknowledgement and resolution emails', count('email_template', /./, 2)),
    C('Major Incident: Started, impact summary, incident manager required', (p) => onForm(/major/, /started/, true)(p) && onForm(/major/, /impact/, true)(p) && onForm(/major/, /incident manager|manager/, true)(p)),
    C('Notify the Major Incident team on log', count('notification', /./, 1)),
    C('Three child tickets on a major incident', (p) => steps(p).some((s) => s.object === 'ticket_template' && (s.children?.length ?? 0) >= 3)),
  ],
  jml: [
    C('New Joiner, Mover and Leaver types', (p) => [/joiner/, /mover/, /leaver/].every((r) => find(p, 'ticket_type', r).length)),
    C('Joiner: End date shown for Contractor', showRule(/joiner/, /end date/, /contract/, /contractor/)),
    C('Joiner: software is multi-select', options(/software/, ['Office 365', 'Salesforce', 'Adobe', 'Jira'])),
    C('Joiner: Start date required', onForm(/joiner/, /start date|startdate/, true)),
    C('People Operations team: Kaleem Smith, Jennifer Williams', members('team', /people operations/, [/kaleem|smith/, /jennifer|williams/])),
    C('IT Security Approvers: Robert James', members('approval_group', /it security/, [/robert|james/])),
    C('Joiner has an approval', withApproval(/joiner/)),
    C('Buttons: Equipment Ordered and Accounts Created', (p) => find(p, 'outcome', /equipment ordered/).length > 0 && find(p, 'outcome', /accounts created/).length > 0),
    C('A waiting-on-equipment status that pauses the SLA', (p) => steps(p).some((s) => s.object === 'status' && /pause|hold|stop/i.test(String(s.sla_action ?? s.set?.sla_action ?? '')))),
    C('SLAs for joiners, leavers and dismissals', count('sla', /./, 3)),
    C('Categories under People', count('category', /people|joiner|mover|leaver/, 1)),
  ],
  portal: [
    C('Categories: Pay and Benefits, Family Leave', (p) => find(p, 'service_category', /pay and benefits/).length > 0 && find(p, 'service_category', /family leave/).length > 0),
    C('No category four levels deep', (p) => !find(p, 'service_category', /it setup/).some((s) => s.parent && byId(p, s.parent)?.parent && byId(p, byId(p, s.parent)?.parent)?.parent)),
    C('Payslip Query and Maternity Leave types', (p) => find(p, 'ticket_type', /payslip/).length > 0 && find(p, 'ticket_type', /maternity/).length > 0),
    C('Query details is rich text', has('field', /query details/, (s) => s.type === 'richtext')),
    C('Maternity: attachment required on every ticket', has('ticket_type', /maternity/, (s) => Number(s.set?.attachments?.min ?? 0) >= 1)),
    C('Payslip: attachments allowed, not required', has('ticket_type', /payslip/, (s) => s.set?.attachments?.allow === true && Number(s.set?.attachments?.min ?? 0) === 0)),
    C('Two services', count('service', /payslip|maternity/, 2)),
    C('Payslip service renamed', has('service', /payslip/, (s) => /payslip and pay query/i.test(String(s.set?.name ?? '')))),
  ],
};
EXPECTED['jml-casual'] = EXPECTED.jml;

export function score(id: string, plan: Plan | null): { passed: number; total: number; missed: string[] } | null {
  const list = EXPECTED[id];
  if (!list || !plan) return null;
  const missed = list.filter((c) => { try { return !c.ok(plan); } catch { return true; } }).map((c) => c.what);
  return { passed: list.length - missed.length, total: list.length, missed };
}

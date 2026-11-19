/**
 * M24 (14 Nov): what a brief writes out, held against the plan in code, with no model call.
 * A brief that lists a form's fields ("- Label: type, required (help) ... If Other is picked, show X") is a spec: every
 * field must be on that form, every "show X when Y is Z" must be a show rule, and the form's help text is the brief's.
 * Help text is repaired (it's unambiguous); a missing field or show rule is reported, so the fix pass adds it.
 */
import { splitForms } from './forms';
import type { Plan, PlanStep } from './plan-types';

type BriefField = { label: string; required?: boolean; help?: string; rules: { value: string; show: string[] }[] };
type BriefForm = { title: string; ticketType?: string; fields: BriefField[] };

const norm = (t: string) => t.toLowerCase().replace(/^zz\s+(s\w+|enact test)\s+/, '').replace(/[^a-z0-9]/g, '');
// Same word stems as the builder's F8 ("Start Date" ~ "Starting Date"), so the check agrees with what the build reuses.
const stem = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.replace(/(ing|ed|s)$/, '')).join('');
const sameLabel = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y || stem(a) === stem(b)) return true;
  // "Department / Team" and "Department" are the same field; "Other requester type" and "Requester type" aren't.
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 5 && long.includes(short) && short.length / long.length >= 0.6 && !/other|details|reason|justification/.test(long.replace(short, ''));
};
const SKIP = /nothing to create|not built|halo'?s own|halo’s own|attachment|signature/i;
const TYPE = /\b(text|memo|date|single selection|multiple selection|multi-select|multiselect|dropdown|user lookup|user picker|picker|tick box|checkbox|rich text|number|yes ?\/ ?no)\b/i;

function readField(line: string): BriefField | null {
  const m = line.match(/^\s*[-•*]\s+"?([^:"]+?)"?\s*(?::|,)\s+(.*)$/);
  if (!m || SKIP.test(line)) return null;
  const [, label, rest] = m;
  if (!TYPE.test(rest.split(/\.\s|Show rules|If /i)[0])) return null;
  const head = rest.split(/\bShow rules\b|\bIf\b/)[0];
  // The first requirement word outside brackets decides ("optional (… never required)" is optional).
  const word = head.replace(/\([^)]*\)/g, ' ').match(/\b(required|mandatory|conditional|optional)\b/i)?.[1]?.toLowerCase();
  const required = word ? word !== 'optional' : undefined;
  const help = rest.match(/Help text:\s*"([^"]*)"/i)?.[1] ?? head.match(/\(([^()]{3,})\)\s*\.?\s*$/)?.[1];
  const rules: BriefField['rules'] = [];
  // "If 'Other' selected → show fields: A and B" (design sheets)
  for (const r of rest.matchAll(/If\s+'([^']+)'(?:\s+or\s+'([^']+)')?\s+(?:is\s+)?(?:selected|picked|chosen)\s*→\s*show\s+fields?:\s*([^/]+)/gi)) {
    const show = r[3].split(/\.\s|Help text/i)[0].replace(/\([^)]*\)/g, '').split(/,|\band\b/).map((x) => x.trim().replace(/\.$/, '')).filter(Boolean);
    for (const v of [r[1], r[2]].filter(Boolean) as string[]) rules.push({ value: v, show });
  }
  // "If Other is picked, show Other Equipment Details, memo, required." / 'If Yes, show "Admin Justification"'
  for (const r of rest.matchAll(/If\s+(?!')([^,.→]+?)(?:\s+is\s+(?:picked|selected|chosen))?,\s*show\s+"?([^",.]+)"?/gi)) {
    if (/\b(the|their|a|an)\b/i.test(r[1]) && r[1].split(' ').length > 4) continue; // a sentence, not a value
    rules.push({ value: r[1].trim(), show: [r[2].trim()] });
  }
  return { label: label.trim(), required, help, rules };
}

export function readBriefForms(request: string): BriefForm[] {
  const split = splitForms(request, 1);
  const blocks = split ? split.forms.map((f) => ({ title: f.title, text: f.text })) : [{ title: '', text: request }];
  const out: BriefForm[] = [];
  for (const b of blocks) {
    const names = [...b.text.matchAll(/Ticket type:?\s*"([^"]+)"/gi)].map((m) => m[1].trim());
    if (new Set(names.map((n) => n.toLowerCase())).size > 1) continue; // several forms in one block: can't tell whose line is whose
    const fields = b.text.split('\n').map(readField).filter((f): f is BriefField => !!f);
    if (fields.length) out.push({ title: b.title.replace(/\s*\(.*$/, '').trim(), ticketType: names[0], fields });
  }
  return out;
}

/** The plan's ticket type for a brief form: by its "Ticket type" name, else by the part's title. One match or none. */
function typeFor(plan: Plan, form: BriefForm): PlanStep[] {
  const types = (plan.steps as PlanStep[]).filter((s) => s.object === 'ticket_type');
  for (const want of [form.ticketType, form.title].filter(Boolean) as string[]) {
    const names = [...new Set(types.map((s) => String(s.name ?? s.match?.name ?? '')).filter((n) => sameLabel(n, want)))];
    if (names.length === 1) return types.filter((s) => String(s.name ?? s.match?.name ?? '') === names[0]);
  }
  return [];
}

type Labeller = (ref: string) => string;
export function makeLabeller(plan: Plan, customFields: Record<string, string>): Labeller {
  return (ref) => {
    const st = (plan.steps as PlanStep[]).find((x) => x.id === ref);
    if (!st) return ref;
    if (st.action === 'create') return String(st.label ?? st.name ?? '');
    return String(customFields[st.match?.name ?? '']?.match(/^"([^"]*)"/)?.[1] ?? st.match?.name ?? '');
  };
}

/** Help text: each brief field's help text becomes that form's own (F14), unless already the same. */
export function applyWrittenHints(plan: Plan, request: string, customFields: Record<string, string>) {
  const label = makeLabeller(plan, customFields);
  const ownHint = (ref: string) => {
    const st = (plan.steps as PlanStep[]).find((x) => x.id === ref);
    return st?.action === 'create' ? st.hint : customFields[st?.match?.name ?? '']?.match(/\(hint: (.*)\)\s*$/)?.[1];
  };
  for (const form of readBriefForms(request)) {
    for (const tt of typeFor(plan, form)) {
      for (const e of [...(tt.fields ?? []), ...(tt.set?.add_fields ?? [])]) {
        const l = label(e.ref);
        const bf = form.fields.find((f) => norm(f.label) === norm(l)) ?? form.fields.find((f) => sameLabel(f.label, l));
        if (bf?.help && e.hint === undefined && (ownHint(e.ref) ?? '') !== bf.help) e.hint = bf.help;
      }
    }
  }
}

/** What the brief writes out that the plan doesn't have: each a check error the fix pass works from. */
export function coverageErrors(plan: Plan, request: string, customFields: Record<string, string>, existingFormFields: Record<string, string[]> = {}): string[] {
  const label = makeLabeller(plan, customFields);
  const errors: string[] = [];
  for (const form of readBriefForms(request)) {
    const tts = typeFor(plan, form);
    if (!tts.length) continue;
    const typeName = String(tts[0].name ?? tts[0].match?.name);
    const onForm = [
      ...tts.flatMap((t) => [...(t.fields ?? []), ...(t.set?.add_fields ?? []), ...(t.set?.field_mandatory ?? [])].map((e) => label(e.ref))),
      ...(existingFormFields[Object.keys(existingFormFields).find((k) => k.toLowerCase() === typeName.toLowerCase()) ?? ''] ?? []),
    ];
    const rules = tts.flatMap((t) => t.set?.show_field_when ?? []);
    // Anything the plan already explains under "can't do yet" is accounted for.
    const explained = (t: string) => (plan.unsupported ?? []).some((u) => norm(u).includes(norm(t)));
    for (const f of form.fields) {
      if (!onForm.some((l) => sameLabel(l, f.label)) && !explained(f.label)) errors.push(`"${typeName}": the brief lists the field "${f.label}" but the plan doesn't put it on this form (rule M24). Add it, or say in unsupported why not.`);
      for (const r of f.rules) for (const target of r.show) {
        const ok = rules.some((c) => sameLabel(label(c.field), target) && sameLabel(label(c.when), f.label) && [c.equals].flat().some((v) => norm(String(v)) === norm(r.value)));
        if (!ok && !explained(target)) errors.push(`"${typeName}": the brief shows "${target}" when "${f.label}" is "${r.value}", but the plan has no such show rule (rule M24). Add it to show_field_when, or say in unsupported why not.`);
      }
    }
  }
  return errors;
}

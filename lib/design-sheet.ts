/**
 * The partner "Request Form Design Template" (Form Name, Category, Description, Workflow, Approval Process,
 * Auto-routing Team, Form Field(s), Field Type, Mandatory?, Options / Values, Dynamic Logic, Help Text, Notes) read in
 * code into an exact brief: every label, option, show rule and help text word for word, one "=== FORM ===" part per
 * form (rule M14). The planner then only decides how to build it in Halo, never what the form says.
 */

type Row = (string | null)[];

const HEAD = {
  form: ['form name'],
  category: ['category'],
  description: ['description'],
  workflow: ['workflow'],
  approval: ['approval process', 'approval'],
  team: ['auto-routing team', 'team'],
  label: ['form fields', 'form field', 'field label', 'field name'],
  type: ['field type', 'type'],
  mandatory: ['mandatory?', 'mandatory'],
  options: ['options / values', 'options', 'values'],
  logic: ['dynamic logic', 'show rules', 'logic'],
  hint: ['help text', 'hint'],
  notes: ['notes', 'build notes'],
} as const;
type Col = keyof typeof HEAD;

const clean = (v: string | null | undefined) => String(v ?? '').replace(/\s*\n\s*/g, ' / ').replace(/\s+/g, ' ').trim().replace(/,$/, '');

/** Where each column is, if this row is the template's header row. */
function headerOf(row: Row): Partial<Record<Col, number>> | null {
  const cells = row.map((c) => clean(c).toLowerCase());
  const at: Partial<Record<Col, number>> = {};
  for (const [col, names] of Object.entries(HEAD) as [Col, readonly string[]][]) {
    const i = cells.findIndex((c) => names.includes(c));
    if (i >= 0) at[col] = i;
  }
  return at.form !== undefined && at.label !== undefined && at.type !== undefined ? at : null;
}

const TYPE: Record<string, string> = {
  text: 'text', memo: 'memo', 'single selection': 'single selection', dropdown: 'single selection', 'multiple selection': 'multiple selection',
  date: 'date', 'date and time': 'date', checkbox: 'checkbox', number: 'text (numbers)', currency: 'text (an amount)',
  'user lookup': 'user picker (live list of Halo users)',
};
const NOT_BUILT: Record<string, string> = {
  attachment: "Attachment: NOT BUILT (Halo's own ticket attachments cover this)",
  table: 'Table: NOT BUILT',
  rich: 'Rich text: NOT BUILT',
};
const HALO_OWN: Record<string, string> = {
  requester: "from Halo's own user on the ticket; nothing to create",
  requestor: "from Halo's own user on the ticket; nothing to create",
  'requester name': "from Halo's own user on the ticket; nothing to create",
  'requestor name': "from Halo's own user on the ticket; nothing to create",
  'requester email': "from Halo's own user on the ticket; nothing to create",
  'requester email address': "from Halo's own user on the ticket; nothing to create",
  'requestor email': "from Halo's own user on the ticket; nothing to create",
  'enquiry subject': "Halo's own Summary field; nothing to create",
  summary: "Halo's own Summary field; nothing to create",
  'details of enquiry': "Halo's own Details field; nothing to create",
};

export const DESIGN_RULES = `Build these request forms in Halo. Each form is its own ticket type, with its fields, show rules and help text. Rules for every form:
- Ticket type names, field labels, options and help text exactly as written below. Each field's help text goes in as its hint, word for word. Don't add fields, options or help text that aren't written here.
- "mandatory" = required. "conditional" = only shown when its show rule is met, and required when shown. A field with a show rule that says mandatory is also required only when shown.
- Show rules are written as: If 'X' selected → show field: Y. A field shown for several answers is shown if ANY of them is picked.
- Fields that come from Halo's own user, Summary or Details: don't create them.
- "text (numbers)" and "text (an amount)": build as text fields.
- A list described as a site or location list is a live list of Halo's sites. Any other "agreed" list whose values aren't written: create the field with no options and list it under can't do yet. Don't invent values.
- Anything marked NOT BUILT: don't build it, list it. Show rules may depend on a single or a multiple selection answer.
- Fields with the same label, type and options on several forms are one field, reused. Different options: separate fields. Different help text: still one field, with each form's own help text as its override (field entry hint).
- Reuse an existing field only when its type matches; never rename or change a field, section or ticket type you reuse.
- "Portal category" is where the form appears in the self-service portal, NOT a ticket category: don't create ticket categories or rules for it. If a service category exists with that name, or with the name of any part of the path (the deepest part that exists wins: "Onboarding" in "HR > Recruitment > Onboarding > IT"), add a service for the form there (its summary is the form's description, word for word, and it logs the form's ticket type); otherwise list it.
- Workflow and team: reuse the existing workflow or team the design names, if one with that name exists. If the design describes stages or approvals instead of naming a workflow, pick the instance's closest existing workflow (service request with approval when the form has an approval, without approval when it doesn't; incident or change workflows for those kinds) and name it in assumptions; don't create or change workflows unless the design asks for a new stage. Approvals: don't build them unless asked below; list them. Every form gets a workflow.
- Don't change any other ticket type, field or form section.`;

/** A design sheet as an exact brief, or null when the sheet isn't in the template's format. */
export function designSheetBrief(sheets: { sheet: string; data: Row[] }[]): { brief: string; forms: number; fields: number } | null {
  const parts: string[] = [];
  let fields = 0;
  for (const { data } of sheets) {
    const hi = data.findIndex((r) => headerOf(r));
    if (hi < 0) continue;
    const at = headerOf(data[hi])!;
    const get = (r: Row, c: Col) => (at[c] === undefined ? '' : clean(r[at[c]!]));
    let form: string[] | null = null;
    const flush = () => { if (form) parts.push(form.join('\n')); };
    for (const r of data.slice(hi + 1)) {
      const name = get(r, 'form');
      if (name) {
        flush();
        const meta = [
          `Ticket type: "${name}".`,
          get(r, 'category') && `Portal category: ${get(r, 'category')}.`,
          get(r, 'description') && `Description (the portal text for its service, not a field): ${get(r, 'description')}`,
          get(r, 'workflow') && `Workflow in the design: ${get(r, 'workflow')}`,
          get(r, 'approval') && `Approval in the design: ${get(r, 'approval')}`,
          get(r, 'team') && `Team in the design: ${get(r, 'team')}`,
        ].filter(Boolean);
        form = [`=== FORM: ${name} ===`, ...meta, 'Fields, in this order:'];
      }
      const label = get(r, 'label');
      if (!form || !label) continue;
      fields++;
      const ftype = get(r, 'type');
      const t = ftype.toLowerCase();
      const own = HALO_OWN[label.toLowerCase()] ?? (t === 'auto-populated' ? "auto-populated: from Halo's own user on the ticket; nothing to create" : undefined);
      if (own) { form.push(`- ${label}: ${own}.`); continue; }
      if (NOT_BUILT[t]) { form.push(`- ${label}: ${NOT_BUILT[t]}.`); continue; }
      const mand = get(r, 'mandatory').toLowerCase();
      const m = mand.startsWith('y') ? 'mandatory' : mand.startsWith('c') ? 'conditional' : 'optional';
      const opts = get(r, 'options');
      let line = `- ${label}: ${TYPE[t] ?? (ftype || 'type not given')}, ${m}.`;
      if (opts) {
        if (['text', 'memo', 'number', 'currency'].includes(t) && !/^use /i.test(opts)) line += ` Default value in the design: "${opts}" (set it if you can, otherwise list it).`;
        else if (t === 'checkbox') line += ` Checkbox text: "${opts}".`;
        else line += ` Options: ${opts}.`;
      }
      if (get(r, 'logic')) line += ` Show rules: ${get(r, 'logic')}.`;
      if (get(r, 'hint')) line += ` Help text: "${get(r, 'hint')}"`;
      if (get(r, 'notes')) line += ` Note: ${get(r, 'notes')}`;
      form.push(line);
    }
    flush();
  }
  return parts.length ? { brief: parts.join('\n\n'), forms: parts.length, fields } : null;
}

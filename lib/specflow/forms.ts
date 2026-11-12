/**
 * M14: a long brief marked into forms ("=== FORM: Name ===" lines). Shared by the browser (which plans each form in
 * its own request, so no single request runs into the time limit) and the server (which merges them).
 */
export type FormSplit = { preamble: string; forms: { title: string; text: string }[] };

export function splitForms(request: string): FormSplit | null {
  const marks = [...request.matchAll(/^={3,}\s*FORM:\s*(.+?)\s*=*\s*$/gim)];
  if (marks.length < 2) return null;
  return {
    preamble: request.slice(0, marks[0].index).trim(),
    forms: marks.map((m, i) => ({ title: m[1].trim(), text: request.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim() })),
  };
}

/** What the planner is given for one form. */
export function formRequest(split: FormSplit, i: number): string {
  const f = split.forms[i];
  const n = split.forms.length;
  return `${split.preamble}\n\nThis is part ${i + 1} of ${n} of a larger request. Plan ONLY the form "${f.title}" below; the other parts are planned separately and merged afterwards. Create every field this part needs, even if another part needs the same one: identical fields (same label, type and options) and a ticket type of the same name are merged automatically. Build the whole part: if a choice or question affects one setting (a team, a category), leave out only that setting and build everything else.\n\n=== FORM: ${f.title} ===\n${f.text}`;
}

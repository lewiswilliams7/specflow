/**
 * M14: a long brief marked into forms ("=== FORM: Name ===" lines). Shared by the browser (which plans each form in
 * its own request, so no single request runs into the time limit) and the server (which merges them).
 */
export type FormSplit = { preamble: string; forms: { title: string; text: string }[] };

/** min: how many forms make it worth splitting. A form design (attached spreadsheet) is planned in parts even when it
 *  has one form: its own request with low reasoning keeps a long form inside the time limit. */
export function splitForms(request: string, min = /\(read as a form design/.test(request) ? 1 : 2): FormSplit | null {
  const marks = [...request.matchAll(/^={3,}\s*FORM:\s*(.+?)\s*=*\s*$/gim)];
  if (marks.length < min || !marks.length) return null;
  return {
    preamble: request.slice(0, marks[0].index).trim(),
    forms: marks.map((m, i) => ({ title: m[1].trim(), text: request.slice(m.index! + m[0].length, i + 1 < marks.length ? marks[i + 1].index : undefined).trim() })),
  };
}

/** What the planner is given for one form. */
export function formRequest(split: FormSplit, i: number): string {
  const f = split.forms[i];
  const n = split.forms.length;
  // A shared part (teams, SLAs, groups...) is planned once on its own; every other part sees it, so it reuses those
  // exact names and members instead of making up its own (12 Nov: a form part created the Infrastructure team with the
  // wrong member).
  const shared = split.forms.find((x, j) => j !== i && /shared|setup|general|common|foundation/i.test(x.title));
  const context = shared ? `\n\nFor reference only (planned in its own part "${shared.title}"; do NOT plan it here): the shared setup this part relies on. If this part needs one of these teams, groups, SLAs, statuses or categories, create it with EXACTLY the name, members and settings given here (the copies are merged into one).\n---\n${shared.text}\n---` : '';
  return `${split.preamble}\n\nThis is part ${i + 1} of ${n} of a larger request. Plan ONLY the form "${f.title}" below; the other parts are planned separately and merged afterwards. Create every field this part needs, even if another part needs the same one: identical fields (same label, type and options) and a ticket type of the same name are merged automatically. Build the whole part: if a choice or question affects one setting (a team, a category), leave out only that setting and build everything else.${context}\n\n=== FORM: ${f.title} ===\n${f.text}`;
}

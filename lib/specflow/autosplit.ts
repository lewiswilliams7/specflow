/**
 * M17 (13 Nov run-through): a long brief written as prose (no "=== FORM ===" markers) is split into a shared part and one
 * part per request type, so it takes the same path as a marked brief: parts planned in parallel at low effort, each
 * with its own fix pass, then merged and checked. Planned in one go, such a brief took 200-300s and either timed out
 * or had no time left for a fix pass. The model only returns line numbers; the text itself is never rewritten.
 */
import { complete } from './llm';

const SYSTEM = `You split a HaloITSM configuration brief into parts. The brief's lines are numbered.
Return JSON: {"shared":[[from,to],...],"forms":[{"title":"...","lines":[[from,to],...]}]}
- A form is ONE request or ticket type the brief asks for (an incident type, a service request, a change type, a starter/mover/leaver request). Its title is that type's name as the brief gives it.
- shared is everything not specific to one form: the introduction, naming rules, teams, people, SLAs, working hours, approval groups, categories, statuses, lists, workflows or emails used by several forms, and general rules.
- Every line goes in shared or in exactly ONE form. A line about several forms goes in shared.
- Keep each form's own fields, show rules, approval, routing, workflow, emails and portal text with that form.
- If the brief asks for fewer than two request types, return {"shared":[],"forms":[]}.
Return only the JSON.`;

export async function autoSplit(brief: string, opts: { signal?: AbortSignal; cacheKey?: string } = {}): Promise<string | null> {
  const lines = brief.split('\n');
  // Even a short brief with two or more request types plans faster, and with a fix pass, in parts (13 Nov: the change
  // brief, 1,400 characters, took 147s in one go and had no time left to fix).
  if (brief.length < 800 || lines.length < 4) return null;
  const numbered = lines.map((l, i) => `${i + 1}: ${l}`).join('\n');
  // Finding line ranges is simple: the small model at minimal effort costs about a twentieth of a planning call.
  const reply = await complete(SYSTEM, numbered, { effort: 'minimal', model: process.env.SPLIT_MODEL?.trim() || 'gpt-5-mini', ...opts });
  let parsed: { shared?: number[][]; forms?: { title?: string; lines?: number[][] }[] };
  try {
    parsed = JSON.parse(reply.text);
  } catch {
    return null;
  }
  const forms = (parsed.forms ?? []).filter((f) => f.title?.trim() && f.lines?.length);
  if (forms.length < 2) return null;
  const owner = new Array<string | null>(lines.length).fill(null);
  const take = (ranges: number[][] | undefined, who: string) => {
    for (const [a, b] of ranges ?? []) for (let n = Math.max(1, a); n <= Math.min(lines.length, b ?? a); n++) if (owner[n - 1] === null) owner[n - 1] = who;
  };
  forms.forEach((f, i) => take(f.lines, `f${i}`));
  // Anything not given to a form (including lines the split left out) is shared, so nothing in the brief is lost.
  const pick = (who: string) => lines.filter((_, i) => (owner[i] ?? 'shared') === who).join('\n').trim();
  const titles = new Set<string>();
  const parts = forms.map((f, i) => {
    let t = f.title!.trim().replace(/=+/g, '').slice(0, 80);
    while (titles.has(t.toLowerCase())) t += ' (2)';
    titles.add(t.toLowerCase());
    return { title: t, text: pick(`f${i}`) };
  }).filter((p) => p.text);
  if (parts.length < 2) return null;
  const shared = pick('shared');
  return [shared ? `=== FORM: Shared setup ===\n${shared}` : '', ...parts.map((p) => `=== FORM: ${p.title} ===\n${p.text}`)].filter(Boolean).join('\n\n');
}

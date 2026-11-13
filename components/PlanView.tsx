import { BuildPanel, type LastBuild } from '@/components/BuildPanel';
import { EmailPreview } from '@/components/EmailPreview';
import { brandingLive } from '@/lib/brand';
import { brandedEmail, type EmailBrand, textToHtml } from '@/lib/specflow/build/email-brand';
import { IconChevron } from '@/components/icons';
import { counts, describeParts, describe, humanise, type Inv, stageText, title } from '@/lib/specflow/describe';
import type { Plan, PlanStep } from '@/lib/specflow/plan-types';

const KIND: Record<PlanStep['object'], string> = {
  team: 'team', field: 'field', sla: 'SLA', approval_process: 'approval', ticket_type: 'ticket type', status: 'status',
  outcome: 'action', workflow: 'workflow', agent: 'agent', approval_group: 'approval group', field_group: 'form section',
  email_template: 'email template', ticket_rule: 'ticket rule', ticket_template: 'child tickets', category: 'category', notification: 'notification',
  service: 'service', service_category: 'service category', user: 'user', site: 'site', organisation: 'organisation', working_hours: 'working hours', holiday: 'bank holiday', canned_text: 'canned text', lookup_value: 'list value', kb_article: 'knowledge base article', faq_list: 'FAQ list', role: 'role', asset_type: 'asset type', asset_group: 'asset group',
};
const COVER: Record<string, { cls: string; sign: string; label: string }> = {
  built: { cls: 'keep', sign: '=', label: 'Already there' },
  partial: { cls: 'change', sign: '~', label: 'Partly there' },
  missing: { cls: 'add', sign: '+', label: 'Missing' },
};


type FormRow = { ref: string; label: string; kind: string; isNew: boolean; required?: boolean; when: string[]; hint?: string };
/**
 * A ticket type's form as a table (13 Nov: a 26-field brief read as one paragraph of "add X; show Y only when..."):
 * every field the plan puts on the form, with its type, whether it's required, when it shows and its help text here.
 */
function formOf(s: PlanStep, extra: PlanStep[], plan: Plan, inv: Inv): { rows: FormRow[]; removed: string[] } | null {
  if (s.object !== 'ticket_type') return null;
  const all = [s, ...extra];
  const entries = all.flatMap((x) => [...(x.fields ?? []), ...(x.set?.add_fields ?? [])]);
  const mand = all.flatMap((x) => x.set?.field_mandatory ?? []);
  const hints = all.flatMap((x) => x.set?.field_hints ?? []);
  const rules = all.flatMap((x) => x.set?.show_field_when ?? []);
  const removed = all.flatMap((x) => x.set?.remove_fields ?? []);
  const step = (id: string) => plan.steps.find((x) => x.id === id);
  const label = (id: string) => { const f = step(id); return f ? title(f, inv) : id; };
  const rows: FormRow[] = [];
  const seen = new Set<string>();
  const add = (ref: string, required?: boolean, hint?: string) => {
    if (seen.has(ref)) { const r = rows.find((x) => x.ref === ref); if (r && required !== undefined) r.required = required; return; }
    seen.add(ref);
    const f = step(ref);
    const details = f && f.action !== 'create' ? inv?.details?.custom_fields?.[f.match?.name ?? ''] : undefined;
    const type = f?.action === 'create' ? `${f.type ?? 'field'}${f.dynamic ? ' (live list)' : ''}${f.options?.length ? `: ${f.options.join(', ')}` : ''}` : (details?.match(/^"[^"]*"\s+([^:(]+)/)?.[1]?.trim() ?? 'existing field');
    const own = f?.action === 'create' ? f.hint : details?.match(/\(hint: (.*)\)\s*$/)?.[1];
    rows.push({ ref, label: label(ref), kind: type.replace(/\s*\[dynamic list\]/, ' (live list)').replace(/^multiselect/, 'multi-select'), isNew: f?.action === 'create', required, when: [], hint: hint ?? own });
  };
  for (const e of entries) add(e.ref, e.mandatory, (e as { hint?: string }).hint);
  for (const m of mand) add(m.ref, m.mandatory);
  for (const h of hints) { add(h.ref); const r = rows.find((x) => x.ref === h.ref); if (r) r.hint = h.hint; }
  for (const c of rules) { add(c.field); rows.find((x) => x.ref === c.field)?.when.push(`${label(c.when)} is "${c.equals}"`); }
  if (rows.length < 3 && !removed.length) return null;
  return { rows, removed: removed.map(label) };
}

function FormTable({ form }: { form: { rows: FormRow[]; removed: string[] } }) {
  return (
    <div className="form-table-wrap">
      <table className="form-table">
        <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Shows when</th><th>Help text on this form</th></tr></thead>
        <tbody>
          {form.rows.map((r) => (
            <tr key={r.ref}>
              <td><b>{r.label}</b>{r.isNew ? <span className="badge add tiny">new</span> : null}</td>
              <td>{r.kind}</td>
              <td>{r.required === undefined ? '' : r.required ? (r.when.length ? 'Yes, when shown' : 'Yes') : 'No'}</td>
              <td>{r.when.length ? r.when.join(' or ') : 'Always'}</td>
              <td className="hint-cell">{r.hint ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {form.removed.length ? <p className="subtle">Taken off the form (the fields stay in Halo): {form.removed.join(', ')}</p> : null}
    </div>
  );
}

export type PlanState = 'ready' | 'questions' | 'problems';
export function planState(plan: Plan | null, errors: string[]): PlanState {
  if (!plan || errors.length) return 'problems';
  return plan.questions?.length || plan.choices?.length ? 'questions' : 'ready';
}

export function StateBadge({ state, questions }: { state: PlanState; questions?: number }) {
  if (state === 'ready') return <span className="badge add"><span className="dot" />Ready to build</span>;
  if (state === 'questions') return <span className="badge accent"><span className="dot" />{questions === 1 ? '1 question' : `${questions} questions`} to answer</span>;
  return <span className="badge danger"><span className="dot" />Didn’t pass the checks</span>;
}

/** The plan as a change review: + new, ~ changed, = already there, ! can't do yet. */
export type BuildTarget = { instanceId: string; instanceName: string; baseUrl: string; lastApply: LastBuild };

/** The email a template step will write, as Halo will be sent it (branded once branding is live: rule EM1). */
function emailOf(s: PlanStep, brand: EmailBrand | null | undefined): { subject?: string; html: string } | null {
  if (s.object !== 'email_template') return null;
  const body = s.action === 'create' ? s.body : s.set?.body;
  if (!body) return null;
  const html = brand && brandingLive() ? brandedEmail(body, brand) : textToHtml(body);
  return { subject: s.action === 'create' ? s.subject : s.set?.subject, html };
}

export function PlanView({ plan, errors, inventory, open = true, heading = 'Plan', planId, canBuild = false, target, brand, foot }: { plan: Plan | null; errors: string[]; inventory: Inv; open?: boolean; heading?: string; planId?: string; canBuild?: boolean; target?: BuildTarget; brand?: EmailBrand | null; foot?: React.ReactNode }) {
  const steps = plan?.steps ?? [];
  // An update to something created in the same plan (e.g. setting the new ticket type's workflow) is one change, not two.
  const createdKey = (s: PlanStep) => `${s.object}:${(s.name ?? '').toLowerCase()}`;
  const createdByName = new Map(steps.filter((s) => s.action === 'create').map((s) => [createdKey(s), s]));
  const foldInto = (s: PlanStep) => (s.action === 'update' ? createdByName.get(`${s.object}:${(s.match?.name ?? '').toLowerCase()}`) : undefined);
  const folded = new Map<string, PlanStep[]>();
  for (const s of steps) {
    const host = foldInto(s);
    if (host) folded.set(host.id, [...(folded.get(host.id) ?? []), s]);
  }
  const forms = new Map<string, { rows: FormRow[]; removed: string[] }>();
  if (plan) for (const s of steps) { const f = formOf(s, folded.get(s.id) ?? [], plan, inventory); if (f && s.action !== 'reuse' && !foldInto(s)) forms.set(s.id, f); }
  const onAForm = new Set([...forms.values()].flatMap((f) => f.rows.filter((r) => r.isNew).map((r) => r.ref)));
  const ORDER: PlanStep['object'][] = ['ticket_type', 'service', 'service_category', 'workflow', 'approval_process', 'approval_group', 'team', 'sla', 'field_group', 'field'];
  const rank = (s: PlanStep) => { const i = ORDER.indexOf(s.object); return i < 0 ? ORDER.length - 1 : i; };
  const changes = steps.filter((s) => s.action !== 'reuse' && !foldInto(s)).map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
  // New fields already shown in a form's table aren't listed again one by one.
  const listed = changes.filter((s) => !(s.object === 'field' && s.action === 'create' && onAForm.has(s.id)));
  const groups: { kind: PlanStep['object']; items: PlanStep[] }[] = [];
  for (const s of listed) { const g = groups.at(-1); if (g && g.kind === s.object) g.items.push(s); else groups.push({ kind: s.object, items: [s] }); }
  const says = (s: PlanStep) => {
    if (!plan) return '';
    // A new workflow with stages added over several steps reads as one list, in order.
    if (s.object === 'workflow') {
      const ref = (id?: string) => { const x = steps.find((y) => y.id === id); return x ? title(x, inventory) : id ?? ''; };
      const stages = [...(s.insert_steps ?? []), ...(folded.get(s.id) ?? []).flatMap((u) => u.set?.insert_steps ?? [])].map((i) => stageText(i, ref));
      if (stages.length) return `Copy of "${s.copy_of}", adding ${stages.join('; ')}. Old buttons that skipped past a new stage now lead into it (rule W5).`;
    }
    const extra = (folded.get(s.id) ?? []).map((u) => describe(u, plan, inventory).replace(/\.$/, '')).map((t) => t.charAt(0).toLowerCase() + t.slice(1));
    const base = describe(s, plan, inventory);
    return extra.length ? `${base.replace(/\.$/, '')}; ${extra.join('; ')}.` : base;
  };
  const created = changes.filter((s) => s.action === 'create').length;
  const updated = changes.length - created;
  const c = counts(plan);
  const coverage = plan?.existing_coverage ?? [];
  const state = planState(plan, errors);

  return (
    <details className="plan-card" open={open}>
      <summary>
        <IconChevron className="chev" />
        <b>{heading}</b>
        <span className="counts">
          {created ? <span className="badge add">+{created} new</span> : null}
          {updated ? <span className="badge change">~{updated} changed</span> : null}
          {c.reused ? <span className="badge">={c.reused} reused</span> : null}
          {c.cant ? <span className="badge cant">{c.cant} can’t do yet</span> : null}
        </span>
      </summary>

      {errors.length ? (
        <section className="plan-section">
          <h3>Problems the checks found</h3>
          <p className="note">This version can’t be built. Reply with more detail and it will try again.</p>
          <ul className="diff">
            {errors.map((e) => (
              <li key={e} className="problem">
                <span className="sign">!</span>
                <div className="what"><p>{humanise(e, inventory)}</p></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="plan-section">
        <h3>{changes.length ? 'Changes to your Halo' : 'No changes needed'}</h3>
        {changes.length ? (
          <>
            {groups.map((g) => {
              const items = (
                <ul className="diff">
                  {g.items.map((s) => {
                    const form = forms.get(s.id);
                    const parts = plan ? [s, ...(folded.get(s.id) ?? [])].flatMap((x) => describeParts(x, plan, inventory)) : [];
                    const other = form ? parts.filter((p) => !/^(add |take .* off the form|show .* only when|make .* (required|optional)|.* help text on this form)/i.test(p)) : [];
                    return (
                      <li key={s.id} className={s.action === 'create' ? 'add' : 'change'}>
                        <span className="sign">{s.action === 'create' ? '+' : '~'}</span>
                        <div className="what">
                          <b>{title(s, inventory)}</b> <span className="kind">{s.action === 'create' ? `new ${KIND[s.object]}` : KIND[s.object]}</span>
                          {form ? (
                            <>
                              <p>
                                {form.rows.length} field{form.rows.length === 1 ? '' : 's'} on the form ({form.rows.filter((r) => r.isNew).length} new)
                                {form.rows.some((r) => r.when.length) ? `, ${form.rows.filter((r) => r.when.length).length} shown only for certain answers` : ''}
                                {form.removed.length ? `, ${form.removed.length} taken off` : ''}
                                {other.length ? `; ${other.join('; ')}` : ''}.
                              </p>
                              <details className="step-parts form-peek">
                                <summary>See the form</summary>
                                <FormTable form={form} />
                              </details>
                            </>
                          ) : (
                            <>
                              <p>{says(s)}</p>
                              {parts.length > 1 ? (
                                <details className="step-parts">
                                  <summary>{parts.length} changes in detail</summary>
                                  <ul>{parts.map((p, i) => <li key={i}>{p.charAt(0).toUpperCase() + p.slice(1)}</li>)}</ul>
                                </details>
                              ) : null}
                            </>
                          )}
                          {(() => {
                            const email = emailOf(s, brand);
                            return email ? (
                              <details className="email-peek">
                                <summary>Preview the email</summary>
                                <EmailPreview subject={email.subject} html={email.html} title={`Preview of ${title(s, inventory)}`} />
                                {!brand && target ? <a className="subtle" href={`/app/instances/${target.instanceId}/settings#branding`}>Add this client’s logo and colour</a> : null}
                              </details>
                            ) : null;
                          })()}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
              // A long run of one kind (12 ticket rules, 30 bank holidays) folds into one line.
              return g.items.length > 4 ? (
                <details key={`${g.kind}-${g.items[0].id}`} className={`change-group ${g.items.every((x) => x.action === 'create') ? 'add' : 'change'}`}>
                  <summary>
                    <span className="sign">{g.items.every((x) => x.action === 'create') ? '+' : '~'}</span>
                    <span>{g.items.length} {g.items.every((x) => x.action === 'create') ? 'new ' : ''}{KIND[g.kind]}{/s$/.test(KIND[g.kind]) ? '' : 's'}: {g.items.slice(0, 4).map((x) => title(x, inventory)).join(', ')}…</span>
                    <IconChevron className="chev" size={14} />
                  </summary>
                  {items}
                </details>
              ) : <div key={`${g.kind}-${g.items[0].id}`}>{items}</div>;
            })}
          </>
        ) : (
          <p className="note">Everything this needs is already in your Halo.</p>
        )}
      </section>

      {plan?.unsupported?.length ? (
        <section className="plan-section">
          <h3>Can’t do yet</h3>
          <ul className="diff">
            {plan.unsupported.map((u) => (
              <li key={u} className="cant">
                <span className="sign">!</span>
                <div className="what"><p>{humanise(u, inventory)}</p><small>Not built. Listed so you can set it up in Halo.</small></div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {coverage.length ? (
        <details className="plan-section">
          <summary>
            <span>Already in your Halo ({coverage.filter((x) => x.status !== 'missing').length} of {coverage.length} found)</span>
            <IconChevron className="chev" size={14} />
          </summary>
          <ul className="diff">
            {coverage.map((x, i) => {
              const k = COVER[x.status] ?? COVER.missing;
              return (
                <li key={i} className={k.cls === 'keep' ? 'keep' : ''}>
                  <span className="sign" style={k.cls !== 'keep' ? { color: `var(--${k.cls})`, background: `var(--${k.cls}-soft)` } : undefined}>{k.sign}</span>
                  <div className="what">
                    <b>{humanise(x.requirement, inventory)}</b> <span className="kind">{k.label.toLowerCase()}</span>
                    {x.existing ? <p>{humanise(x.existing, inventory)}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {plan?.assumptions?.length ? (
        <details className="plan-section">
          <summary>
            <span>Assumptions to check ({plan.assumptions.length})</span>
            <IconChevron className="chev" size={14} />
          </summary>
          <ul className="diff">
            {plan.assumptions.map((a) => (
              <li key={a} className="keep">
                <span className="sign">?</span>
                <div className="what"><p>{humanise(a, inventory)}</p></div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {foot ? (
        <div className="plan-foot">{foot}</div>
      ) : state === 'ready' && canBuild && planId && target ? (
        <div className="plan-foot plan-foot-build">
          <BuildPanel planId={planId} instanceId={target.instanceId} instanceName={target.instanceName} baseUrl={target.baseUrl} lastApply={target.lastApply} titles={Object.fromEntries(steps.map((x) => [x.id, title(x, inventory)]))} />
        </div>
      ) : (
        <div className="plan-foot">
          <span>Nothing has been written to Halo.</span>
          {state === 'ready' ? (
            <button className="btn btn-primary btn-sm" type="button" disabled title="Building in Halo is part of the paid plans">
              Build in Halo
            </button>
          ) : (
            <StateBadge state={state} questions={plan?.questions?.length} />
          )}
        </div>
      )}
    </details>
  );
}

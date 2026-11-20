/**
 * Learning rounds for the agreed next areas (COVERAGE.md "Agreed next"), run on YOUR TRIAL only.
 *
 *   npm run learn:areas              read-only
 *   npm run learn:areas -- --apply   also makes "zz Enact sample ..." records and reads back what Halo kept
 *
 * Round 28 (12 Nov) found every area's endpoint and copied one of Halo's own records per area. Lesson (rule S1b): a copy
 * of a Users, Site or KBArticle record, with its id stripped, still UPDATED the record it was copied from (user 51, site 20,
 * article 22 on the Concord trial). So round 29 never copies those: it creates them from a minimal payload, and every
 * create checks the id Halo returns against the ids that existed before. A returned id that already existed is reported
 * as an overwrite and nothing more is sent to it.
 *
 * Round 29 (12 Nov): (1) retire the sample ticket type with "visible", (2) minimal creates: service, user, site,
 * organisation, knowledge base article (with its FAQ list), (3) a bank holiday through /Holiday on the sample working
 * hours, (4) a closure code through /Lookup, (5) a role (ids are guids, numeric id in id_int), (6) where departments live.
 *
 * Round 30 (12 Nov): the new builder objects proven through the REAL builder (dry-run gate, apply, read-back), then the
 * same plan run again to prove nothing is duplicated (users by email, sites by organisation, holidays by date). Then a
 * show rule on a multi-select, removing a field and retiring the type, all by the builder. Plus: list names for /Lookup,
 * where role permissions live, minimal organisation / article / email rule creates (overwrite-checked).
 *
 * Round 31 (12 Nov): knowledge base articles through the builder (twice); round 27's form tests moved here so they run
 * from the app: a field required only when shown (three tickets logged), a read-only field, a ticket type description;
 * roles from a name (then the IT Agent's claims), asset types from a name, and every setting on Halo's email rules.
 *
 * Round 32 (12 Nov): roles (copied from IT Agent) and asset types through the real builder, each twice; fields on an
 * asset type (rows copied from one of Halo's own types onto the zz type); a read-only field set by the builder; mailbox
 * settings read (never changed).
 *
 * Round 33 (12 Nov): an asset type WITH fields through the real builder (twice), and a read-only field added and
 * locked in one builder step.
 *
 * Round 34 (12 Nov): read-only done right (4 on the new-ticket screens, F13) on field 316, and fields 315/316's detail
 * screens put back to 1 (round 31 moved them to a separate tab); whether end users can log a ticket type on the portal
 * (enduserscanselect); which SLA setting picks the working hours.
 *
 * Round 35 (13 Nov): (1) how a service lists the request types people can log from it on the portal
 * (service_request_details: Halo's own rows in full, then one added to the zz r30 service and read back); (2) whether a
 * form row can carry its own help text, separate from the field's (Lewis: the same field needs a different hint per
 * ticket type). Round 34's tests (read-only 4, portal visibility, SLA working hours) run again first.
 *
 * Round 36 (13 Nov): round 35 found zz Enact r31 form retired (the enterprise test retired it), so its tests skipped.
 * A fresh zz form, then: a request type added to a service's Service Request Details, read-only (4) by the builder,
 * a service subcategory created under an existing category, and the per-form hint and label overrides (Lewis, 13 Nov).
 *
 * Round 37 (13 Nov): Compleat's "New Starter" service kept a new category but not its summary or service_tickettype_id,
 * twice (with and without Service Request Details in the same save). Does a zz service that has request details keep them?
 * And how does Halo's own record show summary vs the portal text?
 *
 * Round 38 (13 Nov): what Compleat still needs by hand. Field types for rich text, tables and attachments; the ticket type's
 * attachment settings; renaming a service; moving a service category; a live list of Halo's departments.
 *
 * Round 39 (13 Nov): a rich text field (type 10) by the builder; a form's attachment settings (allowattachments,
 * minattachments); moving a service category to another parent (round 38's move hit the 3-tier limit, SC2).
 *
 * Round 40 (13 Nov): user access on services and categories ("Everyone" vs restricted), and the portal's
 * "Report an Issue" button and which ticket type it logs. Read first; one change on a zz category.
 *
 * Round 41 (13 Nov): round 40 found every Halo category and service carries one restriction group with one criterion of
 * type "X" (data_id 0, allow_access true); Enact's category 26 had none. Likely "Everyone". Give zz category 26 and
 * zz service 170 that group and read back; Lewis checks User Access shows Everyone.
 *
 * Round 52 (20 Nov): field placement, three single changes on zz fields (showondetailsscreen, field tab 1, form row
 * techtab_id -2).
 * Round 51 (20 Nov): the builder's standard tab layout on the zz form, and where its fields sit.
 * Round 50 (20 Nov): tab names from the ClientCache call's languagepack (label/value rows), read-only.
 * Round 49 (20 Nov): where the agent app fills its translations, and the addresses there, read-only.
 * Round 48 (20 Nov): the API the agent app loads its language text from (found in its main script), read-only.
 * Round 47 (20 Nov): built-in tab names from the agent app's own public files on the instance host, read-only.
 * Round 46 (20 Nov): names for Halo's built-in tabs (translation keys in tab_config), read-only.
 * Round 45 (20 Nov): more settings endpoints for client side uploads; layout tab_config read in full, /Tabs, and one tab
 * hidden on the zz form.
 * Round 44 (20 Nov): Enact finds the client side uploads switch and turns it on (one key, only if unambiguous), then the
 * attachment proof again;
 * and layout: object keys, query params, tab endpoints, tab_display 1 on the zz form, form row placement values.
 * Round 43 (20 Nov): attachment fields (type 11) proven on the zz form, and round 42b's layout read (it didn't run).
 * Round 42b: where Halo keeps a ticket type's layout tabs and a field's tab (Details / Additional Fields / Ticket
 * Information), read-only.
 * Round 42 (20 Nov): field types Enact doesn't know (Attachment, Table): read Halo's own fields of each unknown type, and
 * make one "zz Enact r42 type N" field per candidate number, copied from Halo's own text field, for Lewis to identify.
 *
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo. The CALLER checks the trial-only switches.
 * Never deletes.
 */
import { buildWithGate } from './build';
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';
import type { Plan } from './translators';

type Row = Record<string, unknown>;

export const ROUND = 52;

export async function learnAreas(opts: { apply: boolean; instance: string; log?: (line: string) => void }): Promise<{ out: Record<string, unknown>; summary: string[] }> {
  const apply = opts.apply;
  const log = opts.log ?? (() => {});

  const SAMPLE = 'zz Enact sample';
  const out: Record<string, unknown> = { instance: opts.instance, learned_at: new Date().toISOString(), round: ROUND, apply };
  const summary: string[] = [];
  const note = (area: string, key: string, value: unknown) => {
    const a = (out[area] ??= {}) as Row;
    a[key] = value;
  };
  const err = (e: unknown) => String((e as Error).message ?? e).split('\n').slice(0, 3).join(' ').slice(0, 500);
  const nameOf = (r: Row | null | undefined) => String(r?.name ?? r?.title ?? r?.label ?? r?.id ?? '');
  const pick = (r: Row | null | undefined, re: RegExp) => Object.fromEntries(Object.entries(r ?? {}).filter(([k]) => re.test(k)));
  const SECRET = /pass|secret|token|apikey|api_key|client_secret|refresh|oauth|cert|private/i;
  const PERSONAL = /email|phone|mobile|tel|surname|firstname|lastname|^name$|login|address|postcode|dob|birth|photo|avatar|ip_|nino|payroll/i;
  const inUse = (v: unknown) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== -1 && v !== false && !(Array.isArray(v) && !v.length);
  const short = (v: unknown) => (typeof v === 'object' && v !== null ? `${Array.isArray(v) ? `array(${v.length})` : `object(${Object.keys(v).length})`} ${JSON.stringify(v).slice(0, 220)}` : typeof v === 'string' ? v.slice(0, 160) : v);
  /** The settings a record actually uses, without secrets (and without personal values when asked). */
  const settings = (r: Row | null, personal = false) =>
    Object.fromEntries(Object.entries(r ?? {}).filter(([k, v]) => inUse(v) && !SECRET.test(k) && !(personal && PERSONAL.test(k))).map(([k, v]) => [k, short(v)]));
  /** Integration ids (Halo may match an existing record on them, rule S1b). */
  const THIRD_PARTY = /(connectwise|autotask|servicenow|freshdesk|datto|ninja|device42|syncro|auvik|itglue|kaseya|atera|okta|google|azure|hubspot|passportal|xero|quickbooks|kashflow|snelstart|facebook|twitter|instagram|sgateway|cautomate|thirdparty|accounts?id|_?ad$|sid$|guid)/i;
  const own = (r: Row) => Number(r.id) > 0 && !nameOf(r).startsWith('zz ');

  async function list(resource: string, params?: Record<string, string>): Promise<{ rows: Row[]; error?: string }> {
    try {
      return { rows: extractList(await runtime().halo.get(`/${resource}`, params)) };
    } catch (e) {
      return { rows: [], error: err(e) };
    }
  }
  async function detail(resource: string, id: unknown): Promise<Row | null> {
    try {
      return firstRecord(await runtime().halo.get(`/${resource}/${id}`, { includedetails: 'true' }));
    } catch {
      return null;
    }
  }

  /** The first candidate endpoint with records (or, failing that, the first that answers). */
  async function discover(area: string, label: string, candidates: string[], params?: Record<string, string>) {
    const tried: Row = {};
    let found: { ep: string; rows: Row[] } | null = null;
    for (const ep of candidates) {
      const r = await list(ep, params);
      tried[ep] = r.error ? `error: ${r.error.slice(0, 160)}` : `${r.rows.length} rows`;
      if (!r.error && (r.rows.length || !found)) found = { ep, rows: r.rows };
      if (!r.error && r.rows.length) break;
    }
    note(area, `${label}: endpoints tried`, tried);
    if (found) note(area, `${label}: endpoint`, found.ep);
    return found;
  }

  /** Halo's own records: list keys, then the settings two real records use. */
  async function study(area: string, label: string, ep: string, rows: Row[], personal = false, n = 2) {
    note(area, `${label}: count`, rows.length);
    if (rows[0]) note(area, `${label}: list keys`, Object.keys(rows[0]));
    note(area, `${label}: names`, personal ? `${rows.length} (not written: personal data)` : rows.slice(0, 15).map((r) => `${r.id} ${nameOf(r)}`));
    const studied: Row[] = [];
    for (const r of rows.filter(own).slice(0, n)) {
      const d = await detail(ep, r.id);
      if (!d) continue;
      studied.push(d);
      note(area, `${label}: ${r.id} detail keys`, Object.keys(d));
      note(area, `${label}: ${r.id} settings in use`, settings(d, personal));
    }
    return studied;
  }

  /** Copy one of Halo's own records under a zz name, save it, and list what Halo didn't keep as sent. */
  async function copyRename(area: string, label: string, ep: string, source: Row | undefined, name: string, overrides: Row = {}, drop: RegExp | null = null) {
    if (!apply) return null;
    const again = (await list(ep, { search: name })).rows.find((r) => nameOf(r) === name) ?? (await list(ep)).rows.find((r) => nameOf(r) === name);
    if (again) {
      note(area, `${label}: sample`, `reused ${again.id}`);
      return Number(again.id);
    }
    if (!source) {
      note(area, `${label}: sample`, 'not made: no record of Halo\'s own to copy');
      return null;
    }
    const payload = cleanForCreate(source) as Row;
    for (const k of Object.keys(payload)) if (SECRET.test(k) || THIRD_PARTY.test(k) || (drop && drop.test(k))) delete payload[k];
    const before = new Set((await list(ep)).rows.map((r) => String(r.id)));
    const nameKey = 'name' in source ? 'name' : 'title' in source ? 'title' : 'name';
    Object.assign(payload, { [nameKey]: name }, overrides);
    delete payload.id;
    delete payload.guid;
    try {
      const res = firstRecord(await runtime().halo.post(`/${ep}`, [payload]));
      const id = Number(res?.id);
      if (!(id > 0)) throw new Error(`no id back: ${JSON.stringify(res).slice(0, 200)}`);
      if (before.has(String(id)) || String(id) === String(source.id)) {
        note(area, `${label}: OVERWRITE`, { id, copied_from: source.id });
        summary.push(`!! ${label}: Halo saved over existing record ${id}. Check it by hand.`);
        return null;
      }
      const back = await detail(ep, id);
      const lost = Object.entries(payload)
        .filter(([k, v]) => (v === null || typeof v !== 'object') && back && JSON.stringify(back[k]) !== JSON.stringify(v))
        .map(([k, v]) => ({ key: k, sent: short(v), kept: short(back?.[k]) }));
      note(area, `${label}: sample`, { id, copied_from: source.id, keys_sent: Object.keys(payload).length, not_kept_as_sent: lost.slice(0, 40) });
      summary.push(`✓ ${label}: sample ${id} saved (${lost.length} setting(s) not kept as sent)`);
      return id;
    } catch (e) {
      note(area, `${label}: sample error`, err(e));
      summary.push(`✗ ${label}: ${err(e).slice(0, 160)}`);
      return null;
    }
  }

  /** One partial update on a zz sample, read back. */
  async function update(area: string, label: string, ep: string, id: number | null, patch: Row) {
    if (!apply || !id) return;
    try {
      await runtime().halo.post(`/${ep}`, [{ id, ...patch }]);
      const back = await detail(ep, id);
      const kept = Object.fromEntries(Object.keys(patch).map((k) => [k, { sent: short(patch[k]), kept: short(back?.[k]) }]));
      note(area, `${label}: update`, kept);
      summary.push(`· ${label} update: ${Object.entries(kept).map(([k, v]) => `${k} ${JSON.stringify(v.sent) === JSON.stringify(v.kept) ? 'kept' : 'changed'}`).join(', ')}`);
    } catch (e) {
      note(area, `${label}: update error`, err(e));
    }
  }
  const firstKey = (r: Row | undefined, re: RegExp, type = 'string') => Object.keys(r ?? {}).find((k) => re.test(k) && (typeof r?.[k] === type || r?.[k] === null));

  async function area(name: string, fn: () => Promise<void>) {
    log(`· ${name}`);
    try {
      await fn();
    } catch (e) {
      note(name, 'failed', err(e));
      summary.push(`✗ ${name}: ${err(e).slice(0, 160)}`);
    }
  }


  /** A record made from a minimal payload. Overwrite-checked: a returned id that already existed is reported, not used. */
  async function create(area: string, label: string, ep: string, payload: Row) {
    if (!apply) return null;
    const name = nameOf(payload);
    const existing = (await list(ep)).rows;
    const again = existing.find((r) => nameOf(r) === name);
    if (again) { note(area, `${label}: sample`, `reused ${again.id}`); return Number(again.id); }
    const before = new Set(existing.map((r) => String(r.id)));
    try {
      const res = firstRecord(await runtime().halo.post(`/${ep}`, [payload]));
      const id = Number(res?.id);
      if (!(id > 0)) throw new Error(`no id back: ${JSON.stringify(res).slice(0, 200)}`);
      if (before.has(String(id))) {
        note(area, `${label}: OVERWRITE`, id);
        summary.push(`!! ${label}: Halo saved over existing record ${id}. Check it by hand.`);
        return null;
      }
      const back = await detail(ep, id);
      const lost = Object.entries(payload)
        .filter(([k, v]) => (v === null || typeof v !== 'object') && JSON.stringify(back?.[k]) !== JSON.stringify(v))
        .map(([k, v]) => ({ key: k, sent: short(v), kept: short(back?.[k]) }));
      note(area, `${label}: sample`, { id, sent: payload, not_kept_as_sent: lost });
      summary.push(`✓ ${label}: ${id} made from a minimal payload (${lost.length} not kept as sent)`);
      return id;
    } catch (e) {
      note(area, `${label}: error`, err(e));
      summary.push(`✗ ${label}: ${err(e).slice(0, 200)}`);
      return null;
    }
  }


  /** Run a plan with the real builder (dry-run gate B1, apply, read-back). */
  async function prove(label: string, plan: Plan): Promise<Row[]> {
    if (!apply) return [];
    const lines: string[] = [];
    try {
      const r = await buildWithGate(plan, { apply: true, emit: (e) => { if (e.type === 'line') lines.push(e.text); } });
      const log = r.log.map((l) => ({ step: l.step, outcome: l.outcome, id: l.id, error: l.error, warnings: l.warnings, detail: l.detail }));
      note('builder proofs', label, { ok: r.ok, refused: r.refused, problems: r.problems, log, output: lines.slice(-40) });
      summary.push(r.ok ? `✓ ${label}: ${log.map((l) => `${l.step} ${l.outcome}`).join(', ')}` : `✗ ${label}: ${[...r.problems, ...log.filter((l) => l.error).map((l) => `${l.step}: ${l.error}`)].join(' | ').slice(0, 400)}`);
      return log as Row[];
    } catch (e) {
      note('builder proofs', `${label} error`, err(e));
      summary.push(`✗ ${label}: ${err(e).slice(0, 200)}`);
      return [];
    }
  }


  log(`Round ${ROUND}: ${opts.instance} ${apply ? '(will build zz samples on the trial)' : '(read-only)'}`);










  await area('field placement', async () => {
    const A = 'field placement';
    // Round 52 (20 Nov): round 51 showed custom fields sit on tab 0 ("Additional Information"), Halo's own ticket fields
    // (Summary, Details, Agent) on tab 1, every form row at techtab_id -1, and showondetailsscreen false everywhere.
    // Three single changes, each on a zz field, each read back. Lewis says where each field then shows on a zz form ticket.
    const form = (await list('TicketType')).rows.find((t) => /^zz Enact r36 form$/i.test(nameOf(t)));
    const fields = (await list('FieldInfo')).rows;
    const byLabel = (l: string) => fields.find((f) => String(f.label) === l);
    // 1. A field-level switch: show on the details screen (affects that field on every form).
    const choice = byLabel('zz Enact r31 choice');
    await update(A, 'r31 choice showondetailsscreen true', 'FieldInfo', choice ? Number(choice.id) : null, { showondetailsscreen: true });
    // 2. A field-level tab: move the field to tab 1, where Halo's own ticket fields sit.
    const rich = byLabel('zz Enact r39 rich text');
    await update(A, 'r39 rich text tab_id 1', 'FieldInfo', rich ? Number(rich.id) : null, { tab_id: 1 });
    // 3. A per-form placement: the form row for "zz Enact r33 locked" on the Details tab (-2), this form only.
    const locked = byLabel('zz Enact r33 locked');
    if (form && locked && apply) {
      const d = firstRecord(await runtime().halo.get(`/TicketType/${form.id}`, { includedetails: 'true' }));
      const rows = ((d?.fields as Row[]) ?? []).map(({ group: _g, fieldinfo: _f, ...r }) => r);
      const row = rows.find((r) => Number(r.fieldid) === Number(locked.id));
      if (row) {
        row.techtab_id = -2;
        try {
          await runtime().halo.post('/TicketType', [{ id: Number(form.id), fields: rows }]);
          const back = firstRecord(await runtime().halo.get(`/TicketType/${form.id}`, { includedetails: 'true' }));
          const got = ((back?.fields as Row[]) ?? []).find((r) => Number(r.fieldid) === Number(locked.id));
          note(A, 'r33 locked row techtab_id -2', { kept: got?.techtab_id, techtab_name: got?.techtab_name, rows_before: rows.length, rows_after: ((back?.fields as Row[]) ?? []).length });
        } catch (e) { note(A, 'r33 locked row error', err(e)); }
      }
    }
    summary.push('· field placement: on a "zz Enact r36 form" ticket as an agent, tell Claude where each shows now: "zz Enact r31 choice", "zz Enact r39 rich text", "zz Enact r33 locked" (Details tab, Additional Information tab, or the Ticket Information panel), and whether only the six tabs show');
  });

  return { out, summary };
}

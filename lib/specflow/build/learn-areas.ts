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
 * and a service subcategory created under an existing category.
 *
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo. The CALLER checks the trial-only switches.
 * Never deletes.
 */
import { buildWithGate } from './build';
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';
import type { Plan } from './translators';

type Row = Record<string, unknown>;

export const ROUND = 36;

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





  await area('fresh form', async () => {
    await prove('a fresh zz form with a locked field', { request: 'Enact learning run 36', steps: [
      { id: 'c', object: 'field', action: 'reuse', match: { name: 'CFzzEnactR31Choice' } },
      { id: 'f', object: 'field', action: 'reuse', match: { name: 'CFzzEnactR33Locked' } },
      { id: 'form', object: 'ticket_type', action: 'create', name: 'zz Enact r36 form', fields: [{ ref: 'c' }, { ref: 'f' }] },
      { id: 'lock', object: 'ticket_type', action: 'update', match: { name: 'zz Enact r36 form' }, set: { read_only: ['f'] } },
    ] } as unknown as Plan);
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === 'zz Enact r36 form');
    const fid = Number((await list('FieldInfo')).rows.find((f) => f.name === 'CFzzEnactR33Locked')?.id);
    const row = tt ? (((await detail('TicketType', tt.id))?.fields as Row[]) ?? []).find((r) => Number(r.fieldid) === fid) : null;
    note('fresh form', 'locked row', row ? pick(row, /^(endusernew|technew|enduserdetail|techdetail)$/) : null);
  });

  await area('service request details', async () => {
    const A = 'service request details';
    const zz = (await list('Service')).rows.find((r) => nameOf(r) === 'zz Enact r30 service');
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === 'zz Enact r36 form');
    if (!zz || !tt) { note(A, 'skipped', { service: !!zz, form: !!tt }); return; }
    note(A, 'before', pick(await detail('Service', zz.id), /^(requestdetails_count|service_request_details)$/));
    await update(A, 'add zz r36 form', 'Service', Number(zz.id), { service_request_details: [{ servicedetail_type: 0, servicedetail_requesttypeid: Number(tt.id), servicedetail_label: 'Request this Service', servicedetail_shownewreqscreen: true, icon: 'plus-circle', sequenceid: 10, allow_all_items: true }] });
    const after = (await detail('Service', zz.id))?.service_request_details as Row[] | undefined;
    note(A, 'after', (after ?? []).map((r) => pick(r, /^(id|servicedetail_type|servicedetail_requesttypeid|servicedetail_requesttypename|servicedetail_label|servicedetail_shownewreqscreen|sequenceid)$/)));
    const ok = (after ?? []).some((r) => Number(r.servicedetail_requesttypeid) === Number(tt.id));
    summary.push(`· service request details: ${ok ? 'kept. On the Concord portal, open "zz Enact r30 service" and check "Request this Service" opens zz Enact r36 form' : 'not kept'}`);
  });

  await area('service subcategory', async () => {
    const A = 'service subcategory';
    const cats = (await list('ServiceCategory')).rows;
    const parent = cats.find(own);
    const d = parent ? await detail('ServiceCategory', parent.id) : null;
    note(A, 'a category, every setting', settings(d));
    note(A, 'parent-like keys across categories', cats.slice(0, 15).map((c) => pick(c, /^(id|name|parent|parent_id|parentid|level|sequence|toplevel|group)/i)));
    if (!parent) return;
    const pk = Object.keys(d ?? {}).find((k) => /^parent(_?id)?$/i.test(k)) ?? Object.keys(cats[0] ?? {}).find((k) => /^parent(_?id)?$/i.test(k));
    note(A, 'parent key', pk ?? 'none found');
    if (!pk) return;
    const id = await create(A, 'subcategory', 'ServiceCategory', { name: 'zz Enact r36 subcategory', [pk]: Number(parent.id) });
    if (id) note(A, 'subcategory read back', pick(await detail('ServiceCategory', id), new RegExp(`^(id|name|${pk}|level)$`)));
  });

  return { out, summary };
}

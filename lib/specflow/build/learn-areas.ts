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
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo. The CALLER checks the trial-only switches.
 * Never deletes.
 */
import { buildWithGate } from './build';
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';
import type { Plan } from './translators';

type Row = Record<string, unknown>;

export const ROUND = 35;

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




  await area('read-only', async () => {
    const A = 'read-only';
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === 'zz Enact r31 form');
    if (!tt || !apply) return;
    const fields = (await list('FieldInfo')).rows;
    const ids = ['CFzzEnactR31Locked', 'CFzzEnactR33Locked'].map((n) => Number(fields.find((f) => f.name === n)?.id));
    // Put round 31/33's rows back: detail screens 1 (ticket information), new screens 1 (visible, not required).
    const cur = await detail('TicketType', tt.id);
    const rows = ((cur?.fields as Row[]) ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'group' && k !== 'fieldinfo')));
    for (const r of rows) if (ids.includes(Number(r.fieldid))) Object.assign(r, { endusernew: 1, technew: 1, enduserdetail: 1, techdetail: 1 });
    await runtime().halo.post('/TicketType', [{ id: tt.id, fields: rows }]);
    // Now the builder locks field 316 the right way.
    await prove('read-only (value 4)', { request: 'Enact learning run 34', steps: [
      { id: 'f', object: 'field', action: 'reuse', match: { name: 'CFzzEnactR33Locked' } },
      { id: 'form', object: 'ticket_type', action: 'update', match: { name: 'zz Enact r31 form' }, set: { read_only: ['f'] } },
    ] } as unknown as Plan);
    const after = (((await detail('TicketType', tt.id))?.fields as Row[]) ?? []).filter((r) => ids.includes(Number(r.fieldid))).map((r) => ({ field: r.fieldid, ...pick(r, /^(endusernew|technew|enduserdetail|techdetail)$/) }));
    note(A, 'rows after', after);
    summary.push('· read-only: open a NEW "zz Enact r31 form" ticket: "zz Enact r33 locked" should be read only; "zz Enact r31 locked" normal again, both in Ticket information');
  });

  await area('portal', async () => {
    const A = 'portal';
    const types = (await list('TicketType')).rows.filter(own).slice(0, 30);
    const seen: Record<string, number> = {};
    for (const t of types) { const d = await detail('TicketType', t.id); seen[String(d?.enduserscanselect)] = (seen[String(d?.enduserscanselect)] ?? 0) + 1; }
    note(A, 'enduserscanselect across Halo\'s own types', seen);
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === 'zz Enact r31 form');
    if (tt) await update(A, 'portal off then on', 'TicketType', Number(tt.id), { enduserscanselect: false });
    if (tt) await update(A, 'portal back on', 'TicketType', Number(tt.id), { enduserscanselect: true });
  });

  await area('sla working hours', async () => {
    const A = 'sla working hours';
    const sla = (await list('SLA')).rows.find(own);
    const d = sla ? await detail('SLA', sla.id) : null;
    note(A, 'SLA settings that look like working hours', pick(d, /work|day|hour|calendar|holiday/i));
    if (!apply) return;
    await prove('SLA for the test', { request: 'Enact learning run 34: SLA', steps: [{ id: 's', object: 'sla', action: 'create', name: 'zz Enact r34 SLA', resolve_days: 2 }] } as unknown as Plan);
    const z = (await list('SLA')).rows.find((r) => nameOf(r) === 'zz Enact r34 SLA');
    const hours = (await list('Workday')).rows.find((r) => nameOf(r) === 'zz Enact r30 hours');
    const zd = z ? await detail('SLA', z.id) : null;
    const keys = Object.keys(zd ?? {}).filter((k) => /workday/i.test(k) && (typeof zd?.[k] === 'number' || zd?.[k] === null));
    note(A, 'candidate keys on the zz SLA', pick(zd, new RegExp(`^(${keys.join('|') || 'x^'})$`)));
    if (z && hours) for (const k of keys) await update(A, `SLA ${k} → zz r30 hours`, 'SLA', Number(z.id), { [k]: Number(hours.id) });
  });


  // ---------- Service request details: what makes a service requestable on the portal ----------
  await area('service request details', async () => {
    const A = 'service request details';
    const svcs = (await list('Service')).rows.filter(own);
    let shown = 0;
    for (const s of svcs) {
      const d = await detail('Service', s.id);
      const rows = (d?.service_request_details as Row[]) ?? [];
      if (!rows.length) continue;
      note(A, `Halo own: service ${s.id} ${nameOf(s)}`, { service_tickettype_id: d?.service_tickettype_id, requestdetails_count: d?.requestdetails_count, rows });
      if (++shown >= 2) break;
    }
    const zz = (await list('Service')).rows.find((r) => nameOf(r) === 'zz Enact r30 service');
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === 'zz Enact r31 form');
    if (!zz || !tt) { note(A, 'skipped', 'zz r30 service or zz r31 form missing'); return; }
    const before = await detail('Service', zz.id);
    note(A, 'zz service before', pick(before, /^(service_tickettype_id|requestdetails_count|service_request_details|showinusercatalog)$/));
    if (!apply) return;
    await update(A, 'add a request type', 'Service', Number(zz.id), { service_request_details: [{ servicedetail_type: 0, servicedetail_requesttypeid: Number(tt.id), icon: 'plus-circle' }] });
    const after = await detail('Service', zz.id);
    note(A, 'zz service after', pick(after, /^(service_tickettype_id|requestdetails_count|service_request_details)$/));
    const ok = ((after?.service_request_details as Row[]) ?? []).some((r) => Number(r.servicedetail_requesttypeid) === Number(tt.id));
    summary.push(`· service request details: ${ok ? `zz r31 form now requestable from "zz Enact r30 service" (check it on the portal)` : 'not kept'}`);
  });

  // ---------- A help text per form row (same field, different hint per ticket type) ----------
  await area('row hint', async () => {
    const A = 'row hint';
    const own1 = (await list('TicketType')).rows.find(own);
    const d = own1 ? await detail('TicketType', own1.id) : null;
    const row = ((d?.fields as Row[]) ?? []).find((r) => Number(r.fieldid) > 0);
    note(A, 'a Halo form row, every key', row ? Object.keys(row) : null);
    const cand = Object.keys(row ?? {}).filter((k) => /hint|tooltip|help|desc|note|text|label|caption|override/i.test(k));
    note(A, 'candidate keys and values', pick(row, new RegExp(`^(${cand.join('|') || 'x^'})$`)));
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === 'zz Enact r31 form');
    if (!apply || !tt) return;
    const cur = await detail('TicketType', tt.id);
    const choice = Number((await list('FieldInfo')).rows.find((f) => f.name === 'CFzzEnactR31Choice')?.id);
    const kept: Row = {};
    for (const k of cand.filter((k) => typeof row?.[k] === 'string' || row?.[k] === null)) {
      const rows = ((cur?.fields as Row[]) ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([x]) => x !== 'group' && x !== 'fieldinfo')));
      const target = rows.find((r) => Number(r.fieldid) === choice);
      if (!target) break;
      target[k] = `zz r35 row ${k}`;
      try {
        await runtime().halo.post('/TicketType', [{ id: tt.id, fields: rows }]);
        const back = (((await detail('TicketType', tt.id))?.fields as Row[]) ?? []).find((r) => Number(r.fieldid) === choice);
        kept[k] = back?.[k];
      } catch (e) { kept[k] = `error: ${err(e).slice(0, 120)}`; }
    }
    note(A, 'row keys tried on zz r31 form (field zz r31 choice)', kept);
    summary.push(`· per-form hint: tried ${Object.keys(kept).join(', ') || 'nothing (no text-like row keys)'}; open a new "zz Enact r31 form" ticket and say which text shows next to "zz Enact r31 choice"`);
  });

  return { out, summary };
}

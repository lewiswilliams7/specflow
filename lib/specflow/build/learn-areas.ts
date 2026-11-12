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
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo. The CALLER checks the trial-only switches.
 * Never deletes.
 */
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';

type Row = Record<string, unknown>;

export const ROUND = 29;

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

  log(`Round ${ROUND}: ${opts.instance} ${apply ? '(will make zz samples on the trial)' : '(read-only)'}`);

  // ---------- 1. Retire a ticket type: "visible" on the round 28 sample ----------
  await area('retire a ticket type', async () => {
    const A = 'retire a ticket type';
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === `${SAMPLE} retire me`);
    if (!tt) { note(A, 'skipped', 'no "zz Enact sample retire me" (round 28 makes it)'); return; }
    const d = await detail('TicketType', tt.id);
    note(A, 'before', pick(d, /^(visible|enduserscanselect|hide_respond|hide_anon_email|hide_anon_contact_info|hide_anon_phonenumber|inactive)$/));
    if (!apply) return;
    // Put back the round 28 tries (they were the wrong settings), then switch it off with visible.
    await update(A, 'undo round 28 tries', 'TicketType', Number(tt.id), { hide_respond: false, hide_anon_email: 0, hide_anon_contact_info: false, hide_anon_phonenumber: false });
    await update(A, 'visible off', 'TicketType', Number(tt.id), { visible: false });
    const listed = (await list('TicketType')).rows.some((t) => Number(t.id) === Number(tt.id));
    const listedAll = (await list('TicketType', { showall: 'true' })).rows.some((t) => Number(t.id) === Number(tt.id));
    note(A, 'still in the ticket type list', { default_list: listed, showall: listedAll });
  });

  // ---------- 2. Services: a minimal create on Halo's own category and the sample ticket type ----------
  await area('services', async () => {
    const A = 'services';
    const cat = (await list('ServiceCategory')).rows.find(own);
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === `${SAMPLE} retire me`) ?? (await list('TicketType')).rows.find(own);
    note(A, 'using', { category: cat && `${cat.id} ${nameOf(cat)}`, ticket_type: tt && `${tt.id} ${nameOf(tt)}` });
    await create(A, 'service', 'Service', { name: `${SAMPLE} service minimal`, summary: 'zz Enact sample: what this service is for', service_category_id: Number(cat?.id ?? 0), service_tickettype_id: Number(tt?.id ?? 0), showinusercatalog: true, showintechcatalog: true, servicerequestlbl: 'Request this Service' });
  });

  // ---------- 3. Imports: minimal user, site, organisation; where departments live ----------
  await area('imports', async () => {
    const A = 'imports';
    const client = (await list('Client')).rows.find(own);
    const clientD = client ? await detail('Client', client.id) : null;
    const site = (await list('Site')).rows.find((r) => own(r) && Number(r.client_id ?? client?.id) === Number(client?.id));
    note(A, 'using', { organisation: client && `${client.id} ${nameOf(client)}`, toplevel_id: clientD?.toplevel_id, site: site && `${site.id} ${nameOf(site)}` });
    const orgId = await create(A, 'organisation', 'Client', { name: `${SAMPLE} organisation`, toplevel_id: Number(clientD?.toplevel_id ?? 1) });
    const siteId = await create(A, 'site', 'Site', { name: `${SAMPLE} import site`, client_id: Number(orgId ?? client?.id ?? 0) });
    await create(A, 'user', 'Users', { name: `${SAMPLE} import user`, firstname: 'zz Enact', surname: 'sample import user', emailaddress: 'zz.enact.import@example.invalid', site_id: Number(siteId ?? site?.id ?? 0) });
    // Departments: the users list carries them; read one user's departments and try the likely endpoints.
    const u = (await list('Users')).rows.find(own);
    const ud = u ? await detail('Users', u.id) : null;
    note(A, 'a user\'s departments', ud?.departments ?? null);
    await discover(A, 'departments', ['Department', 'Departments', 'UserDepartment', 'Organisation', 'Lookup/Department'], undefined);
    const team = (await list('Team')).rows[0];
    note(A, 'team keys (departments may sit with teams)', team ? Object.keys(team) : null);
  });

  // ---------- 4. Knowledge base: a minimal article in an existing FAQ list ----------
  await area('knowledge base', async () => {
    const A = 'knowledge base';
    const kb = (await list('KBArticle')).rows.find((r) => own(r) && Number(r.id) !== 22);
    const d = kb ? await detail('KBArticle', kb.id) : null;
    const faq = ((d?.faqlists as Row[]) ?? [])[0];
    note(A, 'faq list shape (Halo own)', faq ?? null);
    await discover(A, 'faq lists', ['FAQLists', 'FAQList', 'FaqLists', 'KBFAQ']);
    if (!faq) return;
    const { id: _i, guid: _g, ...faqRef } = faq;
    await create(A, 'article', 'KBArticle', { name: `${SAMPLE} article`, description: '<p>zz Enact sample article body</p>', resolution: '', faqlists: [{ ...faqRef, id: faq.id }] });
  });

  // ---------- 5. Bank holiday through /Holiday on the sample working hours ----------
  await area('bank holidays', async () => {
    const A = 'bank holidays';
    const wd = (await list('Workday')).rows.find((r) => nameOf(r) === `${SAMPLE} working hours`);
    note(A, 'sample working hours', wd ? wd.id : 'not found');
    // Round 28 sent a holiday row that still carried holid 112 and workday_id 1 (Default Working Hours, New Year's Day).
    const h112 = (await list('Holiday')).rows.find((h) => Number(h.holid) === 112);
    note(A, 'holiday 112 now (check round 28 did not change it)', h112 ? pick(h112, /^(holid|workday_id|date|end_date|name)$/) : 'not found');
    if (!wd) return;
    const before = new Set((await list('Holiday')).rows.map((h) => String(h.holid)));
    if (!apply) return;
    try {
      const res = firstRecord(await runtime().halo.post('/Holiday', [{ workday_id: Number(wd.id), name: `${SAMPLE} holiday`, date: '2027-12-27T00:00:00', end_date: '2027-12-27T00:00:00', allday: true, holiday_type: 1, isrecurring: false }]));
      const holid = Number(res?.holid ?? res?.id);
      note(A, 'created', res ? pick(res, /^(id|holid|workday_id|date|end_date|name|allday)$/) : null);
      if (before.has(String(holid))) summary.push(`!! holiday: saved over existing holiday ${holid}`);
      const back = (await detail('Workday', wd.id))?.holidays as Row[] | undefined;
      note(A, 'on the sample working hours', (back ?? []).map((h) => pick(h, /^(holid|date|name)$/)));
      summary.push(`· bank holiday via /Holiday: ${(back ?? []).some((h) => h.name === `${SAMPLE} holiday`) ? 'on the working hours' : 'not on the working hours'}`);
    } catch (e) { note(A, 'error', err(e)); summary.push(`✗ holiday: ${err(e).slice(0, 160)}`); }
  });

  // ---------- 6. Closure codes and other small lists through /Lookup ----------
  await area('lists', async () => {
    const A = 'lists';
    const rows = (await list('Lookup')).rows;
    const byList = new Map<number, Row[]>();
    for (const r of rows) byList.set(Number(r.lookupid), [...(byList.get(Number(r.lookupid)) ?? []), r]);
    note(A, 'lookup lists (lookupid: count, first names)', Object.fromEntries([...byList].map(([k, v]) => [k, `${v.length}: ${v.slice(0, 4).map((r) => r.name).join(' | ')}`])));
    // Which list does a dropdown field use? The closure-like field "AI Auto Resolution" (lookup 174) and Halo's category fields.
    const f = await detail('FieldInfo', 308);
    note(A, 'field 308 lookup', pick(f, /^(id|name|lookup|lookupid|values)$/));
    const target = byList.get(174) ? 174 : null;
    if (!target) return;
    const before = new Set((byList.get(174) ?? []).map((r) => String(r.id)));
    if (!apply) return;
    try {
      const res = firstRecord(await runtime().halo.post('/Lookup', [{ lookupid: 174, name: `${SAMPLE} closure code`, sequence: 99 }]));
      note(A, 'created in list 174', res ? pick(res, /^(id|lookupid|name|sequence)$/) : null);
      if (before.has(String(res?.id))) summary.push(`!! lookup: saved over existing value ${res?.id}`);
      const after = (await list('Lookup', { lookupid: '174' })).rows;
      summary.push(`· closure code via /Lookup: ${after.some((r) => r.name === `${SAMPLE} closure code`) ? 'in the list' : 'not in the list'}`);
    } catch (e) { note(A, 'error', err(e)); summary.push(`✗ lookup: ${err(e).slice(0, 160)}`); }
  });

  // ---------- 7. Roles: ids are guids; copy Halo's "IT Agent" under a zz name ----------
  await area('roles', async () => {
    const A = 'roles';
    const roles = (await list('Roles')).rows;
    const src = roles.find((r) => /^it agent$/i.test(nameOf(r))) ?? roles.find((r) => !nameOf(r).startsWith('zz ') && !/admin/i.test(nameOf(r)));
    const d = src ? await detail('Roles', src.id) : null;
    note(A, 'source', src ? `${src.id} ${nameOf(src)}` : null);
    note(A, 'role detail keys', Object.keys(d ?? {}).length);
    note(A, 'role permission-like settings (first 40)', Object.fromEntries(Object.entries(d ?? {}).filter(([k, v]) => typeof v === 'boolean' || typeof v === 'number').slice(0, 40)));
    if (!apply || !d) return;
    const name = `${SAMPLE} role`;
    const again = roles.find((r) => nameOf(r) === name);
    if (again) { note(A, 'sample', `reused ${again.id}`); return; }
    const payload = cleanForCreate(d) as Row;
    delete payload.id; delete payload.id_int; delete payload.guid;
    payload.name = name;
    const before = new Set(roles.map((r) => String(r.id)));
    try {
      const res = firstRecord(await runtime().halo.post('/Roles', [payload]));
      if (before.has(String(res?.id))) { summary.push(`!! role: saved over existing role ${res?.id}`); note(A, 'OVERWRITE', res?.id); return; }
      const back = res ? await detail('Roles', res.id) : null;
      const lost = Object.entries(payload).filter(([k, v]) => (v === null || typeof v !== 'object') && JSON.stringify(back?.[k]) !== JSON.stringify(v)).map(([k, v]) => ({ key: k, sent: short(v), kept: short(back?.[k]) }));
      note(A, 'sample', { id: res?.id, keys_sent: Object.keys(payload).length, not_kept_as_sent: lost.slice(0, 30) });
      summary.push(`✓ role: ${res?.id} (${lost.length} not kept as sent)`);
    } catch (e) { note(A, 'error', err(e)); summary.push(`✗ role: ${err(e).slice(0, 160)}`); }
  });

  return { out, summary };
}

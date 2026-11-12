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
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo. The CALLER checks the trial-only switches.
 * Never deletes.
 */
import { buildWithGate } from './build';
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';
import type { Plan } from './translators';

type Row = Record<string, unknown>;

export const ROUND = 30;

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

  // ---------- 1. The new objects through the real builder, then the same plan again ----------
  await area('builder', async () => {
    const A = 'builder';
    const org = (await list('Client')).rows.find((r) => own(r) && Number(r.id) !== 12); // 12 was renamed by round 28 (S1b)
    const cat = (await list('ServiceCategory')).rows.find(own);
    const fields = (await list('FieldInfo')).rows;
    const has = (n: string) => fields.some((f) => f.name === n);
    note(A, 'using', { organisation: org && nameOf(org), service_category: cat && nameOf(cat).trim(), sample_fields: ['CFzzEnactSampleMulti', 'CFzzEnactSampleOtherDetails', 'CFzzEnactSampleRemoveMe'].map((n) => `${n}: ${has(n)}`) });
    if (!org || !cat) { summary.push('✗ builder: no organisation or service category to reuse'); return; }
    const R = 'zz Enact r30';
    const planA = {
      request: 'Enact learning run 30: catalogue, imports, working hours, canned text',
      steps: [
        { id: 'org', object: 'organisation', action: 'reuse', match: { name: nameOf(org) } },
        { id: 'site', object: 'site', action: 'create', name: `${R} site`, organisation: 'org' },
        { id: 'user', object: 'user', action: 'create', name: `${R} user`, firstname: 'zz Enact', surname: 'r30 user', email: 'zz.enact.r30@example.invalid', site: 'site' },
        { id: 'multi', object: 'field', action: 'reuse', match: { name: 'CFzzEnactSampleMulti' } },
        { id: 'why', object: 'field', action: 'reuse', match: { name: 'CFzzEnactSampleOtherDetails' } },
        { id: 'gone', object: 'field', action: 'reuse', match: { name: 'CFzzEnactSampleRemoveMe' } },
        { id: 'form', object: 'ticket_type', action: 'create', name: `${R} form`, fields: [{ ref: 'multi' }, { ref: 'why', mandatory: true }, { ref: 'gone' }] },
        { id: 'cat', object: 'service_category', action: 'reuse', match: { name: nameOf(cat).trim() } },
        { id: 'svc', object: 'service', action: 'create', name: `${R} service`, summary: 'zz Enact r30: request the sample form', service_category: 'cat', ticket_type: 'form' },
        { id: 'hours', object: 'working_hours', action: 'create', name: `${R} hours`, start: '08:30', end: '17:30', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
        { id: 'xmas', object: 'holiday', action: 'create', name: `${R} Christmas`, date: '2027-12-27', working_hours: 'hours' },
        { id: 'boxing', object: 'holiday', action: 'create', name: `${R} Boxing Day`, date: '2027-12-28', working_hours: 'hours' },
        { id: 'canned', object: 'canned_text', action: 'create', name: `${R} canned text`, text: 'Thanks for getting in touch.\nWe are looking into this now.' },
      ],
    } as unknown as Plan;
    await prove('A: create the new objects', planA);
    await prove('A again: nothing duplicated', planA);
    // Read-backs a person would check.
    const hours = (await list('Workday')).rows.find((r) => nameOf(r) === `${R} hours`);
    const hd = hours ? await detail('Workday', hours.id) : null;
    note(A, 'working hours read back', hd ? { ...pick(hd, /^(name|start|end|alldayssame|incmonday|incsaturday|startmonday|endfriday)$/), holidays: ((hd.holidays as Row[]) ?? []).map((h) => `${String(h.date).slice(0, 10)} ${h.name}`) } : null);
    const svc = (await list('Service')).rows.find((r) => nameOf(r) === `${R} service`);
    note(A, 'service read back', svc ? pick(await detail('Service', svc.id), /^(name|summary|service_category_name|service_tickettype_name|showinusercatalog)$/) : null);
    const users = (await list('Users', { search: 'zz.enact.r30@example.invalid' })).rows;
    note(A, 'users with the r30 email', users.length);

    // B: show rule on the multi-select (V2) and remove a field, by the builder.
    await prove('B: multi-select show rule and remove a field', {
      request: 'Enact learning run 30: form changes',
      steps: [
        { id: 'multi', object: 'field', action: 'reuse', match: { name: 'CFzzEnactSampleMulti' } },
        { id: 'why', object: 'field', action: 'reuse', match: { name: 'CFzzEnactSampleOtherDetails' } },
        { id: 'gone', object: 'field', action: 'reuse', match: { name: 'CFzzEnactSampleRemoveMe' } },
        { id: 'form', object: 'ticket_type', action: 'update', match: { name: `${R} form` }, set: { show_field_when: [{ field: 'why', when: 'multi', equals: 'Other' }], remove_fields: ['gone'] } },
      ],
    } as unknown as Plan);
    // C: retire it.
    await prove('C: retire the form', { request: 'Enact learning run 30: retire', steps: [{ id: 'form', object: 'ticket_type', action: 'update', match: { name: `${R} form` }, set: { retire: true } }] } as unknown as Plan);
    note(A, 'retired form still listed', (await list('TicketType')).rows.some((t) => nameOf(t) === `${R} form`));
  });

  // ---------- 2. Which /Lookup list is which: does list 11 name the others? ----------
  await area('lookup list names', async () => {
    const A = 'lookup list names';
    const rows = (await list('Lookup')).rows;
    const ids = new Set(rows.map((r) => Number(r.lookupid)));
    const l11 = rows.filter((r) => Number(r.lookupid) === 11);
    note(A, 'list 11 (id → name, and whether a list with that lookupid exists)', l11.slice(0, 60).map((r) => `${r.id} ${r.name} ${ids.has(Number(r.id)) ? '[list exists]' : ''}`));
    const fields = (await list('FieldInfo')).rows.filter((f) => Number(f.lookup) > 0).slice(0, 20);
    note(A, 'fields and their lookup list', fields.map((f) => `${f.label ?? f.name} → ${f.lookup}`));
  });

  // ---------- 3. Minimal creates still to prove (overwrite-checked) ----------
  await area('minimal creates', async () => {
    const A = 'minimal creates';
    await create(A, 'organisation', 'Client', { name: 'zz Enact r30 organisation' });
    const kb = (await list('KBArticle')).rows.find((r) => own(r) && Number(r.id) !== 22);
    const faq = (((kb ? await detail('KBArticle', kb.id) : null)?.faqlists as Row[]) ?? [])[0];
    if (faq) await create(A, 'article', 'KBArticle', { name: 'zz Enact r30 article', description: '<p>zz Enact r30 article body</p>', faqlists: [{ id: faq.id }] });
    else note(A, 'article', 'no FAQ list to put it in');
    await create(A, 'email rule (switched off)', 'EmailRule', { name: 'zz Enact r30 email rule', type: 1, subject: 'ZZENACTR30', enabled: false, seq: 99 });
  });

  // ---------- 4. Where role permissions live ----------
  await area('roles', async () => {
    const A = 'roles';
    const role = (await list('Roles')).rows.find((r) => /^it agent$/i.test(nameOf(r)));
    if (!role) return;
    const d = await detail('Roles', role.id);
    note(A, 'role detail', settings(d));
    for (const ep of ['RolePermission', 'RolePermissions', 'Permissions', 'RoleAccess', `Roles/${role.id}/Permissions`]) {
      const r = await list(ep, { role_id: String(role.id) });
      note(A, `endpoint ${ep}`, r.error ? r.error.slice(0, 120) : { rows: r.rows.length, first: r.rows.slice(0, 2).map((x) => settings(x)) });
    }
    const agent = (await list('Agent')).rows.find((a) => Number(a.id) > 1);
    const ad = agent ? await detail('Agent', agent.id) : null;
    note(A, 'agent role and permission keys', Object.keys(ad ?? {}).filter((k) => /role|perm|access|can|allow/i.test(k)).slice(0, 60));
  });

  return { out, summary };
}

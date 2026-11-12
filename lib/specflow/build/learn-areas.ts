/**
 * Round 28 (12 Nov 2026): the agreed next areas (COVERAGE.md "Agreed next"), learned from YOUR TRIAL in one run.
 *
 *   npm run learn:areas              read-only: finds each area's endpoint and reads Halo's own records
 *   npm run learn:areas -- --apply   also makes one "zz Enact sample ..." record per area and reads back what Halo kept
 *
 * For every area: (1) find the endpoint, (2) read up to two of Halo's own records (keys and the settings in use),
 * (3) with --apply, copy one of Halo's own records, rename it "zz Enact sample <area>", save it, read it back and list
 * every setting Halo didn't keep as sent, (4) one small update on that sample, read back. Never touches a record that
 * isn't a zz sample. Re-runs reuse samples by name. Agents are read only (they use paid licences). Mailbox settings are
 * read without passwords or secrets. Personal data on users is never written to the file, only key names.
 *
 * Form gaps (item 2): a sample ticket type "zz Enact sample retire me", made by the real builder, used to learn how to
 * retire a ticket type (inactive), remove a field from a form, and a show rule driven by a multi-select answer.
 *
 * Reports, dashboards and runbooks: read-only this round (they go last).
 * Writes go through haloPost (.env safety switches, trial only). Never deletes. Returns the findings; the caller writes SEND-TO-CLAUDE-28.txt.
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo, so it runs in the spike and on the app's server.
 * The CALLER checks the trial-only safety switches before passing apply: true.
 */
import { buildWithGate } from './build';
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';
import type { Plan } from './translators';

type Row = Record<string, unknown>;

export async function learnAreas(opts: { apply: boolean; instance: string; log?: (line: string) => void }): Promise<{ out: Record<string, unknown>; summary: string[] }> {
  const apply = opts.apply;
  const log = opts.log ?? (() => {});

  const SAMPLE = 'zz Enact sample';
  const out: Record<string, unknown> = { instance: opts.instance, learned_at: new Date().toISOString(), round: 28, apply };
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
    for (const k of Object.keys(payload)) if (SECRET.test(k) || (drop && drop.test(k))) delete payload[k];
    const nameKey = 'name' in source ? 'name' : 'title' in source ? 'title' : 'name';
    Object.assign(payload, { [nameKey]: name }, overrides);
    delete payload.id;
    delete payload.guid;
    try {
      const res = firstRecord(await runtime().halo.post(`/${ep}`, [payload]));
      const id = Number(res?.id);
      if (!(id > 0)) throw new Error(`no id back: ${JSON.stringify(res).slice(0, 200)}`);
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

  log(`Round 28: learning the next areas from ${opts.instance} ${apply ? '(will make zz samples on the trial)' : '(read-only)'}`);

  // ---------- 2. Form gaps ----------
  await area('2 form gaps', async () => {
    const A = '2 form gaps';
    const types = (await list('TicketType')).rows;
    const fields = (await list('FieldInfo')).rows;
    // How Halo's own ticket types are switched off, and how its forms hold sections and show rules.
    const details: Row[] = [];
    for (const t of types.filter(own).slice(0, 30)) { const d = await detail('TicketType', t.id); if (d) details.push(d); }
    const onOff = new Set<string>();
    for (const d of details) for (const [k, v] of Object.entries(d)) if (/inactive|active|enabled|visible|hidden|hide|disabled|retire|archiv/i.test(k) && (typeof v === 'boolean' || typeof v === 'number')) onOff.add(k);
    note(A, 'ticket type on/off settings', Object.fromEntries([...onOff].map((k) => [k, details.map((d) => `${d.id}:${d[k]}`).join(' ')])));
    const rowsKey = (d: Row) => Object.keys(d).find((k) => Array.isArray(d[k]) && (d[k] as Row[]).some((r) => r && typeof r === 'object' && 'fieldid' in r)) ?? 'fields';
    const typeOf = new Map(fields.map((f) => [Number(f.id), Number(f.type)]));
    const sections: Row[] = [];
    const multiRules: Row[] = [];
    const anyRules: Row[] = [];
    for (const d of details) {
      for (const r of (d[rowsKey(d)] as Row[]) ?? []) {
        if (sections.length < 4 && Object.entries(r).some(([k, v]) => /group|section/i.test(k) && inUse(v))) sections.push({ type: d.id, row: settings(r) });
        for (const g of (r.group_visibility_conditions as Row[]) ?? []) for (const c of (g.visibility_conditions as Row[]) ?? []) {
          const t = typeOf.get(Number(c.lookup_field_id));
          if (anyRules.length < 3) anyRules.push({ type: d.id, field: r.fieldid, trigger_type: t, condition: c });
          if (t === 3 && multiRules.length < 5) multiRules.push({ type: d.id, field: r.fieldid, group: pick(g, /^(type|desc|seq)$/), condition: c });
        }
      }
    }
    note(A, 'form rows key', details[0] ? rowsKey(details[0]) : null);
    note(A, 'section rows on Halo forms', sections);
    note(A, 'show rules on Halo forms', anyRules);
    note(A, 'show rules triggered by a multi-select (Halo own)', multiRules.length ? multiRules : 'none found on the first 30 ticket types');
    const fg = await list('FieldGroup');
    note(A, 'field groups', fg.error ?? fg.rows.slice(0, 5).map((r) => `${r.id} ${nameOf(r)}`));
    if (fg.rows.find(own)) note(A, 'field group detail', settings(await detail('FieldGroup', fg.rows.find(own)!.id)));

    if (!apply) return;
    // A sample ticket type made by the real builder: a dropdown, a multi-select, a memo shown by the multi-select, a field to remove.
    const retire = `${SAMPLE} retire me`;
    const lines: string[] = [];
    const team = (await list('Team')).rows.find(own);
    const plan = {
      request: 'Enact learning run 28: form gaps',
      steps: [
        { id: 'multi', object: 'field', action: 'create', name: 'CFzzEnactSampleMulti', label: `${SAMPLE} multi`, type: 'multiselect', options: ['Laptop', 'Monitor', 'Other'] },
        { id: 'why', object: 'field', action: 'create', name: 'CFzzEnactSampleOtherDetails', label: `${SAMPLE} other details`, type: 'memo' },
        { id: 'gone', object: 'field', action: 'create', name: 'CFzzEnactSampleRemoveMe', label: `${SAMPLE} remove me`, type: 'text' },
        ...(team ? [{ id: 'team', object: 'team', action: 'reuse', match: { name: nameOf(team) } }] : []),
        { id: 'tt', object: 'ticket_type', action: 'create', name: retire, fields: [{ ref: 'multi' }, { ref: 'why' }, { ref: 'gone' }], ...(team ? { team: 'team' } : {}) },
      ],
    } as unknown as Plan;
    const result = await buildWithGate(plan, { apply: true, emit: (e) => { if (e.type === 'line') lines.push(e.text); } });
    note(A, 'builder run', { ok: result.ok, problems: result.problems, log: result.log.map((l) => ({ step: l.step, outcome: l.outcome, id: l.id, error: l.error })) });
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === retire);
    if (!tt) { summary.push('✗ form gaps: sample ticket type not made'); return; }
    const allFields = (await list('FieldInfo')).rows;
    const fid = (n: string) => Number(allFields.find((f) => f.name === n)?.id);
    const multi = await detail('FieldInfo', fid('CFzzEnactSampleMulti'));
    const other = ((multi?.values as Row[]) ?? []).find((v) => v.name === 'Other');
    let d = await detail('TicketType', tt.id);
    const key = d ? rowsKey(d) : 'fields';

    // (a) A show rule driven by the multi-select's "Other", in the same shape as rule V1's dropdown rule.
    const rows = ((d?.[key] as Row[]) ?? []).map((r) => ({ ...r }));
    const target = rows.find((r) => Number(r.fieldid) === fid('CFzzEnactSampleOtherDetails'));
    if (target && multi && other) {
      target.group_visibility_conditions = [{ entity_id: tt.id, entity_id2: target.fieldid, type: 2, desc: '', seq: 1, visibility_conditions: [{ tickettype_id: 0, field_id: 0, lookup_field_id: multi.id, lookup_value_id: other.id, lookup_value: other.name, field_value: -1, category_value_name: '', conditiontype: 0, field_usage: 0 }] }];
      try {
        await runtime().halo.post('/TicketType', [{ id: tt.id, [key]: rows }]);
        d = await detail('TicketType', tt.id);
        const back = ((d?.[key] as Row[]) ?? []).find((r) => Number(r.fieldid) === Number(target.fieldid));
        note(A, 'multi-select show rule: kept', back?.group_visibility_conditions ?? null);
        summary.push(`· multi-select show rule: ${((back?.group_visibility_conditions as Row[]) ?? []).length ? 'saved (check it in Halo: open a new zz retire me ticket, pick Other)' : 'not kept'}`);
      } catch (e) { note(A, 'multi-select show rule error', err(e)); }
    }
    // (b) Remove a field from the form: send the rows without it.
    const without = ((d?.[key] as Row[]) ?? []).filter((r) => Number(r.fieldid) !== fid('CFzzEnactSampleRemoveMe'));
    try {
      await runtime().halo.post('/TicketType', [{ id: tt.id, [key]: without }]);
      const back = await detail('TicketType', tt.id);
      const still = ((back?.[key] as Row[]) ?? []).some((r) => Number(r.fieldid) === fid('CFzzEnactSampleRemoveMe'));
      note(A, 'remove a field: still on the form after sending the rows without it', still);
      summary.push(`· remove a field by leaving it out: ${still ? 'no, Halo kept it' : 'yes'}`);
      if (still) {
        const row = ((back?.[key] as Row[]) ?? []).find((r) => Number(r.fieldid) === fid('CFzzEnactSampleRemoveMe'));
        note(A, 'remove a field: its row', settings(row ?? null));
      }
    } catch (e) { note(A, 'remove a field error', err(e)); }
    // (c) Retire the sample: try each on/off setting Halo's own types use, one at a time.
    const tried: Row = {};
    for (const k of [...onOff].filter((k) => /inactive|disabled|hidden|hide/i.test(k))) {
      const before = (await detail('TicketType', tt.id))?.[k];
      const value = typeof before === 'number' ? 1 : true;
      try {
        await runtime().halo.post('/TicketType', [{ id: tt.id, [k]: value }]);
        tried[k] = { before, sent: value, kept: (await detail('TicketType', tt.id))?.[k] };
      } catch (e) { tried[k] = err(e); }
    }
    note(A, 'retire: settings tried on the sample', tried);
    summary.push(`· retire a ticket type: tried ${Object.keys(tried).join(', ') || 'nothing (no on/off setting found)'}`);
  });

  // ---------- 3. Services and the portal catalogue ----------
  await area('3 services and portal', async () => {
    const A = '3 services and portal';
    const svc = await discover(A, 'services', ['Service', 'ServiceCatalogue', 'Services']);
    const cat = await discover(A, 'service categories', ['ServiceCategory', 'ServiceCategories', 'ServiceGroup']);
    const own1 = svc ? await study(A, 'services', svc.ep, svc.rows) : [];
    if (cat) await study(A, 'service categories', cat.ep, cat.rows, false, 1);
    if (svc) {
      const id = await copyRename(A, 'service', svc.ep, own1[0], `${SAMPLE} service`);
      const dk = firstKey(own1[0], /^(description|desc|details|summary|note)$/i);
      if (dk) await update(A, 'service', svc.ep, id, { [dk]: 'zz Enact sample: what this service is for' });
    }
  });

  // ---------- 4. Data imports ----------
  await area('4 data imports', async () => {
    const A = '4 data imports';
    const users = await discover(A, 'users', ['Users']);
    if (users) {
      const u = await study(A, 'users', users.ep, users.rows, true, 1);
      note(A, 'users: search by name works', (await list(users.ep, { search: nameOf(users.rows.find(own)) })).rows.length > 0);
      const id = await copyRename(A, 'user', users.ep, u[0], `${SAMPLE} user`, { emailaddress: 'zz.enact.sample@example.invalid', firstname: 'zz Enact', surname: 'sample user' }, /email|phone|mobile|login|azure|ad_|sid|upn|ntlogin|password|photo|guid|third/i);
      const jk = firstKey(u[0], /^(jobtitle|job_title|title)$/i);
      if (jk) await update(A, 'user', users.ep, id, { [jk]: 'zz Enact sample job title' });
    }
    const sites = await discover(A, 'sites', ['Site']);
    if (sites) {
      const s = await study(A, 'sites', sites.ep, sites.rows);
      note(A, 'sites: search by name works', (await list(sites.ep, { search: nameOf(sites.rows.find(own)) })).rows.length > 0);
      await copyRename(A, 'site', sites.ep, s[0], `${SAMPLE} site`, {}, /email|phone|address|delivery|invoice|postcode|town|county|country|line[0-9]/i);
    }
    const orgs = await discover(A, 'organisations', ['Client', 'Organisation', 'Organisations']);
    if (orgs) {
      const o = await study(A, 'organisations', orgs.ep, orgs.rows);
      await copyRename(A, 'organisation', orgs.ep, o[0], `${SAMPLE} organisation`, {}, /email|phone|website|accounts|xero|quickbooks|ref$|reference|contract|stripe|gocardless/i);
    }
    const deps = await discover(A, 'departments', ['Department', 'Departments', 'Area']);
    if (deps) {
      const dd = await study(A, 'departments', deps.ep, deps.rows);
      await copyRename(A, 'department', deps.ep, dd[0], `${SAMPLE} department`);
    }
  });

  // ---------- 5. Lists ----------
  await area('5 lists', async () => {
    const A = '5 lists';
    const pr = await discover(A, 'priorities', ['Priority']);
    if (pr) note(A, 'priorities', pr.rows.slice(0, 12).map((r) => pick(r, /^(id|name|priorityid|slaid|sla_id|responsetime|fixtime|colour|color|seq|ishidden)$/i)));
    const canned = await discover(A, 'canned text', ['CannedText', 'CannedTexts']);
    if (canned) {
      const c = await study(A, 'canned text', canned.ep, canned.rows);
      const id = await copyRename(A, 'canned text', canned.ep, c[0], `${SAMPLE} canned text`);
      const tk = firstKey(c[0], /^(text|html|note|content|body)$/i);
      if (tk) await update(A, 'canned text', canned.ep, id, { [tk]: 'zz Enact sample canned text body' });
    }
    const closure = await discover(A, 'closure codes', ['ClosureCode', 'ClosureCodes', 'ResolutionCode', 'ResolutionCodes', 'ClosureReason']);
    if (closure?.rows.length) {
      const c = await study(A, 'closure codes', closure.ep, closure.rows);
      await copyRename(A, 'closure code', closure.ep, c[0], `${SAMPLE} closure code`);
    }
    // Many of Halo's small lists live behind /Lookup. Record what it offers, read-only.
    const lk = await list('Lookup');
    note(A, 'Lookup', lk.error ?? { rows: lk.rows.length, keys: lk.rows[0] ? Object.keys(lk.rows[0]) : [], first: lk.rows.slice(0, 20).map((r) => pick(r, /^(id|name|lookupid|lookuptype|value|description)$/i)) });
    // Closure-like ticket fields Halo already has (where its closure codes might be a field's options).
    const fields = (await list('FieldInfo')).rows.filter((f) => /closure|resolution|close code|closing/i.test(`${f.name} ${f.label}`));
    note(A, 'closure-like fields', fields.slice(0, 6).map((f) => pick(f, /^(id|name|label|type|lookup|lookupid|usage)$/i)));
  });

  // ---------- 6. Working hours and bank holidays ----------
  await area('6 working hours and holidays', async () => {
    const A = '6 working hours and holidays';
    const wd = await discover(A, 'working hours', ['Workday', 'Workdays']);
    if (!wd) return;
    const w = await study(A, 'working hours', wd.ep, wd.rows, false, 2);
    const hk = (r: Row | undefined) => Object.keys(r ?? {}).find((k) => /holiday/i.test(k) && Array.isArray(r?.[k]));
    const withHols = w.find((r) => ((r[hk(r) ?? ''] as Row[]) ?? []).length);
    note(A, 'holidays key', withHols ? hk(withHols) : 'no holidays on the first two working-hours records');
    if (withHols) note(A, 'holiday row (Halo own)', (withHols[hk(withHols)!] as Row[])[0]);
    const hol = await discover(A, 'holidays endpoint', ['Holiday', 'Holidays', 'PublicHoliday']);
    if (hol?.rows.length) note(A, 'holiday rows', hol.rows.slice(0, 3));
    const id = await copyRename(A, 'working hours', wd.ep, w[0], `${SAMPLE} working hours`);
    if (id && withHols) {
      const k = hk(withHols)!;
      const proto = cleanForCreate((withHols[k] as Row[])[0]) as Row;
      const dateKey = Object.keys(proto).find((x) => /date/i.test(x)) ?? 'date';
      const nameKey = Object.keys(proto).find((x) => /name|desc/i.test(x));
      await update(A, 'working hours holiday', wd.ep, id, { [k]: [{ ...proto, [dateKey]: '2027-12-27T00:00:00', ...(nameKey ? { [nameKey]: 'zz Enact sample holiday' } : {}) }] });
    }
  });

  // ---------- 7. Assets ----------
  await area('7 assets', async () => {
    const A = '7 assets';
    const at = await discover(A, 'asset types', ['AssetType', 'AssetTypes']);
    if (at) {
      const t = await study(A, 'asset types', at.ep, at.rows);
      const fk = Object.keys(t[0] ?? {}).filter((k) => /field/i.test(k) && Array.isArray(t[0]?.[k]));
      note(A, 'asset type field arrays', Object.fromEntries(fk.map((k) => [k, ((t[0][k] as Row[]) ?? []).slice(0, 2)])));
      await copyRename(A, 'asset type', at.ep, t[0], `${SAMPLE} asset type`);
    }
    const st = await discover(A, 'asset statuses', ['AssetStatus', 'AssetStatuses']);
    if (st) {
      const s = await study(A, 'asset statuses', st.ep, st.rows, false, 1);
      await copyRename(A, 'asset status', st.ep, s[0], `${SAMPLE} asset status`);
    }
    const ag = await discover(A, 'asset groups', ['AssetGroup', 'AssetGroups']);
    if (ag) await study(A, 'asset groups', ag.ep, ag.rows, false, 1);
    const af = await discover(A, 'asset fields', ['AssetField', 'AssetFields', 'AssetTypeField', 'FieldInfo/Asset']);
    if (af?.rows.length) await study(A, 'asset fields', af.ep, af.rows, false, 1);
    const assetCf = (await list('FieldInfo')).rows.filter((f) => /asset/i.test(`${f.usage ?? ''} ${f.name} ${f.label}`)).slice(0, 5);
    note(A, 'FieldInfo rows that look like asset fields', assetCf.map((f) => pick(f, /^(id|name|label|type|usage)$/i)));
  });

  // ---------- 8. Knowledge base ----------
  await area('8 knowledge base', async () => {
    const A = '8 knowledge base';
    const kb = await discover(A, 'articles', ['KBArticle', 'KBArticles', 'Knowledgebase']);
    if (!kb) return;
    const k = await study(A, 'articles', kb.ep, kb.rows, false, 1);
    const id = await copyRename(A, 'article', kb.ep, k[0], `${SAMPLE} article`);
    const bk = firstKey(k[0], /^(description|resolution|details|body|html|notes)$/i);
    if (bk) await update(A, 'article', kb.ep, id, { [bk]: '<p>zz Enact sample article body</p>' });
    const fa = await discover(A, 'article folders', ['KBFaqList', 'FAQList', 'KBFolder']);
    if (fa) note(A, 'folders', fa.rows.slice(0, 5).map((r) => `${r.id} ${nameOf(r)}`));
  });

  // ---------- 9. Mailbox rules ----------
  await area('9 mailbox rules', async () => {
    const A = '9 mailbox rules';
    const mb = await list('Mailbox');
    note(A, 'mailboxes', mb.error ?? mb.rows.slice(0, 5).map((m) => Object.fromEntries(Object.entries(m).filter(([k, v]) => !SECRET.test(k) && inUse(v) && /^(id|name|type|mailbox_type|use|enabled|active|default|ticket|tickettype|team|client|site|rule)/i.test(k)))));
    const rules = await discover(A, 'email rules', ['EmailRule', 'EmailRules', 'MailboxRule', 'IncomingEmailRule', 'EmailRuleset']);
    if (rules?.rows.length) {
      const r = await study(A, 'email rules', rules.ep, rules.rows);
      await copyRename(A, 'email rule', rules.ep, r[0], `${SAMPLE} email rule`);
    }
    if (mb.rows.find(own)) {
      const d = await detail('Mailbox', mb.rows.find(own)!.id);
      note(A, 'mailbox detail keys (no values)', Object.keys(d ?? {}).filter((k) => !SECRET.test(k)));
      note(A, 'mailbox rule-like settings', Object.fromEntries(Object.entries(d ?? {}).filter(([k, v]) => /rule|filter|tickettype|team|default|ignore|block|spam|domain/i.test(k) && !SECRET.test(k) && inUse(v)).map(([k, v]) => [k, short(v)])));
    }
  });

  // ---------- 10. Change management ----------
  await area('10 change', async () => {
    const A = '10 change';
    const types = (await list('TicketType')).rows;
    const changeish = types.filter((t) => /change/i.test(nameOf(t)));
    for (const t of changeish.slice(0, 2)) note(A, `change ticket type ${t.id} ${nameOf(t)}`, pick(await detail('TicketType', t.id), /itil|use|requesttype|change|risk|cab|approval|calendar|impact|freeze/i));
    const cab = await discover(A, 'CABs', ['CAB', 'Cab', 'ApprovalGroup']);
    if (cab) await study(A, 'CABs', cab.ep, cab.rows, false, 1);
    const risk = await discover(A, 'risk', ['RiskQuestion', 'RiskAssessment', 'ChangeRisk', 'RiskLevel', 'Risk']);
    if (risk?.rows.length) {
      const r = await study(A, 'risk', risk.ep, risk.rows, false, 1);
      await copyRename(A, 'risk record', risk.ep, r[0], `${SAMPLE} risk`);
    }
    const cal = await discover(A, 'change calendar and freezes', ['ChangeFreeze', 'ChangeCalendar', 'Freeze']);
    if (cal?.rows.length) await study(A, 'change calendar and freezes', cal.ep, cal.rows, false, 1);
  });

  // ---------- 11. Roles and permissions (agents read only) ----------
  await area('11 roles', async () => {
    const A = '11 roles';
    const roles = await discover(A, 'roles', ['Roles', 'Role']);
    if (roles) {
      const r = await study(A, 'roles', roles.ep, roles.rows, false, 1);
      const id = await copyRename(A, 'role', roles.ep, r[0], `${SAMPLE} role`);
      const perm = Object.keys(r[0] ?? {}).find((k) => typeof r[0][k] === 'boolean' && /can|allow|access|perm|edit|view/i.test(k));
      if (perm) await update(A, 'role', roles.ep, id, { [perm]: !r[0][perm] });
    }
    const agents = await list('Agent');
    note(A, 'agents (read only: they use paid licences)', agents.error ?? { count: agents.rows.length, keys: agents.rows[0] ? Object.keys(agents.rows[0]) : [], licence_like: agents.rows.slice(0, 3).map((a) => pick(a, /licen|isagent|inactive|role|team|is_?api|ishidden|disabled/i)) });
  });

  // ---------- 12-13. Reports, dashboards, runbooks: read-only ----------
  await area('12 reports and dashboards (read only)', async () => {
    const A = '12 reports and dashboards (read only)';
    const rep = await discover(A, 'reports', ['Report', 'Reports']);
    if (rep) {
      note(A, 'reports count', rep.rows.length);
      const sqlOne = rep.rows.find((r) => Object.entries(r).some(([k, v]) => /sql|query/i.test(k) && typeof v === 'string' && /select/i.test(v))) ?? rep.rows.find(own);
      const d = sqlOne ? await detail(rep.ep, sqlOne.id) : null;
      note(A, 'one report: keys', Object.keys(d ?? {}));
      note(A, 'one report: settings in use', settings(d));
    }
    const dash = await discover(A, 'dashboards', ['Dashboard', 'Dashboards', 'DashboardLinks']);
    if (dash?.rows.find(own)) note(A, 'one dashboard: settings in use', settings(await detail(dash.ep, dash.rows.find(own)!.id)));
  });
  await area('13 runbooks (read only)', async () => {
    const A = '13 runbooks (read only)';
    const wh = await discover(A, 'runbooks', ['Webhook', 'Runbook', 'Runbooks']);
    if (wh?.rows.find(own)) {
      const d = await detail(wh.ep, wh.rows.find(own)!.id);
      note(A, 'one runbook: keys', Object.keys(d ?? {}));
      note(A, 'one runbook: settings in use', settings(d));
    }
  });
  return { out, summary };
}

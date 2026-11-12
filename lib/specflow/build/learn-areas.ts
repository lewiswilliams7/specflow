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
 * Shared with the app (scripts/sync-builder.mjs): uses only runtime().halo. The CALLER checks the trial-only switches.
 * Never deletes.
 */
import { buildWithGate } from './build';
import { cleanForCreate } from './clean';
import { extractList, firstRecord, runtime } from './runtime';
import type { Plan } from './translators';

type Row = Record<string, unknown>;

export const ROUND = 31;

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

  // ---------- 1. Knowledge base articles through the real builder, then again ----------
  await area('kb', async () => {
    const A = 'kb';
    const faq = (await list('FAQLists')).rows.find((r) => own(r) && !r.is_group);
    note(A, 'faq list', faq ? `${faq.id} ${nameOf(faq)}` : null);
    if (!faq) return;
    const plan = { request: 'Enact learning run 31: an article', steps: [
      { id: 'faq', object: 'faq_list', action: 'reuse', match: { name: nameOf(faq) } },
      { id: 'kb', object: 'kb_article', action: 'create', name: 'zz Enact r31 article', body: 'Restart the laptop.\n\nIf that does not help, log a ticket with the Service Desk.', faq_list: 'faq' },
    ] } as unknown as Plan;
    await prove('KB: create an article', plan);
    await prove('KB again: nothing duplicated', plan);
    const a = (await list('KBArticle')).rows.find((r) => nameOf(r) === 'zz Enact r31 article');
    note(A, 'read back', a ? pick(await detail('KBArticle', a.id), /^(name|description|faqlists)$/) : null);
  });

  // ---------- 2. Round 27's form tests: required when shown, read-only, description ----------
  await area('form', async () => {
    const A = 'form';
    const F = 'zz Enact r31 form';
    await prove('form: fields, type and a show rule', { request: 'Enact learning run 31: form', steps: [
      { id: 'choice', object: 'field', action: 'create', name: 'CFzzEnactR31Choice', label: 'zz Enact r31 choice', type: 'dropdown', options: ['Yes', 'No'] },
      { id: 'reason', object: 'field', action: 'create', name: 'CFzzEnactR31Reason', label: 'zz Enact r31 reason', type: 'memo' },
      { id: 'locked', object: 'field', action: 'create', name: 'CFzzEnactR31Locked', label: 'zz Enact r31 locked', type: 'text' },
      { id: 'form', object: 'ticket_type', action: 'create', name: F, fields: [{ ref: 'choice', mandatory: true }, { ref: 'reason', mandatory: true }, { ref: 'locked' }] },
      { id: 'rule', object: 'ticket_type', action: 'update', match: { name: F }, set: { show_field_when: [{ field: 'reason', when: 'choice', equals: 'Yes' }] } },
    ] } as unknown as Plan);
    const tt = (await list('TicketType')).rows.find((t) => nameOf(t) === F);
    if (!tt) { note(A, 'skipped', 'form not built'); return; }
    const fields = (await list('FieldInfo')).rows;
    const choice = await detail('FieldInfo', fields.find((f) => f.name === 'CFzzEnactR31Choice')?.id);
    const lockId = Number(fields.find((f) => f.name === 'CFzzEnactR31Locked')?.id);
    const opt = (n: string) => ((choice?.values as Row[]) ?? []).find((v) => v.name === n)?.id;
    const user = (await list('Users', { search: 'zz.enact.r30@example.invalid' })).rows[0] ?? (await list('Users')).rows.find(own);
    note(A, 'requester', user ? user.id : null);

    // Required only when shown: three tickets.
    if (apply && user) {
      const tryLog = async (answer: string, giveReason: boolean) => {
        const cf: Row[] = [{ name: 'CFzzEnactR31Choice', value: opt(answer) }, ...(giveReason ? [{ name: 'CFzzEnactR31Reason', value: 'Enact round 31' }] : [])];
        try {
          const id = firstRecord(await runtime().halo.post('/Tickets', [{ tickettype_id: tt.id, summary: `zz Enact r31: ${answer}${giveReason ? ', reason given' : ', no reason'}`, details: 'Logged by Enact learning round 31.', user_id: user.id, customfields: cf }]))?.id;
          return { logged: id };
        } catch (e) {
          return { refused: err(e).slice(0, 300) };
        }
      };
      const hidden = await tryLog('No', false);
      const shownMissing = await tryLog('Yes', false);
      const shownGiven = await tryLog('Yes', true);
      note(A, 'required when shown', { not_shown_no_reason: hidden, shown_no_reason: shownMissing, shown_reason_given: shownGiven });
      const proven = Boolean(hidden.logged) && Boolean(shownMissing.refused) && Boolean(shownGiven.logged);
      summary.push(`· required only when shown: ${proven ? 'PROVEN' : 'not proven'} (No without reason: ${hidden.logged ? 'logged' : 'refused'}; Yes without: ${shownMissing.logged ? 'logged' : 'refused'}; Yes with: ${shownGiven.logged ? 'logged' : 'refused'})`);
    }

    // Read-only: the values Halo's own forms use, then lock the sample field.
    const seen: Record<string, Record<string, number>> = {};
    for (const t of (await list('TicketType')).rows.filter(own).slice(0, 25)) {
      for (const r of ((await detail('TicketType', t.id))?.fields as Row[]) ?? []) {
        for (const k of ['endusernew', 'technew', 'enduserdetail', 'techdetail', 'enduseraction', 'techaction', ...Object.keys(r).filter((x) => /read|lock|edit/i.test(x))]) {
          const v = String(r[k]);
          (seen[k] ??= {})[v] = (seen[k][v] ?? 0) + 1;
        }
      }
    }
    note(A, 'form row values across 25 ticket types', seen);
    const cur = await detail('TicketType', tt.id);
    const rows = ((cur?.fields as Row[]) ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'group' && k !== 'fieldinfo')));
    const lockRow = rows.find((r) => Number(r.fieldid) === lockId);
    if (apply && lockRow) {
      const before = pick(lockRow, /new$|detail$|action$|read|lock|edit/i);
      for (const k of ['endusernew', 'technew', 'enduserdetail', 'techdetail']) lockRow[k] = 2;
      await runtime().halo.post('/TicketType', [{ id: tt.id, fields: rows }]);
      const after = (((await detail('TicketType', tt.id))?.fields as Row[]) ?? []).find((r) => Number(r.fieldid) === lockId);
      note(A, 'locked field row', { before, sent: 2, after: pick(after ?? {}, /new$|detail$|action$|read|lock|edit/i) });
      summary.push('· read-only: field row set to 2; open a new "zz Enact r31 form" ticket and check "zz Enact r31 locked" can\'t be typed in');
    }

    // Ticket type description: which setting keeps it.
    const descKeys = Object.keys(cur ?? {}).filter((k) => /desc|guidance|intro|blurb|portal.*text|text.*portal/i.test(k) && (typeof cur?.[k] === 'string' || cur?.[k] === null));
    note(A, 'description candidates', pick(cur, new RegExp(`^(${descKeys.join('|') || 'x^'})$`)));
    if (apply) {
      const kept: string[] = [];
      for (const k of descKeys) {
        const text = `zz Enact r31 description via ${k}`;
        try { await runtime().halo.post('/TicketType', [{ id: tt.id, [k]: text }]); if ((await detail('TicketType', tt.id))?.[k] === text) kept.push(k); } catch (e) { note(A, `description via ${k} error`, err(e)); }
      }
      note(A, 'description settings Halo kept', kept);
      summary.push(`· ticket type description kept in: ${kept.join(', ') || 'none'}`);
    }
  });

  // ---------- 3. Roles: from a name, then the IT Agent's permissions (claims) ----------
  await area('roles', async () => {
    const A = 'roles';
    const roles = (await list('Roles')).rows;
    const it = roles.find((r) => /^it agent$/i.test(nameOf(r)));
    const itD = it ? await detail('Roles', it.id) : null;
    note(A, 'IT Agent claims (first 30)', ((itD?.claims as Row[]) ?? []).slice(0, 30));
    const admin = roles.find((r) => /administrator/i.test(nameOf(r)));
    const adD = admin ? await detail('Roles', admin.id) : null;
    note(A, 'Administrator claims (first 30)', ((adD?.claims as Row[]) ?? []).slice(0, 30));
    const id = await create(A, 'role', 'Roles', { name: 'zz Enact r31 role' });
    if (apply && id === null) {
      // Guids: create() expects numbers. Look the role up by name.
      const made = (await list('Roles')).rows.find((r) => nameOf(r) === 'zz Enact r31 role');
      note(A, 'role by name', made ? made.id : null);
      if (made && itD?.claims) {
        try {
          await runtime().halo.post('/Roles', [{ id: made.id, claims: itD.claims }]);
          const back = await detail('Roles', made.id);
          note(A, 'claims after copying IT Agent\'s', { sent: (itD.claims as Row[]).length, kept: ((back?.claims as Row[]) ?? []).length });
          summary.push(`· role permissions: sent ${(itD.claims as Row[]).length} claims, kept ${((back?.claims as Row[]) ?? []).length}`);
        } catch (e) { note(A, 'claims error', err(e)); }
      }
    }
  });

  // ---------- 4. Asset types from a name, and where asset fields live ----------
  await area('assets', async () => {
    const A = 'assets';
    const group = (await list('AssetGroup')).rows.find(own);
    const id = await create(A, 'asset type', 'AssetType', { name: 'zz Enact r31 asset type', assetgroup_id: Number(group?.id ?? 0) });
    if (id) note(A, 'new asset type fields', ((await detail('AssetType', id))?.fields as Row[]) ?? null);
    for (const f of [101, 117]) note(A, `FieldInfo ${f}`, pick(await detail('FieldInfo', f), /^(id|name|label|type|usage|custom|lookup)$/));
    for (const ep of ['AssetField', 'FieldInfo?usage=2', 'Asset/Fields', 'AssetTypeInfo']) {
      const [res, q] = ep.split('?');
      const r = await list(res, q ? Object.fromEntries([q.split('=')]) : undefined);
      note(A, `endpoint ${ep}`, r.error ? r.error.slice(0, 100) : { rows: r.rows.length, first: r.rows.slice(0, 3).map((x) => pick(x, /^(id|name|label|type|usage)$/)) });
    }
  });

  // ---------- 5. Email rules: every setting Halo's own rules use ----------
  await area('email rules', async () => {
    const A = 'email rules';
    const rules = (await list('EmailRule')).rows.filter(own);
    for (const r of rules.slice(0, 8)) note(A, `${r.id} ${nameOf(r)}`, settings(await detail('EmailRule', r.id)));
    const d = rules[0] ? await detail('EmailRule', rules[0].id) : null;
    note(A, 'all keys', Object.keys(d ?? {}));
  });

  return { out, summary };
}

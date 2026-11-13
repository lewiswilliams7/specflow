'use client';

import { useEffect, useRef, useState } from 'react';
import { splitForms } from '@/lib/specflow/forms';
import { SUITE, tagBrief } from '@/lib/suite';

type Part = { title?: string; plan?: unknown; errors?: string[]; seal?: string; error?: string };
type Row = {
  id: string;
  title: string;
  status: string;
  parts?: { title: string; first: number; after: number }[];
  planErrors?: string[];
  firstPassClean?: boolean;
  questions?: number;
  unsupported?: string[];
  assumptions?: number;
  steps?: Record<string, number>;
  planSeconds?: number;
  autoSplit?: boolean;
  preview?: { ok: boolean; problems: string[]; outcomes: Record<string, number>; seconds: number };
  build?: { ok: boolean; problems: string[]; outcomes: Record<string, number>; errors: string[]; warnings: string[]; seconds: number };
  error?: string;
};

const post = async <T,>(url: string, body: unknown, signal: AbortSignal): Promise<T> => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Failed (${r.status})`);
  return j;
};

/**
 * Founder-only run-through: every brief in the suite planned the way a user's message is (forms in parallel, one fix
 * pass, merge), previewed, and optionally built on the trial. The report downloads for Claude.
 */
export function SuitePanel({ trial }: { trial: { id: string; name: string } | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  // Briefs from client designs never go in the (public) repo: paste them here; they stay in this browser only.
  const [own, setOwn] = useState<{ id: string; title: string; brief: string }[]>([]);
  const [draft, setDraft] = useState({ title: '', brief: '' });
  useEffect(() => { try { setOwn(JSON.parse(localStorage.getItem('enact-suite-own') ?? '[]')); } catch { /* none saved */ } }, []);
  const saveOwn = (list: typeof own) => { setOwn(list); try { localStorage.setItem('enact-suite-own', JSON.stringify(list)); } catch { /* storage off */ } };
  const all = [...SUITE.map((s, index) => ({ ...s, index, pasted: false })), ...own.map((o) => ({ ...o, index: -1, pasted: true }))];
  const [pick, setPick] = useState<Set<string>>(new Set(SUITE.map((s) => s.id)));
  const [build, setBuild] = useState(false);
  // Cost (13 Nov: seven briefs cost about £5): re-check the last plans with no model calls after a fix to the checks or
  // the builder, and re-plan only the briefs that failed.
  const [mode, setMode] = useState<'plan' | 'recheck'>('recheck');
  const [onlyFailed, setOnlyFailed] = useState(true);
  type Saved = Record<string, { request: string; plan: unknown; passed?: boolean }>;
  const readSaved = (): Saved => { try { return JSON.parse(localStorage.getItem('enact-suite-saved') ?? '{}'); } catch { return {}; } };
  const writeSaved = (id: string, patch: Partial<Saved[string]>) => { try { const all = readSaved(); all[id] = { ...(all[id] ?? { request: '', plan: null }), ...patch }; localStorage.setItem('enact-suite-saved', JSON.stringify(all)); } catch { /* storage full or off */ } };
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState('');
  const ctrl = useRef<AbortController | null>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const run = async () => {
    if (!trial) return;
    const t = Math.floor(Date.now() / 60000).toString(36).slice(-4);
    setTag(t);
    const saved = readSaved();
    const chosen = all.filter((s) => pick.has(s.id) && !(onlyFailed && saved[s.id]?.passed));
    const start: Row[] = chosen.map((s) => ({ id: s.id, title: s.title, status: 'waiting' }));
    setRows(start);
    setBusy(true);
    ctrl.current = new AbortController();
    const signal = ctrl.current.signal;
    const base = { instance_id: trial.id, tag: t };

    for (const [i, s] of chosen.entries()) {
      if (signal.aborted) break;
      // Each brief gets its own tag, so one brief never trips over what another built in the same run (13 Nov t2un:
      // "copy of the existing zz … New Starter" came from Northgate's build minutes earlier).
      const bt = `${t}${'abcdefghijklmnop'[i] ?? i}`;
      const per = { ...base, tag: bt };
      let request = tagBrief(s.brief, bt);
      let which: { brief_text: string } | { index: number } = s.pasted ? { brief_text: s.brief } : { index: s.index };
      try {
        const t0 = Date.now();
        let res: { plan: Record<string, unknown> | null; errors: string[] };
        if (mode === 'recheck') {
          const last = saved[s.id];
          if (!last?.plan) { update(i, { status: 'no saved plan: plan it once first' }); continue; }
          update(i, { status: 're-checking (no model calls)' });
          request = last.request;
          res = await post('/api/admin/suite', { ...per, op: 'recheck', plan: last.plan, request }, signal);
        } else {
        update(i, { status: 'planning' });
        // M17: a long prose brief is split first, as in a customer's conversation.
        if (!splitForms(request) && request.length >= 800) {
          update(i, { status: 'splitting' });
          const sp = await post<{ marked?: string | null }>('/api/split', { message: request, instance_id: trial.id }, signal).catch(() => ({ marked: null }));
          if (sp.marked && splitForms(sp.marked)) { request = sp.marked; which = { brief_text: sp.marked }; update(i, { autoSplit: true }); }
          update(i, { status: 'planning' });
        }
        const split = splitForms(request);
        if (split) {
          const partsInfo: { title: string; first: number; after: number }[] = [];
          const parts = await Promise.all(split.forms.map(async (_, index) => {
            if (index > 0) await new Promise((r) => setTimeout(r, 8000));
            let p = await post<Part>('/api/plan-part', { message: request, instance_id: trial.id, index }, signal);
            const first = p.errors?.length ?? 0;
            if (p.plan && first) {
              const fixed = await post<Part>('/api/plan-part', { message: request, instance_id: trial.id, index, fix: { plan: p.plan, errors: p.errors, seal: p.seal } }, signal).catch(() => null);
              if (fixed?.plan && (fixed.errors?.length ?? 0) < first) p = fixed;
            }
            partsInfo[index] = { title: split.forms[index].title, first, after: p.errors?.length ?? 0 };
            return { title: String(p.title ?? split.forms[index].title), plan: p.plan ?? null, errors: p.errors ?? [] };
          }));
          update(i, { status: 'merging', parts: partsInfo });
          res = await post('/api/admin/suite', { ...per, op: 'merge', ...which, parts }, signal);
          update(i, { firstPassClean: partsInfo.every((p) => p.first === 0) && res.errors.length === 0 });
        } else {
          res = await post('/api/admin/suite', { ...per, op: 'plan', ...which }, signal);
          update(i, { firstPassClean: res.errors.length === 0 });
        }
        if (res.plan) writeSaved(s.id, { request, plan: res.plan, passed: false });
        }
        const plan = res.plan as { steps?: { object: string; action: string }[]; questions?: unknown[]; unsupported?: string[]; assumptions?: unknown[] } | null;
        const steps: Record<string, number> = {};
        for (const st of plan?.steps ?? []) steps[st.action] = (steps[st.action] ?? 0) + 1;
        update(i, { planErrors: res.errors, questions: plan?.questions?.length ?? 0, unsupported: plan?.unsupported ?? [], assumptions: plan?.assumptions?.length ?? 0, steps, planSeconds: Math.round((Date.now() - t0) / 1000) });
        if (!plan || res.errors.length) { update(i, { status: 'plan failed the checks' }); continue; }

        const runBuild = async (apply: boolean) => {
          const outcomes: Record<string, number> = {};
          let problems: string[] = [];
          const errors: string[] = [];
          const warnings: string[] = [];
          let ok = false;
          let seconds = 0;
          for (let round = 0; round < 6; round++) {
            const b = await post<{ ok: boolean; stopped: boolean; problems: string[]; seconds: number; log: { outcome: string; name: string; error?: string; warnings?: string[] }[] }>('/api/admin/suite', { ...per, op: 'build', plan, apply }, signal);
            seconds += b.seconds;
            problems = b.problems;
            ok = b.ok;
            for (const l of b.log) {
              outcomes[l.outcome] = (outcomes[l.outcome] ?? 0) + 1;
              if (l.error) errors.push(`${l.name}: ${l.error}`);
              for (const w of l.warnings ?? []) warnings.push(`${l.name}: ${w}`);
            }
            if (!b.stopped) break;
          }
          return { ok, problems, outcomes, errors, warnings, seconds };
        };
        update(i, { status: 'previewing' });
        const pv = await runBuild(false);
        update(i, { preview: { ok: pv.ok, problems: pv.problems, outcomes: pv.outcomes, seconds: pv.seconds } });
        if (!pv.ok) { update(i, { status: 'preview found problems' }); continue; }
        if (!build) { update(i, { status: 'passed (preview)' }); writeSaved(s.id, { passed: true }); continue; }
        update(i, { status: 'building' });
        const bd = await runBuild(true);
        update(i, { build: bd, status: bd.ok && !bd.errors.length ? 'built and checked' : 'build had problems' });
        if (bd.ok && !bd.errors.length) writeSaved(s.id, { passed: true });
        await post('/api/admin/suite', { ...per, op: 'refresh' }, signal).catch(() => null);
      } catch (e) {
        update(i, { status: 'stopped', error: (e as Error).message });
        if (signal.aborted) break;
      }
    }
    setBusy(false);
  };

  const download = () => {
    const report = { suite_run: tag, instance: trial?.name, ran_at: new Date().toISOString(), built: build, results: rows };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `SEND-TO-CLAUDE-suite-${tag}.txt` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const passed = rows.filter((r) => /passed|built and checked/.test(r.status)).length;
  return (
    <section className="card" aria-labelledby="suite-h">
      <div className="card-head">
        <div>
          <h2 id="suite-h">Run-through</h2>
          <p className="subtle">Every test brief planned, previewed{build ? ' and built' : ''} on {trial?.name ?? 'your trial'}, the way a customer's message is. New things are named “zz S…”.</p>
        </div>
      </div>
      {!trial ? <p className="notice">Connect your trial first.</p> : (
        <>
          <ul className="suite-pick">
            {all.map((s) => (
              <li key={s.id}>
                <label>
                  <input type="checkbox" checked={pick.has(s.id)} disabled={busy} onChange={(e) => setPick((p) => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} /> {s.title}
                </label>
                {s.pasted ? <button className="btn ghost tiny" disabled={busy} onClick={() => saveOwn(own.filter((o) => o.id !== s.id))}>Remove</button> : null}
              </li>
            ))}
          </ul>
          <details className="suite-add">
            <summary>Add a brief of your own (kept in this browser only)</summary>
            <input className="input" placeholder="Name" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <textarea className="input" rows={6} placeholder="Paste the brief" value={draft.brief} onChange={(e) => setDraft({ ...draft, brief: e.target.value })} />
            <button className="btn" disabled={!draft.title.trim() || !draft.brief.trim()} onClick={() => { const id = `own-${Date.now()}`; saveOwn([...own, { id, title: draft.title.trim(), brief: draft.brief.trim() }]); setPick((p) => new Set(p).add(id)); setDraft({ title: '', brief: '' }); }}>Add</button>
          </details>
          <div className="suite-opts">
            <label className="subtle"><input type="radio" name="suite-mode" checked={mode === 'recheck'} disabled={busy} onChange={() => setMode('recheck')} /> Re-check the last plans (free: no model calls). Use after a fix to the checks or the builder.</label>
            <label className="subtle"><input type="radio" name="suite-mode" checked={mode === 'plan'} disabled={busy} onChange={() => setMode('plan')} /> Plan again (about 50p–£1 a brief). Use after a change to the planner.</label>
            <label className="subtle"><input type="checkbox" checked={onlyFailed} disabled={busy} onChange={(e) => setOnlyFailed(e.target.checked)} /> Only briefs that didn’t pass last time</label>
            <label className="subtle"><input type="checkbox" checked={build} disabled={busy} onChange={(e) => setBuild(e.target.checked)} /> Also build on {trial.name} (writes zz objects; never deletes)</label>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn primary" disabled={busy || !pick.size} onClick={run}>{busy ? 'Running…' : `Run ${pick.size} brief${pick.size === 1 ? '' : 's'}`}</button>
            {busy ? <button className="btn" onClick={() => ctrl.current?.abort()}>Stop</button> : null}
            {rows.length && !busy ? <button className="btn" onClick={download}>Download report</button> : null}
          </div>
          {rows.length ? (
            <>
              <p className="subtle" style={{ marginTop: 10 }}>{busy ? 'Keep this page open. A big brief takes several minutes.' : `${passed} of ${rows.length} passed.`}</p>
              <table className="form-table" style={{ marginTop: 6 }}>
                <thead><tr><th>Brief</th><th>Status</th><th>First try clean</th><th>Questions</th><th>Can’t do</th><th>Steps</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.title}</b>{r.error ? <div className="subtle">{r.error}</div> : null}{r.planErrors?.length ? <div className="subtle">{r.planErrors.slice(0, 3).join(' · ')}</div> : null}{r.preview?.problems.length ? <div className="subtle">{r.preview.problems.slice(0, 3).join(' · ')}</div> : null}</td>
                      <td>{r.status}</td>
                      <td>{r.firstPassClean === undefined ? '' : r.firstPassClean ? 'Yes' : 'No'}</td>
                      <td>{r.questions ?? ''}</td>
                      <td>{r.unsupported?.length ?? ''}</td>
                      <td>{r.steps ? Object.entries(r.steps).map(([k, v]) => `${v} ${k}`).join(', ') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

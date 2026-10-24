'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { IconAlert, IconCheck } from '@/components/icons';

type Entry = { step: string; object: string; name: string; outcome: string; id?: unknown; warnings: string[]; detail?: string; error?: string };
type Summary = { created: number; updated: number; would_create: number; would_update: number; reused: number; failed: number; warnings: number; dropdowns_created: number };
type Done = { build_id: string; status: 'succeeded' | 'failed' | 'refused' | 'stopped'; summary: Summary | null; problems: string[] };
export type LastBuild = { status: string; summary: Summary | null; started_at: string } | null;

type Props = {
  planId: string;
  instanceName: string;
  baseUrl: string;
  /** Plain names for each step id ("Hardware cost" rather than CFHardwareCostBand). */
  titles: Record<string, string>;
  lastApply: LastBuild;
};

const KIND: Record<string, string> = {
  team: 'team', field: 'field', sla: 'SLA', approval_process: 'approval', ticket_type: 'ticket type', status: 'status',
  outcome: 'action', workflow: 'workflow', agent: 'agent', approval_group: 'approval group', field_group: 'form section',
};
const SIGN: Record<string, [string, string]> = {
  'would create': ['+', 'add'], created: ['+', 'add'], 'would update': ['~', 'change'], updated: ['~', 'change'],
  reused: ['=', 'keep'], 'already exists': ['=', 'keep'], failed: ['!', 'problem'], stopped: ['·', 'keep'],
};
const WORD: Record<string, string> = {
  'would create': 'will be created', created: 'created and checked', 'would update': 'will be changed', updated: 'changed and checked',
  reused: 'already there', 'already exists': 'already there, reused', failed: 'failed',
};
/** "POST /api/TicketType failed (500)" plus Halo's own message, if it sent one. */
function haloError(raw: string): string {
  const [head, ...rest] = raw.split('\n');
  const body = rest.join('\n').trim();
  let detail = body;
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    detail = String(j.message ?? j.ClassName ?? j.error ?? body);
  } catch {
    // not JSON: show it as it came
  }
  return detail ? `${head}: ${detail.slice(0, 300)}` : head;
}
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Build a ready plan in Halo: preview what will change, then apply, with live progress and a report. */
export function BuildPanel({ planId, instanceName, baseUrl, titles, lastApply }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'preview' | 'apply'>('idle');
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [line, setLine] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  async function run(next: 'preview' | 'apply') {
    setMode(next);
    setRunning(true);
    setEntries([]);
    setDone(null);
    setError('');
    setLine(next === 'apply' ? 'Checking the whole plan first' : 'Reading your instance');
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch('/api/builds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan_id: planId, mode: next }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Something went wrong (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const raw = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!raw) continue;
          const ev = JSON.parse(raw) as { type: string; text?: string; index?: number; total?: number; entry?: Entry } & Partial<Done>;
          if (ev.type === 'line' && ev.text?.trim()) setLine(ev.text.trim().split('\n')[0].replace(/[:…]+$/, ''));
          if (ev.type === 'step' && ev.entry) {
            setTotal(ev.total ?? 0);
            setEntries((xs) => [...xs, ev.entry!]);
          }
          if (ev.type === 'done') setDone({ build_id: ev.build_id!, status: ev.status!, summary: ev.summary ?? null, problems: ev.problems ?? [] });
        }
      }
      if (next === 'apply') router.refresh();
    } catch (e) {
      if ((e as Error).name === 'AbortError') setError(next === 'apply' ? 'Stopped. Steps already finished were written and checked; build again to finish the rest.' : 'Preview stopped.');
      else setError((e as Error).message || 'Something went wrong.');
    } finally {
      setRunning(false);
      abort.current = null;
    }
  }

  const problems = done?.problems ?? [];
  const blocked = mode === 'preview' && done && (problems.length || entries.some((e) => e.outcome === 'failed' || e.warnings.length));
  const s = done?.summary;

  if (mode === 'idle') {
    return (
      <div className="build-idle">
        {lastApply ? (
          <span className="subtle">
            Last built {when(lastApply.started_at)}: {lastApply.status === 'succeeded' ? `${lastApply.summary?.created ?? 0} created, ${lastApply.summary?.updated ?? 0} changed` : lastApply.status}
          </span>
        ) : (
          <span>Nothing has been written to Halo.</span>
        )}
        <span className="build-actions">
          <a className="btn btn-quiet btn-sm" href={`/api/plans/${planId}/download`} download>Download JSON</a>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => run('preview')}>
            {lastApply?.status === 'succeeded' ? 'Build again' : 'Build in Halo'}
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="build">
      <div className="build-head">
        <b>{mode === 'preview' ? `Preview on ${instanceName}` : `Building in ${instanceName}`}</b>
        {running ? (
          <span className="build-progress">
            <span className="spinner" aria-hidden="true" />
            {mode === 'apply' && total ? `Step ${Math.min(entries.length + 1, total)} of ${total}` : line}
          </span>
        ) : null}
      </div>

      {mode === 'preview' && !done && !running && !error ? null : (
        <ul className="diff build-steps" aria-live="polite">
          {entries.map((e) => {
            const [sign, cls] = SIGN[e.outcome] ?? ['·', 'keep'];
            return (
              <li key={e.step} className={e.warnings.length ? 'problem' : cls}>
                <span className="sign">{e.warnings.length ? '!' : sign}</span>
                <div className="what">
                  <b>{titles[e.step] ?? e.name}</b> <span className="kind">{KIND[e.object] ?? e.object}, {e.detail === 'nothing to change' ? 'no change needed' : WORD[e.outcome] ?? e.outcome}</span>
                  {e.detail && e.detail !== 'nothing to change' ? <small className="mono">{e.detail}</small> : null}
                  {e.error ? <p className="err">{haloError(e.error)}</p> : null}
                  {e.warnings.map((w) => <p key={w} className="err">{w}</p>)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="notice error">{error}</p> : null}

      {done && mode === 'preview' ? (
        blocked ? (
          <div className="notice error">
            <IconAlert />
            <div>
              <b>This plan can’t be built yet. Nothing was written.</b>
              {problems.map((p) => <div key={p}>{p}</div>)}
              <div>Reply in the conversation to fix it, or check the instance and preview again.</div>
            </div>
          </div>
        ) : (
          <div className="build-confirm">
            <span>
              {s?.would_create ?? 0} to create, {s?.would_update ?? 0} to change, {s?.reused ?? 0} already there. It checks the whole plan again before the first write, and checks each object after it’s saved.
            </span>
            <span className="build-actions">
              <button className="btn btn-quiet btn-sm" type="button" onClick={() => { setMode('idle'); setDone(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" type="button" onClick={() => run('apply')}>Apply to {instanceName}</button>
            </span>
          </div>
        )
      ) : null}

      {done && mode === 'apply' ? (
        done.status === 'succeeded' ? (
          <div className="notice ok">
            <IconCheck />
            <div>
              <b>Built in {instanceName}: {s?.created ?? 0} created, {s?.updated ?? 0} changed, all checked after saving.</b>
              {s?.dropdowns_created ? <div>New dropdown options can need a log-out and back in before they show in Halo (rule U1b).</div> : null}
              <div><a href={baseUrl} target="_blank" rel="noreferrer">Open Halo</a></div>
            </div>
          </div>
        ) : done.status === 'refused' ? (
          <div className="notice error">
            <IconAlert />
            <div>
              <b>Not applied: the check before writing found a problem. Nothing was written.</b>
              {problems.map((p) => <div key={p}>{p}</div>)}
            </div>
          </div>
        ) : (
          <div className="notice error">
            <IconAlert />
            <div>
              <b>{done.status === 'stopped' ? 'Stopped' : 'Stopped at the first failure'}.</b>
              <div>Steps before it were written and checked. Fix the problem, then build again: finished steps are skipped.</div>
            </div>
          </div>
        )
      ) : null}

      {running ? (
        <div className="build-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => abort.current?.abort()}>
            {mode === 'apply' ? 'Stop after this step' : 'Stop'}
          </button>
        </div>
      ) : done && mode === 'apply' ? (
        <div className="build-actions" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-quiet btn-sm" type="button" onClick={() => { setMode('idle'); setDone(null); }}>Close</button>
        </div>
      ) : null}
    </div>
  );
}

import Link from 'next/link';
import { PrintButton } from '@/components/PrintButton';
import { textOn } from '@/lib/specflow/build/email-brand';
import { type Inv, title } from '@/lib/specflow/describe';
import type { Plan, PlanStep } from '@/lib/specflow/plan-types';
import { site } from '@/lib/site';
import type { BrandColumns } from '@/lib/brand';
import type { Workspace } from '@/lib/workspace';

export type Entry = { step: string; object: string; name: string; outcome: string; id?: unknown; warnings: string[]; detail?: string; error?: string };

const OUTCOME: Record<string, string> = {
  created: 'Created, checked', updated: 'Changed, checked', reused: 'Already there', 'already exists': 'Already there, reused',
  failed: 'Failed', 'would create': 'Would create', 'would update': 'Would change', stopped: 'Not run',
};
const KIND: Record<string, string> = {
  team: 'Team', field: 'Field', sla: 'SLA', approval_process: 'Approval process', ticket_type: 'Ticket type', status: 'Status',
  outcome: 'Action', workflow: 'Workflow', agent: 'Agent', approval_group: 'Approval group', field_group: 'Form section',
  email_template: 'Email template', ticket_rule: 'Ticket rule', ticket_template: 'Child tickets', category: 'Category', notification: 'Notification',
};
const RESULT: Record<string, string> = { succeeded: 'Completed', failed: 'Stopped at a failure', refused: 'Refused before writing', stopped: 'Stopped by the user', running: 'Running' };
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' }) : '');

export type ReportBuild = { id: string; mode: string; status: string; summary: unknown; log: unknown; started_at: string; finished_at: string | null; started_by_email: string | null; thread_id: string | null };

/** The sign-off report for one build: what was asked, who ran it, and every record written, with its Halo ID. */
export type ReportInstance = { name: string; base_url: string; inventory: Inv } & BrandColumns;

export function BuildReport({ build, plan, instance: inst, workspace }: { build: ReportBuild; plan: Plan | null; instance: ReportInstance | null; workspace: Workspace }) {
  const steps = new Map((plan?.steps ?? []).map((s) => [s.id, s as PlanStep]));
  const log = ((build.log as Entry[]) ?? []).filter((e) => e.outcome !== 'stopped');
  const written = log.filter((e) => e.outcome === 'created' || e.outcome === 'updated');
  const kept = log.filter((e) => e.outcome === 'reused' || e.outcome === 'already exists');
  const failed = log.filter((e) => e.outcome === 'failed');
  const name = (e: Entry) => { const s = steps.get(e.step); return s ? title(s, inst?.inventory ?? null) : e.name; };
  const colour = inst?.brand_colour ?? null;
  const org = inst?.brand_name || workspace.name;
  const s = (build.summary ?? {}) as { created?: number; updated?: number; reused?: number; failed?: number };

  return (
    <div className="page report-page">
      <div className="report-tools no-print">
        {build.thread_id ? <Link className="btn btn-quiet btn-sm" href={`/app/threads/${build.thread_id}`}>Back to the conversation</Link> : <span />}
        <PrintButton />
      </div>

      <article className="report" style={colour ? ({ '--report-accent': colour, '--report-on-accent': textOn(colour) } as React.CSSProperties) : undefined}>
        <header className="report-head">
          {inst?.brand_logo_url ? <img src={inst.brand_logo_url} alt={org} className="report-logo" /> : <b className="report-org">{org}</b>}
          <div className="report-title">
            <h1>Build sign-off report</h1>
            <p>{inst?.name ?? 'Halo'} · {when(build.started_at)}</p>
          </div>
        </header>

        <dl className="report-meta">
          <div><dt>Halo instance</dt><dd>{inst?.name} <span className="mono">{inst?.base_url}</span></dd></div>
          <div><dt>Result</dt><dd>{build.mode === 'preview' ? 'Preview only: nothing was written' : RESULT[build.status] ?? build.status}</dd></div>
          <div><dt>Started by</dt><dd>{build.started_by_email ?? 'A member of this workspace'}</dd></div>
          <div><dt>Started</dt><dd>{when(build.started_at)}</dd></div>
          <div><dt>Finished</dt><dd>{when(build.finished_at) || 'Not finished'}</dd></div>
          <div><dt>Changes</dt><dd>{s.created ?? 0} created, {s.updated ?? 0} changed, {s.reused ?? 0} already there{s.failed ? `, ${s.failed} failed` : ''}</dd></div>
        </dl>

        {plan?.request ? (
          <section>
            <h2>What was asked for</h2>
            <blockquote className="report-request">{plan.request}</blockquote>
          </section>
        ) : null}

        <section>
          <h2>Written to Halo</h2>
          {written.length ? (
            <table className="report-table">
              <thead><tr><th>#</th><th>Item</th><th>Type</th><th>Halo ID</th><th>Result</th></tr></thead>
              <tbody>
                {written.map((e, i) => (
                  <tr key={e.step}>
                    <td className="num">{i + 1}</td>
                    <td><b>{name(e)}</b>{e.outcome === 'updated' && e.detail && e.detail !== 'nothing to change' ? <div className="report-detail">{e.detail}</div> : null}</td>
                    <td>{KIND[e.object] ?? e.object}</td>
                    <td className="mono">{String(e.id ?? '')}</td>
                    <td>{OUTCOME[e.outcome] ?? e.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="note">Nothing was written to Halo in this build.</p>}
          <p className="report-note">Each record was read back from Halo after saving and matched what was sent. {site.name} never deletes: to undo a created record, remove it in Halo by its ID; to undo a change, set the values back as shown.</p>
        </section>

        {failed.length ? (
          <section>
            <h2>Failed</h2>
            <table className="report-table">
              <thead><tr><th>Item</th><th>Type</th><th>Problem</th></tr></thead>
              <tbody>{failed.map((e) => <tr key={e.step}><td><b>{name(e)}</b></td><td>{KIND[e.object] ?? e.object}</td><td>{(e.error ?? '').split('\n')[0].slice(0, 300)}</td></tr>)}</tbody>
            </table>
          </section>
        ) : null}

        {kept.length ? (
          <section>
            <h2>Already in Halo, reused</h2>
            <table className="report-table">
              <thead><tr><th>Item</th><th>Type</th><th>Halo ID</th></tr></thead>
              <tbody>{kept.map((e) => <tr key={e.step}><td>{name(e)}</td><td>{KIND[e.object] ?? e.object}</td><td className="mono">{String(e.id ?? '')}</td></tr>)}</tbody>
            </table>
          </section>
        ) : null}

        {plan?.unsupported?.length ? (
          <section>
            <h2>Not built: to do by hand</h2>
            <ul className="report-list">{plan.unsupported.map((u) => <li key={u}>{u}</li>)}</ul>
          </section>
        ) : null}

        <section className="report-sign">
          <h2>Sign-off</h2>
          <div className="sign-grid">
            {['Built by', 'Approved by'].map((who) => (
              <div key={who}>
                <span>{who}</span>
                <div className="sign-line" />
                <small>Name, role and date</small>
              </div>
            ))}
          </div>
        </section>

        <footer className="report-foot">Report {build.id.slice(0, 8)} · Generated by {site.name} from the build record · {org}</footer>
      </article>
    </div>
  );
}

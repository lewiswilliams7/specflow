import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton';
import { fieldLabel, type Inv } from '@/lib/specflow/describe';
import { site } from '@/lib/site';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const metadata: Metadata = { title: `As-built document · ${site.name}` };

type Row = Record<string, unknown>;
type Details = {
  ticket_types?: Record<string, { team?: string; sla?: string; approval?: string; workflow?: string; fields?: string[]; groups?: Record<string, string[]> }>;
  custom_fields?: Record<string, string>;
  field_groups?: Record<string, string[]>;
  statuses_that_pause_sla?: string[];
  teams_department_and_members?: Record<string, string>;
  workflow_actions_by_stage?: Record<string, Record<string, string[]>>;
  approval_groups?: Record<string, string[]>;
  approval_processes?: Record<string, string[]>;
  sla_targets?: Record<string, string>;
};
type Inventory = Record<string, unknown> & { details?: Details };

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : '');
const names = (inv: Inventory, key: string) => (Array.isArray(inv[key]) ? (inv[key] as string[]).filter(Boolean) : []);
const textOn = (hex: string) => {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#111' : '#fff';
};

/**
 * The as-built document: the instance's configuration as Enact last read it, laid out for a client's project file.
 * Read-only and made in code from the stored read (no AI, no Halo calls), so it costs nothing to produce.
 */
export default async function AsBuiltPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await getContext();
  const { data: inst } = await supabase
    .from('instances')
    .select('id, name, base_url, inventory, inventory_at, brand_name, brand_colour, brand_logo_url')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!inst) notFound();
  const inv = (inst.inventory ?? {}) as Inventory;
  const d = inv.details ?? {};
  const label = (n: string) => {
    const bare = n.replace(/\*$/, '');
    const l = fieldLabel(inv as Inv, bare);
    return `${l}${n.endsWith('*') ? ' (required)' : ''}`;
  };
  const org = inst.brand_name || workspace.name;
  const colour = inst.brand_colour as string | null;
  const types = Object.entries(d.ticket_types ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const fields = Object.entries(d.custom_fields ?? {}).sort(([, a], [, b]) => a.localeCompare(b));
  const flows = Object.entries(d.workflow_actions_by_stage ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const lists: [string, string][] = [
    ['Services', 'services'], ['Service categories', 'service_categories'], ['Organisations', 'organisations'], ['Sites', 'sites'],
    ['Working hours', 'working_hours'], ['Categories', 'categories'], ['Statuses', 'statuses'], ['Ticket rules', 'ticket_rules'],
    ['Agent notifications', 'agent_notifications'], ['Email templates', 'email_templates'], ['Canned text', 'canned_text'],
    ['Knowledge base articles', 'kb_articles'], ['Roles', 'roles'], ['Asset types', 'asset_types'],
  ];

  if (!inst.inventory_at) {
    return (
      <div className="page">
        <h1>As-built document</h1>
        <p className="muted">Read {inst.name}&apos;s configuration first, then come back here.</p>
        <Link className="btn btn-primary btn-sm" href={`/app/instances/${inst.id}`}>Go to {inst.name}</Link>
      </div>
    );
  }

  return (
    <div className="page report-page">
      <div className="report-tools no-print">
        <Link className="btn btn-quiet btn-sm" href={`/app/instances/${inst.id}`}>Back to {inst.name}</Link>
        <PrintButton />
      </div>
      <article className="report" style={colour ? ({ '--report-accent': colour, '--report-on-accent': textOn(colour) } as React.CSSProperties) : undefined}>
        <header className="report-head">
          {inst.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inst.brand_logo_url} alt={org} className="report-logo" />
          ) : <b className="report-org">{org}</b>}
          <div className="report-title">
            <h1>Halo configuration as built</h1>
            <p>{inst.name} · read {when(inst.inventory_at)}</p>
          </div>
        </header>

        <dl className="report-meta">
          <div><dt>Instance</dt><dd>{inst.base_url}</dd></div>
          <div><dt>Ticket types</dt><dd>{types.length}</dd></div>
          <div><dt>Custom fields</dt><dd>{fields.length}</dd></div>
          <div><dt>Workflows</dt><dd>{flows.length}</dd></div>
        </dl>
        <p className="report-note">This is the configuration exactly as Halo reported it when {site.name} last read the instance. Read it again before printing if anything has changed since.</p>

        <section>
          <h2>Ticket types</h2>
          <table className="report-table">
            <thead><tr><th>Ticket type</th><th>Team, SLA, workflow, approval</th><th>Form</th></tr></thead>
            <tbody>
              {types.map(([n, t]) => (
                <tr key={n}>
                  <td><b>{n}</b></td>
                  <td>{[t.team && `Team: ${t.team}`, t.sla && `SLA: ${t.sla}`, t.workflow && `Workflow: ${t.workflow}`, t.approval && `Approval: ${t.approval}`].filter(Boolean).map((x) => <div key={x as string}>{x}</div>)}</td>
                  <td>
                    {(t.fields ?? []).length ? <div>{(t.fields ?? []).map(label).join(', ')}</div> : null}
                    {Object.entries(t.groups ?? {}).map(([g, fs]) => <div key={g} className="report-detail">{g}: {fs.map(label).join(', ')}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Custom fields</h2>
          <table className="report-table">
            <thead><tr><th>Field</th><th>Type, options and help text</th></tr></thead>
            <tbody>
              {fields.map(([n, desc]) => {
                const m = desc.match(/^"([^"]*)"\s*(.*)$/);
                return <tr key={n}><td><b>{m?.[1] || n}</b><div className="report-detail">{n}</div></td><td>{m?.[2] ?? desc}</td></tr>;
              })}
            </tbody>
          </table>
        </section>

        {Object.keys(d.field_groups ?? {}).length ? (
          <section>
            <h2>Form sections</h2>
            <table className="report-table"><tbody>
              {Object.entries(d.field_groups ?? {}).map(([g, fs]) => <tr key={g}><td><b>{g}</b></td><td>{fs.map(label).join(', ') || 'No fields'}</td></tr>)}
            </tbody></table>
          </section>
        ) : null}

        <section>
          <h2>Workflows</h2>
          <table className="report-table">
            <thead><tr><th>Workflow</th><th>Stages and the actions on each</th></tr></thead>
            <tbody>
              {flows.map(([w, stages]) => (
                <tr key={w}>
                  <td><b>{w}</b></td>
                  <td>{Object.entries(stages).map(([st, acts]) => <div key={st}><b>{st}</b>{acts.length ? `: ${acts.join(', ')}` : ''}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>SLAs and approvals</h2>
          <table className="report-table"><tbody>
            {Object.entries(d.sla_targets ?? {}).map(([n, t]) => <tr key={`sla-${n}`}><td><b>{n}</b><div className="report-detail">SLA</div></td><td>{t || 'No targets'}</td></tr>)}
            {Object.entries(d.approval_processes ?? {}).map(([n, s]) => <tr key={`ap-${n}`}><td><b>{n}</b><div className="report-detail">Approval process</div></td><td>{s.map((x, i) => `${i + 1}. ${x}`).join('  ')}</td></tr>)}
            {Object.entries(d.approval_groups ?? {}).map(([n, m]) => <tr key={`ag-${n}`}><td><b>{n}</b><div className="report-detail">Approval group</div></td><td>{m.join(', ') || 'No members'}</td></tr>)}
          </tbody></table>
          {(d.statuses_that_pause_sla ?? []).length ? <p className="report-note">Statuses that pause the SLA: {(d.statuses_that_pause_sla ?? []).join(', ')}.</p> : null}
        </section>

        <section>
          <h2>Teams</h2>
          <table className="report-table"><tbody>
            {Object.entries(d.teams_department_and_members ?? {}).map(([n, v]) => {
              const [dept, members] = v.split(/:\s(.*)/s);
              return <tr key={n}><td><b>{n}</b>{dept ? <div className="report-detail">{dept}</div> : null}</td><td>{members ?? v}</td></tr>;
            })}
          </tbody></table>
        </section>

        <section>
          <h2>Everything else</h2>
          <table className="report-table"><tbody>
            {lists.map(([title, key]) => {
              const ns = names(inv, key);
              return ns.length ? <tr key={key}><td><b>{title}</b><div className="report-detail">{ns.length}</div></td><td>{ns.join(', ')}</td></tr> : null;
            })}
          </tbody></table>
        </section>

        <section className="report-sign">
          <h2>Sign-off</h2>
          <div className="sign-grid">
            {['Prepared by', 'Accepted by'].map((who) => (
              <div key={who}>
                <span>{who}</span>
                <div className="sign-line" />
                <small>Name, role and date</small>
              </div>
            ))}
          </div>
        </section>

        <footer className="report-foot">As-built document · Generated by {site.name} from the configuration read on {when(inst.inventory_at)} · {org}</footer>
      </article>
    </div>
  );
}

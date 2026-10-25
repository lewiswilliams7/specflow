import { notFound } from 'next/navigation';
import { BuildReport, type ReportBuild, type ReportInstance } from '@/components/BuildReport';
import type { Plan } from '@/lib/specflow/plan-types';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';

/** The sign-off report for one build: what was asked, who ran it, and every record written, with its Halo ID. */
export default async function BuildReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, workspace } = await getContext();
  const { data: build } = await supabase
    .from('builds')
    .select('id, mode, status, summary, log, started_at, finished_at, started_by_email, plan_id, thread_id, instances(name, base_url, inventory, brand_name, brand_colour, brand_logo_url, brand_footer)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();
  if (!build) notFound();
  const { data: planRow } = build.plan_id ? await supabase.from('plans').select('plan').eq('id', build.plan_id).single() : { data: null };
  const plan = (planRow?.plan ?? null) as Plan | null;
  const inst = build.instances as unknown as ReportInstance | null;
  return <BuildReport build={build as unknown as ReportBuild} plan={plan} instance={inst} workspace={workspace} />;
}

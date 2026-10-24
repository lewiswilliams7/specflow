import { ActionForm } from '@/components/ActionForm';
import { scanInstance } from '@/app/app/actions';
import { site } from '@/lib/site';
import { getContext } from '@/lib/workspace';

/**
 * Plans are made from the last configuration read. If a build has changed Halo since then, say so: a plan made from
 * an old read tries to create things that already exist (24 Oct: a second Software Request workflow).
 */
export async function StaleNotice({ instanceId, inventoryAt }: { instanceId: string; inventoryAt: string | null }) {
  if (!inventoryAt) return null;
  const { supabase } = await getContext();
  const { data: last } = await supabase
    .from('builds')
    .select('started_at')
    .eq('instance_id', instanceId)
    .eq('mode', 'apply')
    .in('status', ['succeeded', 'failed', 'stopped'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last || new Date(last.started_at) <= new Date(inventoryAt)) return null;
  return (
    <div className="banner-warn" role="status">
      <span>Halo has changed since {site.name} last read it (a build ran after the last read). Read it again so new plans reuse what was built instead of creating it twice.</span>
      <ActionForm action={scanInstance} submit="Read again" pending="Reading Halo" variant="secondary" size="sm" className="inline-action">
        <input type="hidden" name="instance_id" value={instanceId} />
      </ActionForm>
    </div>
  );
}

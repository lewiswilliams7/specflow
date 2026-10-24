import { Sidebar } from '@/components/Sidebar';
import { plans } from '@/lib/pricing';
import { getContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, workspace } = await getContext();
  const planName = plans.find((p) => p.id === workspace.plan)?.name ?? 'Explore';
  const [{ data: instances }, { data: threads }] = await Promise.all([
    supabase.from('instances').select('id, name').eq('workspace_id', workspace.id).order('created_at'),
    supabase.from('threads').select('id, title').eq('workspace_id', workspace.id).order('updated_at', { ascending: false }).limit(12),
  ]);
  return (
    <div className="app shell">
      <Sidebar workspace={workspace.name} plan={planName} email={user.email ?? ''} instances={instances ?? []} threads={threads ?? []} />
      <div className="main">{children}</div>
    </div>
  );
}

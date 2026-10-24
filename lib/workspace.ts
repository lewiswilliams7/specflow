import { redirect } from 'next/navigation';
import { plans as pricing } from '@/lib/pricing';
import { supabaseServer } from '@/lib/supabase/server';

export type Workspace = { id: string; name: string; plan: 'explore' | 'solo' | 'team' | 'partner' };

/** The signed-in user and their workspace. Redirects to /login when signed out. */
export async function getContext() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, plan)')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .single();
  const workspace = (membership?.workspaces ?? null) as unknown as Workspace | null;
  if (!workspace) throw new Error('No workspace found for this account.');
  const limits = pricing.find((p) => p.id === workspace.plan)?.limits ?? pricing[0].limits;
  return { supabase, user, workspace, role: membership?.role as 'owner' | 'member', limits };
}

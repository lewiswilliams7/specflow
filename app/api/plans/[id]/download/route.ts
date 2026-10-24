/** A ready plan as JSON, for the builder (halo-config-spike: npm run build:onboarding -- --plan downloads). Read-only. */
import { supabaseServer } from '@/lib/supabase/server';
import { getContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await supabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in again.' }, { status: 401 });
  const { supabase, workspace, limits } = await getContext();
  if (!limits.builds) return Response.json({ error: 'Building is part of the paid plans.' }, { status: 403 });
  const { data: row } = await supabase.from('plans').select('plan, errors').eq('id', id).eq('workspace_id', workspace.id).single();
  if (!row?.plan) return Response.json({ error: 'Plan not found.' }, { status: 404 });
  if ((row.errors as string[] | null)?.length) return Response.json({ error: 'This plan didn’t pass the checks, so it can’t be built.' }, { status: 409 });
  if ((row.plan as { questions?: string[] }).questions?.length) return Response.json({ error: 'Answer the plan’s questions first.' }, { status: 409 });
  return new Response(JSON.stringify(row.plan, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="specflow-plan-${id.slice(0, 8)}.json"`,
      'cache-control': 'no-store',
    },
  });
}

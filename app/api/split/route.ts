/** M17: split a long prose brief into parts (shared setup + one per request type). Returns the marked brief, or null. */
import { autoSplit } from '@/lib/specflow/autosplit';
import { supabaseServer } from '@/lib/supabase/server';

export const preferredRegion = 'lhr1';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await supabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: 'Your session has ended. Sign in again.' }, { status: 401 });
  const { message, instance_id } = (await req.json().catch(() => ({}))) as { message?: string; instance_id?: string };
  if (!message) return Response.json({ marked: null });
  try {
    return Response.json({ marked: await autoSplit(String(message).slice(0, 120000), { signal: req.signal, cacheKey: instance_id ? `split-${instance_id}` : undefined }) });
  } catch {
    // Splitting is only a speed-up: if it fails, the brief is planned in one go as before.
    return Response.json({ marked: null });
  }
}

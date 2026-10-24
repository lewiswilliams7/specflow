/**
 * One conversation turn, streamed: the planner's progress as it happens, then the saved turn.
 * Body: { message, instance_id } to start a conversation, { message, thread_id } to reply,
 * or { message, thread_id, edit_of } to edit an earlier message (that turn and the ones after it are superseded).
 * Stopping (the client aborts the request) cancels the model call and saves nothing. Never writes to Halo.
 */
import type { Plan } from '@/lib/specflow/plan-types';
import { generatePlan, type Inventory, type Stage } from '@/lib/specflow/planner';
import { supabaseServer } from '@/lib/supabase/server';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type Body = { message?: string; instance_id?: string; thread_id?: string; edit_of?: string };
type Turn = { id: string; message: string | null; request: string; plan: Plan | null; errors: string[] | null };

/** What the planner did on a turn, as a short note for the conversation history. */
function plannerNote(plan: Plan | null, errors: string[]): string {
  if (!plan) return `No usable plan (${errors[0] ?? 'unknown problem'}).`;
  const changes = plan.steps.filter((s) => s.action !== 'reuse').map((s) => `${s.action} ${s.object} "${s.name ?? s.match?.name}"`);
  return [
    plan.reply ?? '',
    changes.length ? `Planned ${changes.length} change(s): ${changes.join('; ')}.` : 'Planned no changes.',
    plan.unsupported?.length ? `Couldn't do: ${plan.unsupported.join(' | ')}.` : '',
    plan.questions?.length ? `Asked: ${plan.questions.join(' | ')}` : '',
  ].filter(Boolean).join(' ');
}

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const auth = await supabaseServer();
  const {
    data: { user: signedIn },
  } = await auth.auth.getUser();
  if (!signedIn) return json(401, 'Your session has ended. Sign in again.');
  const { supabase, user, workspace, limits } = await getContext();

  const body = (await req.json().catch(() => ({}))) as Body;
  const message = String(body.message ?? '').trim().slice(0, 8000);
  if (!message) return json(400, 'Write a message first.');

  // Which thread and instance.
  let threadId = body.thread_id || undefined;
  let instanceId = body.instance_id || '';
  let threadTitle = '';
  if (threadId) {
    const { data: thread } = await supabase.from('threads').select('instance_id, title').eq('id', threadId).eq('workspace_id', workspace.id).single();
    if (!thread) return json(404, 'That conversation isn’t in your workspace.');
    instanceId = thread.instance_id;
    threadTitle = thread.title;
  } else if (message.length < 20) {
    return json(400, 'Describe what you need in a sentence or two.');
  }
  const { data: inst } = await supabase.from('instances').select('id, inventory').eq('id', instanceId).eq('workspace_id', workspace.id).single();
  if (!inst) return json(404, 'That instance isn’t in your workspace.');
  if (!inst.inventory) return json(400, 'Read the instance first, so the plan knows what already exists.');

  if (limits.plansPerMonth !== null) {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from('plans').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).gte('created_at', since.toISOString());
    if ((count ?? 0) >= limits.plansPerMonth) return json(402, `You’ve used this month’s ${limits.plansPerMonth} plans on Explore.`);
  }

  // The conversation before this turn. Editing a message replans from just before it.
  let earlier: Turn[] = [];
  let replaced: string[] = [];
  if (threadId) {
    const { data } = await supabase.from('plans').select('id, message, request, plan, errors').eq('thread_id', threadId).is('superseded_at', null).order('created_at');
    const turns = (data ?? []) as Turn[];
    const at = body.edit_of ? turns.findIndex((t) => t.id === body.edit_of) : turns.length;
    if (at < 0) return json(409, 'That message has already been edited. Refresh to see the latest version.');
    earlier = turns.slice(0, at);
    replaced = turns.slice(at).map((t) => t.id);
  }
  const history = earlier.flatMap((t) => [
    { role: 'user' as const, text: t.message ?? t.request },
    { role: 'planner' as const, text: plannerNote(t.plan, t.errors ?? []) },
  ]);
  const previous = [...earlier].reverse().find((t) => t.plan)?.plan ?? null;
  const askedBefore = earlier.flatMap((t) => t.plan?.questions ?? []);

  // Stop: the client aborts the request; cancel the model call and save nothing.
  const stop = new AbortController();
  req.signal.addEventListener('abort', () => stop.abort());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (stop.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          stop.abort();
        }
      };
      const started = Date.now();
      try {
        const result = await generatePlan(
          inst.inventory as Inventory,
          message,
          { requester: { email: user.email ?? '' }, history, previous, askedBefore },
          { signal: stop.signal, cacheKey: `specflow-${inst.id}`, onStage: (stage: Stage, detail?: string) => send({ type: 'stage', stage, detail }) },
        );
        if (stop.signal.aborted) return;

        if (!threadId) {
          const title = message.split('\n')[0].slice(0, 80);
          const { data: thread, error } = await supabase
            .from('threads')
            .insert({ workspace_id: workspace.id, instance_id: inst.id, title, created_by: user.id })
            .select('id')
            .single();
          if (error || !thread) throw new Error('Couldn’t start the conversation. Try again.');
          threadId = thread.id;
        }
        const { data: turn, error } = await supabase
          .from('plans')
          .insert({
            workspace_id: workspace.id,
            instance_id: inst.id,
            thread_id: threadId,
            message,
            request: result.plan?.request ?? message,
            plan: result.plan,
            errors: result.errors,
            model: result.model,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (error || !turn) throw new Error('The plan was made but couldn’t be saved. Try again.');
        if (replaced.length) await supabase.from('plans').update({ superseded_at: new Date().toISOString() }).in('id', replaced);
        const retitle = body.edit_of && earlier.length === 0 && threadTitle ? { title: message.split('\n')[0].slice(0, 80) } : {};
        await supabase.from('threads').update({ updated_at: new Date().toISOString(), ...retitle }).eq('id', threadId);
        send({ type: 'done', thread_id: threadId, turn_id: turn.id, seconds: Math.round((Date.now() - started) / 1000) });
      } catch (e) {
        if (!stop.signal.aborted) send({ type: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
    },
    cancel() {
      stop.abort();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}

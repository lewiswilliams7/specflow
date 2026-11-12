/**
 * One conversation turn, streamed: the planner's progress as it happens, then the saved turn.
 * Body: { message, instance_id } to start a conversation, { message, thread_id } to reply,
 * or { message, thread_id, edit_of } to edit an earlier message (that turn and the ones after it are superseded).
 * Stopping (the client aborts the request) cancels the model call and saves nothing. Never writes to Halo.
 */
import type { Plan } from '@/lib/specflow/plan-types';
import { partIsSealed } from '@/lib/specflow/part-seal';
import { generatePlan, mergeAndCheck, type Inventory, type Stage } from '@/lib/specflow/planner';
import { supabaseServer } from '@/lib/supabase/server';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type Part = { title: string; plan: Plan | null; errors: string[]; model?: string; seal: string };
/** parts: a long brief's forms, each already planned by /api/plan-part (rule M14): merged and checked here. */
type Body = { message?: string; instance_id?: string; thread_id?: string; edit_of?: string; parts?: Part[] };
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
    plan.choices?.length ? `Offered choices: ${plan.choices.map((c) => `${c.question} (${c.options.join(' / ')})`).join(' | ')}` : '',
  ].filter(Boolean).join(' ');
}

const clip = (text: string) => (text.length > 4000 ? `${text.slice(0, 4000)}\n[… the rest of this long message is already reflected in the current plan]` : text);

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const auth = await supabaseServer();
  const {
    data: { user: signedIn },
  } = await auth.auth.getUser();
  if (!signedIn) return json(401, 'Your session has ended. Sign in again.');
  const { supabase, user, workspace, limits } = await getContext();

  const body = (await req.json().catch(() => ({}))) as Body;
  const message = String(body.message ?? '').trim().slice(0, 120000); // matches the composer (long briefs, attached files)
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
  const parts = Array.isArray(body.parts) ? body.parts : null;
  if (parts && (!parts.length || parts.some((p) => !partIsSealed(inst.id, String(p.title), p.plan ?? null, p.seal)))) {
    return json(400, 'Part of that plan didn’t come from the planner. Send the message again.');
  }

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
  // M12: a turn that started a fresh plan is where this conversation's current request begins. Earlier turns were
  // about another request: leave them out, or the planner mixes the two.
  const freshAt = earlier.map((t) => Boolean(t.plan?.fresh)).lastIndexOf(true);
  if (freshAt > 0) earlier = earlier.slice(freshAt);
  // M12b: once the latest plan has been built in Halo, the next message is new work, never an edit of what's built.
  // (The planner's own judgement kept treating a new brief as a change: 11 Nov.)
  let builtBefore = false;
  const lastPlanned = [...earlier].reverse().find((t) => t.plan);
  if (lastPlanned) {
    const { count } = await supabase.from('builds').select('id', { count: 'exact', head: true }).eq('plan_id', lastPlanned.id).eq('mode', 'apply').eq('status', 'succeeded');
    if ((count ?? 0) > 0) {
      builtBefore = true;
      earlier = [];
    }
  }
  const history = earlier.flatMap((t) => [
    // A long brief (pasted or attached) is already in the current plan: resending it in full on every follow-up only
    // costs tokens. Its opening is kept for context.
    { role: 'user' as const, text: clip(t.message ?? t.request ?? '') },
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
        let result;
        if (parts) {
          // M14: a brief marked into forms is always a new request; its forms were planned one per request.
          send({ type: 'stage', stage: 'checking', detail: `merging ${parts.length} parts` });
          result = mergeAndCheck(inst.inventory as Inventory, message, parts.map((p) => ({ title: String(p.title), plan: p.plan, errors: p.errors ?? [] })), { requester: { email: user.email ?? '' } });
          result.model = parts.find((p) => p.model)?.model ?? '';
          if (result.plan && earlier.some((t) => t.plan)) result.plan.fresh = true;
        } else {
          result = await generatePlan(
            inst.inventory as Inventory,
            message,
            { requester: { email: user.email ?? '' }, history, previous, askedBefore },
            { signal: stop.signal, cacheKey: `specflow-${inst.id}`, onStage: (stage: Stage, detail?: string) => send({ type: 'stage', stage, detail }) },
          );
        }
        if (stop.signal.aborted) return;
        if (builtBefore && result.plan) result.plan.fresh = true;

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

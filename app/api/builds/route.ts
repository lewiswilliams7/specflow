/**
 * Build a plan in Halo, streamed. Body: { plan_id, mode: 'preview' | 'apply' }.
 *  - preview: reads the instance and reports exactly what would be created or changed. Writes nothing.
 *  - apply: dry-runs the whole plan first and refuses on any problem (rule B1), then builds step by step,
 *    checking each object after it's saved and stopping at the first failure.
 * Stopping (the client aborts) stops between steps, never in the middle of a write. Re-running is safe (U4).
 */
import { brandOf, withBrand } from '@/lib/brand';
import { decrypt } from '@/lib/crypto';
import { type BuildResult, buildWithGate, type StepLog } from '@/lib/specflow/build/build';
import { memoryTemplates, withRuntime } from '@/lib/specflow/build/runtime';
import { assertPublicHost, haloClient } from '@/lib/specflow/halo';
import type { Plan } from '@/lib/specflow/plan-types';
import { supabaseServer } from '@/lib/supabase/server';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const json = (status: number, error: string) => Response.json({ error }, { status });

/** Counts for the report. */
function summarise(r: BuildResult) {
  const n = (o: StepLog['outcome']) => r.log.filter((l) => l.outcome === o).length;
  return {
    created: n('created'),
    updated: n('updated'),
    would_create: n('would create'),
    would_update: n('would update'),
    reused: n('reused') + n('already exists'),
    failed: n('failed'),
    warnings: r.log.reduce((k, l) => k + l.warnings.length, 0),
    dropdowns_created: r.log.filter((l) => l.outcome === 'created' && l.object === 'field' && [2, 3].includes(Number((l.payload as Record<string, unknown>)?.type))).length,
  };
}

export async function POST(req: Request) {
  const auth = await supabaseServer();
  const {
    data: { user: signedIn },
  } = await auth.auth.getUser();
  if (!signedIn) return json(401, 'Your session has ended. Sign in again.');
  const { supabase, user, workspace, limits } = await getContext();
  if (!limits.builds) return json(403, 'Building in Halo is part of the paid plans.');

  const body = (await req.json().catch(() => ({}))) as { plan_id?: string; mode?: string };
  const mode = body.mode === 'apply' ? 'apply' : 'preview';
  const { data: row } = await supabase.from('plans').select('id, plan, errors, instance_id, thread_id, superseded_at').eq('id', body.plan_id ?? '').eq('workspace_id', workspace.id).single();
  if (!row?.plan) return json(404, 'Plan not found.');
  if ((row.errors as string[] | null)?.length) return json(409, 'This plan didn’t pass the checks, so it can’t be built.');
  const plan = row.plan as Plan;
  if (plan.questions?.length) return json(409, 'Answer the plan’s questions first.');
  if (row.superseded_at) return json(409, 'This version of the plan was replaced by an edit. Build the latest one.');

  const { data: inst } = await supabase.from('instances').select('id, name, base_url, tenant, client_id, secret_ciphertext, brand_name, brand_colour, brand_logo_url, brand_footer').eq('id', row.instance_id).eq('workspace_id', workspace.id).single();
  if (!inst) return json(404, 'That instance isn’t in your workspace.');
  try {
    await assertPublicHost(inst.base_url);
  } catch (e) {
    return json(400, (e as Error).message);
  }

  // The client's branding goes on every email template (rule EM1); a brand the planner wrote is dropped.
  const branded = withBrand(plan, brandOf(inst));

  // A build cut off by the time limit leaves its row "running": clear those so the instance isn't locked forever.
  await supabase.from('builds').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('instance_id', inst.id).eq('status', 'running').lt('started_at', new Date(Date.now() - 6 * 60_000).toISOString());
  const { data: build, error: lockError } = await supabase
    .from('builds')
    .insert({ workspace_id: workspace.id, instance_id: inst.id, plan_id: row.id, thread_id: row.thread_id, mode, started_by: user.id, started_by_email: user.email ?? null })
    .select('id')
    .single();
  if (lockError || !build) return json(409, mode === 'apply' ? 'Another build is running on this instance. Wait for it to finish.' : 'Couldn’t start. Try again.');

  const stop = new AbortController();
  req.signal.addEventListener('abort', () => stop.abort());
  const encoder = new TextEncoder();
  const halo = haloClient({ baseUrl: inst.base_url, tenant: inst.tenant ?? '', clientId: inst.client_id, clientSecret: decrypt(inst.secret_ciphertext) });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const lines: string[] = [];
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          stop.abort(); // the page was closed: stop between steps
        }
      };
      let result: BuildResult | null = null;
      let failure = '';
      try {
        result = await withRuntime({ halo, templates: memoryTemplates() }, () =>
          buildWithGate(branded, {
            apply: mode === 'apply',
            signal: stop.signal,
            emit: (e) => {
              if (e.type === 'line') lines.push(...e.text.split('\n'));
              send(e.type === 'step' ? { type: 'step', index: e.index, total: e.total, entry: { ...e.entry, payload: undefined } } : e);
            },
          }),
        );
      } catch (e) {
        failure = e instanceof Error ? e.message : 'The build stopped unexpectedly.';
        lines.push(failure);
      }
      // Halo refused the saved login: flag the instance so its pages point to the fix.
      const all = [failure, ...(result?.problems ?? []), ...(result?.log ?? []).map((l) => l.error ?? '')].join('\n');
      if (/rejected the saved client ID|stopped accepting the saved client ID/.test(all))
        await supabase.from('instances').update({ status: 'failed', last_error: 'Halo rejected the saved client ID or secret. Update the connection with the current ones.' }).eq('id', inst.id);
      const status = !result ? 'failed' : result.refused ? 'refused' : result.stopped ? 'stopped' : result.ok ? 'succeeded' : 'failed';
      const summary = result ? summarise(result) : null;
      await supabase
        .from('builds')
        .update({ status, summary, log: result?.log ?? [], lines, finished_at: new Date().toISOString() })
        .eq('id', build.id);
      // Every reason the build can't go ahead, by step, so the page can say it in plain words at the top.
      const issues = [
        ...(result?.problems ?? []).map((text) => ({ step: '', text })),
        ...(result?.log ?? []).flatMap((l) => [...(l.error ? [{ step: l.step, text: l.error.split('\n')[0] }] : []), ...l.warnings.map((text) => ({ step: l.step, text }))]),
        ...(failure ? [{ step: '', text: failure }] : []),
      ];
      send({ type: 'done', build_id: build.id, status, summary, problems: issues });
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
    cancel() {
      stop.abort();
    },
  });

  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}

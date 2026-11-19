/**
 * Planner model call: OPENAI_API_KEY (default gpt-5) or ANTHROPIC_API_KEY. PLANNER_MODEL overrides.
 * OPENAI_BASE_URL points at an OpenAI-compatible endpoint (e.g. Azure OpenAI or a local mock for tests).
 * Same as the spike's lib/llm.ts, minus the test hook.
 */
export type CompleteOptions = {
  /** Reasoning effort for reasoning models. Revisions use 'low': the plan is already made. */
  effort?: 'minimal' | 'low' | 'medium' | 'high';
  /** Stop button: aborts the model call. */
  signal?: AbortSignal;
  /** Groups calls for OpenAI's prompt cache (same instance, same prefix). */
  cacheKey?: string;
  /** A cheaper model for simple jobs (the brief splitter). Ignored when PLANNER_MODEL is set or on Anthropic. */
  model?: string;
};

/**
 * M28 (19 Nov): call the model API, retrying when the provider is briefly unavailable. Under load (eight forms planned
 * at once) OpenAI's edge answered with an HTML error page, and reading it as JSON failed the whole part with
 * 'Unexpected token "<"'. A busy or failing gateway (429, 5xx, or a reply that isn't JSON) is tried again up to twice,
 * but only when it failed quickly, so a retry can't run the request past its time limit.
 */
async function callModel<T>(url: string, init: RequestInit): Promise<{ res: Response; json: T }> {
  const RETRY = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 529]);
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    const res = await fetch(url, init);
    const text = await res.text();
    let json: T | undefined;
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = undefined;
    }
    const quick = Date.now() - started < 90_000;
    if ((json === undefined || RETRY.has(res.status)) && attempt < 3 && quick && !init.signal?.aborted) {
      await new Promise((r) => setTimeout(r, attempt === 1 ? 4000 : 12000));
      continue;
    }
    if (json === undefined) {
      throw new Error(`The planner model's provider is having trouble (HTTP ${res.status}, it sent an error page instead of a plan). Wait a minute and send it again.`);
    }
    return { res, json };
  }
}

export async function complete(system: string, user: string, opts: CompleteOptions = {}): Promise<{ text: string; model: string }> {
  const override = process.env.PLANNER_MODEL?.trim();
  if (process.env.OPENAI_API_KEY) {
    const model = override || opts.model || 'gpt-5';
    const base = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
    const { res, json } = await callModel<{
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
      usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } };
    }>(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: opts.signal,
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        // Reasoning models (gpt-5, o-series) only accept the default temperature.
        ...(/^(gpt-5|o\d)/.test(model) ? (opts.effort ? { reasoning_effort: opts.effort } : {}) : { temperature: 0.2 }),
        ...(opts.cacheKey ? { prompt_cache_key: opts.cacheKey } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    // One line per call in the server logs, so the cost of a plan can be seen (and checked when it seems high).
    if (json.usage) {
      const u = json.usage;
      console.log(JSON.stringify({ planner_usage: { model, effort: opts.effort ?? 'default', input: u.prompt_tokens, cached: u.prompt_tokens_details?.cached_tokens ?? 0, output: u.completion_tokens, reasoning: u.completion_tokens_details?.reasoning_tokens ?? 0 } }));
    }
    if (!res.ok) throw new Error(`The planner model returned an error (${res.status}): ${json.error?.message ?? 'unknown'}`);
    return { text: json.choices?.[0]?.message?.content ?? '', model };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const model = override || 'claude-sonnet-5-5';
    const { res, json } = await callModel<{ content?: { type: string; text?: string }[]; error?: { message?: string } }>('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      signal: opts.signal,
      // The system prompt is the same on every call: cache it.
      body: JSON.stringify({ model, max_tokens: 16000, system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`The planner model returned an error (${res.status}): ${json.error?.message ?? 'unknown'}`);
    return { text: (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(''), model };
  }
  throw new Error('No planner key set: add OPENAI_API_KEY or ANTHROPIC_API_KEY.');
}

/** Pull the first JSON object out of a model reply (handles ```json fences). */
export function parseJsonReply<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw) as T;
}

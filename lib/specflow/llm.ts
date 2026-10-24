/**
 * Planner model call: OPENAI_API_KEY (default gpt-5) or ANTHROPIC_API_KEY. PLANNER_MODEL overrides.
 * Same as the spike's lib/llm.ts, minus the test hook.
 */
export async function complete(system: string, user: string): Promise<{ text: string; model: string }> {
  const override = process.env.PLANNER_MODEL?.trim();
  if (process.env.OPENAI_API_KEY) {
    const model = override || 'gpt-5';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        // Reasoning models (gpt-5, o-series) only accept the default temperature.
        ...(/^(gpt-5|o\d)/.test(model) ? {} : { temperature: 0.2 }),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(`The planner model returned an error (${res.status}): ${json.error?.message ?? 'unknown'}`);
    return { text: json.choices?.[0]?.message?.content ?? '', model };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const model = override || 'claude-sonnet-5-5';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 16000, system, messages: [{ role: 'user', content: user }] }),
    });
    const json = (await res.json()) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
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

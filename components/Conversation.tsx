'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconArrowUp, IconCheck, IconCopy, IconPencil, IconStop } from '@/components/icons';
import { Choices } from '@/components/Choices';
import { Questions } from '@/components/Questions';
import { splitForms } from '@/lib/specflow/forms';
import { ATTACH_TYPES, type Attached, readAttachment, withAttachments } from '@/lib/attachments';
import { Mark } from '@/components/SiteChrome';

export type TurnView = { id: string; message: string; planner: ReactNode };

type Props = {
  instanceId: string;
  threadId?: string;
  turns: TurnView[];
  placeholder: string;
  /** Shown above the composer when the conversation is empty. */
  start?: { heading: string; suggestions: string[] };
  /** Why sending is blocked (e.g. the instance hasn't been read). */
  blocked?: string;
  /** Shown under the start view (e.g. earlier conversations). */
  after?: ReactNode;
  /** The latest plan's choices (rule M13), shown just above the message box. */
  choices?: { question: string; options: string[] }[];
  /** The latest plan's questions, each with its own answer box just above the message box. */
  questions?: string[];
  /** When the instance was last read: a part planned against an older read isn't reused. */
  inventoryAt?: string | null;
};

type Pending = { message: string; editOf?: string; stage: string; detail?: string; startedAt: number; awaiting?: string };

const STAGE: Record<string, (d?: string) => string> = {
  sending: () => 'Starting',
  planning: () => 'Reading your instance and drafting the plan',
  revising: () => 'Updating the plan',
  checking: () => 'Checking the plan against your instance',
  fixing: (d) => `Fixing ${d === '1' ? 'a problem' : `${d ?? 'the'} problems`} the checks found`,
  saving: () => 'Saving',
};

/** A short, stable fingerprint of a part's text, for reusing a part already planned in this browser. */
function hashText(t: string): string {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + t.length.toString(36);
}
/** Parts planned cleanly in the last 24 hours, kept in this browser only. */
function readSaved(key: string): { plan?: unknown; errors?: string[]; seal?: string; title?: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, body } = JSON.parse(raw) as { at: number; body: { plan?: unknown } };
    return Date.now() - at < 24 * 3600 * 1000 && body?.plan ? body : null;
  } catch {
    return null;
  }
}
function writeSaved(key: string, body: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), body }));
  } catch {
    // Storage full or blocked: planning still works, it just isn't reused.
  }
}

/** A sent message: what was typed in full, attached files as a name you can open. */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/\n*=== ATTACHED FILE: (.+?) ===\n/);
  if (parts.length === 1) return <>{text}</>;
  const files: { name: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) files.push({ name: parts[i], body: parts[i + 1] ?? '' });
  return (
    <>
      {parts[0]}
      {files.map((f) => (
        <details key={f.name} className="attached-file">
          <summary>Attached: {f.name}</summary>
          <pre>{f.body}</pre>
        </details>
      ))}
    </>
  );
}

/** Long briefs and attached form designs fit; the server keeps the same limit. */
const MAX_MESSAGE = 120000;

const fmt = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

/** Chat with the planner. Enter sends, Shift+Enter adds a line, Stop cancels, Edit replans from that message. */
export function Conversation({ instanceId, threadId, turns, placeholder, start, blocked, after, choices, questions, inventoryAt }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [stopped, setStopped] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [files, setFiles] = useState<Attached[]>([]);
  const [reading, setReading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  // The composer's height, so a plan's build bar and progress can stick just above it (13 Nov: they scrolled away).
  useEffect(() => {
    const el = dock.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', `${Math.ceil(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Clear the pending turn once the saved one arrives from the server.
  useEffect(() => {
    if (pending?.awaiting && turns.some((t) => t.id === pending.awaiting)) setPending(null);
  }, [turns, pending?.awaiting]);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length, pending?.message]);

  // "Ask … to fix this" on a blocked build puts the problems in the box, ready to send.
  useEffect(() => {
    const fill = (e: Event) => {
      setDraft((e as CustomEvent<string>).detail);
      setTimeout(() => box.current?.focus(), 0);
      box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    window.addEventListener('specflow:reply', fill);
    return () => window.removeEventListener('specflow:reply', fill);
  }, []);


  // Grow the box with its content.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [draft]);

  const send = useCallback(
    async (message: string, editOf?: string) => {
      const attached = editOf ? [] : files;
      const text = withAttachments(message, attached).trim();
      if (!text || pending || blocked) return;
      if (text.length > MAX_MESSAGE) {
        setError(`That's ${text.length.toLocaleString()} characters; the limit is ${MAX_MESSAGE.toLocaleString()}. Split it into two messages, or remove a file.`);
        return;
      }
      if (!editOf) setFiles([]);
      setError('');
      setStopped(false);
      setEditing(null);
      if (!editOf) setDraft('');
      const ctrl = new AbortController();
      abort.current = ctrl;
      setPending({ message: text, editOf, stage: 'sending', startedAt: Date.now() });
      setNow(Date.now());
      const restore = () => {
        if (editOf) setEditing({ id: editOf, text });
        else {
          setDraft(message);
          setFiles(attached);
        }
      };
      try {
        // M17: a long first brief written as prose is split into parts first, so it's planned like a marked brief.
        let brief = text;
        if (!threadId && !editOf && !splitForms(text) && text.length >= 800) {
          setPending((p) => (p ? { ...p, stage: 'planning', detail: 'finding the request types in your brief' } : p));
          const r = await fetch('/api/split', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: text, instance_id: instanceId }), signal: ctrl.signal }).catch(() => null);
          const marked = r?.ok ? ((await r.json().catch(() => ({}))) as { marked?: string | null }).marked : null;
          if (marked && splitForms(marked)) brief = marked;
        }
        // M14: a brief marked into forms is planned one form per request, in parallel, so none runs into the time limit.
        const split = splitForms(brief);
        let parts: unknown[] | undefined;
        if (split) {
          let planned = 0;
          const n = split.forms.length;
          setPending((p) => (p ? { ...p, stage: 'planning', detail: `${n} parts, all at once` } : p));
          type PartResult = { error?: string; title?: string; plan?: unknown; errors?: string[]; seal?: string };
          const ask = async (index: number, fix?: PartResult) => {
            const r = await fetch('/api/plan-part', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ message: brief, instance_id: instanceId, index, fix: fix ? { plan: fix.plan, errors: fix.errors, seal: fix.seal } : undefined }),
              signal: ctrl.signal,
            });
            const body = (await r.json().catch(() => ({}))) as PartResult;
            if (!r.ok) throw new Error(body.error ?? `Planning part ${index + 1} failed (${r.status}). Try again.`);
            return body;
          };
          parts = await Promise.all(
            split.forms.map(async (_, index) => {
              // Every part starts with the same instructions and instance read. Starting the others a few seconds
              // after the first lets the model provider reuse that shared start (charged at a tenth of the price)
              // instead of every part paying for it in full.
              // A part already planned for this exact text in this browser (e.g. sending the same brief again after a
              // fix) is reused rather than paid for twice. The merge re-checks it against the current instance.
              const key = `enact-part:${process.env.NEXT_PUBLIC_BUILD_ID ?? ''}:${instanceId}:${inventoryAt ?? ''}:${index}:${hashText(split.forms[index].text + split.preamble)}`;
              const saved = readSaved(key);
              if (saved) {
                planned++;
                setPending((p) => (p ? { ...p, stage: 'planning', detail: `${planned} of ${n} parts planned` } : p));
                return saved;
              }
              if (index > 0) await new Promise((r) => setTimeout(r, 8000));
              let body = await ask(index);
              // A part with problems gets one more pass on its own before the parts are merged.
              if (body.plan && body.errors?.length) {
                setPending((p) => (p ? { ...p, stage: 'checking', detail: `fixing part ${index + 1}` } : p));
                const fixed = await ask(index, body).catch(() => null);
                if (fixed?.plan && (fixed.errors?.length ?? 0) < body.errors.length) body = fixed;
              }
              if (body.plan && !body.errors?.length) writeSaved(key, body);
              planned++;
              setPending((p) => (p ? { ...p, stage: 'planning', detail: `${planned} of ${n} parts planned` } : p));
              return body;
            }),
          );
        }
        const res = await fetch('/api/turns', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: brief, instance_id: instanceId, thread_id: threadId, edit_of: editOf, parts }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Something went wrong (${res.status}).`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let done: { thread_id: string; turn_id: string } | null = null;
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as { type: string; stage?: string; detail?: string; message?: string; thread_id?: string; turn_id?: string };
            if (ev.type === 'stage') setPending((p) => (p ? { ...p, stage: ev.stage ?? p.stage, detail: ev.detail } : p));
            if (ev.type === 'error') throw new Error(ev.message);
            if (ev.type === 'done') done = { thread_id: ev.thread_id!, turn_id: ev.turn_id! };
          }
        }
        if (!done) throw new Error('The connection closed before the plan was saved. Try again.');
        setPending((p) => (p ? { ...p, stage: 'saving', awaiting: done!.turn_id } : p));
        if (!threadId) router.push(`/app/threads/${done.thread_id}`);
        else router.refresh();
        // If the refresh doesn't bring the turn (e.g. the network dropped), don't spin forever.
        setTimeout(() => setPending((p) => (p?.awaiting === done!.turn_id ? null : p)), 20000);
      } catch (e) {
        setPending(null);
        restore();
        if ((e as Error).name === 'AbortError') setStopped(true);
        else setError((e as Error).message || 'Something went wrong.');
      } finally {
        abort.current = null;
      }
    },
    [pending, blocked, instanceId, threadId, router, files, inventoryAt],
  );

  // A choice button under a plan (rule M13) sends its answer as the next message.
  useEffect(() => {
    const answer = (e: Event) => void send((e as CustomEvent<string>).detail);
    window.addEventListener('specflow:send', answer);
    return () => window.removeEventListener('specflow:send', answer);
  }, [send]);

  const stop = () => abort.current?.abort();
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // clipboard blocked: nothing to do
    }
  };

  const busy = Boolean(pending);
  const cut = pending?.editOf ? turns.findIndex((t) => t.id === pending.editOf) : -1;
  const shown = cut >= 0 ? turns.slice(0, cut) : turns;
  const elapsed = pending ? Math.max(0, Math.round((now - pending.startedAt) / 1000)) : 0;
  const empty = !shown.length && !pending;

  const composer = (
    <div className="composer-dock" ref={dock}>
      {choices?.length && !pending ? <Choices key={turns.at(-1)?.id} choices={choices} hold={Boolean(questions?.length)} /> : null}
      {questions?.length && !pending ? <Questions key={`q-${turns.at(-1)?.id}`} questions={questions} /> : null}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="message" className="sr-only">Message</label>
        <textarea
          id="message"
          ref={box}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          maxLength={MAX_MESSAGE}
          placeholder={blocked ?? placeholder}
          disabled={Boolean(blocked)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        {files.length ? (
          <div className="attached" aria-label="Attached files">
            {files.map((f) => (
              <span key={f.name} className="chip" title={`${f.text.length.toLocaleString()} characters`}>
                {f.design ? `${f.name}: form design, ${f.design.forms} form${f.design.forms === 1 ? '' : 's'}, ${f.design.fields} fields` : f.name}
                <button type="button" className="chip-x" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.name !== f.name))}>×</button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="composer-bar">
          <input
            ref={picker}
            type="file"
            accept={ATTACH_TYPES}
            multiple
            hidden
            onChange={async (e) => {
              const list = [...(e.target.files ?? [])];
              e.target.value = '';
              if (!list.length) return;
              setReading(true);
              setError('');
              try {
                const read = await Promise.all(list.map(readAttachment));
                setFiles((fs) => [...fs.filter((f) => !read.some((r) => r.name === f.name)), ...read]);
              } catch (err) {
                setError((err as Error).message || 'Couldn’t read that file.');
              } finally {
                setReading(false);
              }
            }}
          />
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => picker.current?.click()} disabled={busy || Boolean(blocked) || reading} title="Attach a spreadsheet, CSV or text file">
            {reading ? 'Reading…' : 'Attach file'}
          </button>
          <span className="subtle">Shift+Enter for a new line</span>
          {busy ? (
            <button className="btn btn-secondary send" type="button" onClick={stop} aria-label="Stop">
              <IconStop />
            </button>
          ) : (
            <button className="btn btn-primary send" type="submit" disabled={(!draft.trim() && !files.length) || Boolean(blocked) || reading} aria-label="Send">
              <IconArrowUp />
            </button>
          )}
        </div>
      </form>
      {error ? <p className="notice error composer-error" role="alert">{error}</p> : null}
      <p className="composer-note">Messages change the plan, never Halo. Building happens from a ready plan, after a preview.</p>
    </div>
  );

  if (empty && start) {
    return (
      <div className="start">
        <h1>{start.heading}</h1>
        {stopped ? <p className="stopped">Stopped. Nothing was saved.</p> : null}
        {composer}
        {!blocked && start.suggestions.length ? (
          <div className="suggestions">
            {start.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => { setDraft(s); box.current?.focus(); }}>
                {s.length > 70 ? `${s.slice(0, 68)}…` : s}
              </button>
            ))}
          </div>
        ) : null}
        {after}
      </div>
    );
  }

  return (
    <>
      <div className="chat-scroll" aria-live="polite">
        {shown.map((t, i) => (
          <div className="turn" key={t.id}>
            {editing?.id === t.id ? (
              <form
                className="msg-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(editing.text, t.id);
                }}
              >
                <label htmlFor={`edit-${t.id}`} className="sr-only">Edit message</label>
                <textarea
                  id={`edit-${t.id}`}
                  value={editing.text}
                  autoFocus
                  onChange={(e) => setEditing({ id: t.id, text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditing(null);
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(editing.text, t.id);
                    }
                  }}
                />
                <div className="row-between">
                  <span className="subtle">
                    {i < shown.length - 1 ? 'Sending replans from here. The replies after this message are replaced.' : 'Sending replans from here.'}
                  </span>
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-quiet btn-sm" type="button" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" type="submit" disabled={!editing.text.trim() || busy}>Send</button>
                  </span>
                </div>
              </form>
            ) : (
              <div className="msg-user">
                <div className="bubble"><MessageText text={t.message} /></div>
                <div className="msg-tools">
                  <button className="btn btn-quiet btn-icon" type="button" onClick={() => copy(t.id, t.message)} aria-label="Copy message" title="Copy">
                    {copied === t.id ? <IconCheck /> : <IconCopy />}
                  </button>
                  <button className="btn btn-quiet btn-icon" type="button" disabled={busy} onClick={() => setEditing({ id: t.id, text: t.message })} aria-label="Edit message" title="Edit">
                    <IconPencil />
                  </button>
                </div>
              </div>
            )}
            {t.planner}
          </div>
        ))}

        {pending ? (
          <div className="turn">
            <div className="msg-user">
              <div className="bubble"><MessageText text={pending.message} /></div>
            </div>
            <div className="msg-planner">
              <div className="thinking" role="status">
                <Mark size={18} />
                <span className="spinner" aria-hidden="true" />
                <span>{STAGE[pending.stage]?.(pending.detail) ?? 'Working'}</span>
                <span className="time">{fmt(elapsed)}</span>
              </div>
            </div>
          </div>
        ) : null}
        {stopped ? <p className="stopped">Stopped. Nothing was saved; your message is back in the box.</p> : null}
        <div ref={end} />
      </div>
      {composer}
    </>
  );
}

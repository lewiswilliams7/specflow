'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconArrowUp, IconCheck, IconCopy, IconPencil, IconStop } from '@/components/icons';
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

const fmt = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

/** Chat with the planner. Enter sends, Shift+Enter adds a line, Stop cancels, Edit replans from that message. */
export function Conversation({ instanceId, threadId, turns, placeholder, start, blocked, after }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [stopped, setStopped] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [now, setNow] = useState(Date.now());
  const abort = useRef<AbortController | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

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

  // Grow the box with its content.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [draft]);

  const send = useCallback(
    async (message: string, editOf?: string) => {
      const text = message.trim();
      if (!text || pending || blocked) return;
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
        else setDraft(text);
      };
      try {
        const res = await fetch('/api/turns', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: text, instance_id: instanceId, thread_id: threadId, edit_of: editOf }),
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
    [pending, blocked, instanceId, threadId, router],
  );

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
    <div className="composer-dock">
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
          maxLength={8000}
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
        <div className="composer-bar">
          <span className="subtle">Shift+Enter for a new line</span>
          {busy ? (
            <button className="btn btn-secondary send" type="button" onClick={stop} aria-label="Stop">
              <IconStop />
            </button>
          ) : (
            <button className="btn btn-primary send" type="submit" disabled={!draft.trim() || Boolean(blocked)} aria-label="Send">
              <IconArrowUp />
            </button>
          )}
        </div>
      </form>
      {error ? <p className="notice error composer-error" role="alert">{error}</p> : null}
      <p className="composer-note">Plans only. Nothing is written to Halo from here.</p>
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
                <div className="bubble">{t.message}</div>
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
              <div className="bubble">{pending.message}</div>
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

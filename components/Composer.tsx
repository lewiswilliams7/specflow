'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { FormState } from '@/app/app/actions';

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  placeholder: string;
  autoFocus?: boolean;
};

/** Chat-style message box: Enter sends, Shift+Enter adds a line. Shows a planning bubble while it works. */
export function Composer({ action, hidden, placeholder, autoFocus }: Props) {
  const [state, run, busy] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const sent = useRef('');

  useEffect(() => {
    if (!busy && !state.error && box.current) box.current.value = '';
  }, [busy, state.error]);

  return (
    <>
      {busy ? (
        <div className="turn">
          <div className="bubble user">{sent.current}</div>
          <div className="bubble planner pending" role="status">
            Reading your request against the instance and planning. This usually takes 1 to 3 minutes.
          </div>
        </div>
      ) : null}
      <form
        ref={form}
        action={(fd) => {
          sent.current = String(fd.get('message') ?? '');
          return run(fd);
        }}
        className="composer"
      >
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <label htmlFor="message" className="sr-only">Message</label>
        <textarea
          id="message"
          ref={box}
          name="message"
          required
          minLength={2}
          maxLength={8000}
          rows={3}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }}
        />
        <div className="composer-bar">
          <span className="muted">Enter to send · Shift+Enter for a new line · nothing is written to Halo</span>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Planning…' : 'Send'}</button>
        </div>
        {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      </form>
    </>
  );
}

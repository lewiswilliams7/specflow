'use client';

import { useState } from 'react';
import { site } from '@/lib/site';

type State = 'idle' | 'sending' | 'sent' | 'error';

export function PilotForm() {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setState('sending');
    setError('');
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch('/api/pilot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong sending your application.');
      setState('sent');
      form.reset();
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong sending your application.');
    }
  }

  if (state === 'sent') {
    return (
      <p className="thanks" role="status">
        Thanks. Your application is in; we&apos;ll be in touch within {site.replyWithin}.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" autoComplete="organization" required maxLength={160} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="builds">Halo implementations a year</label>
          <select id="builds" name="builds" defaultValue="1 to 5">
            <option>1 to 5</option>
            <option>6 to 15</option>
            <option>16 to 40</option>
            <option>More than 40</option>
            <option>We run Halo in-house</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="notes">What would you build first?</label>
        <textarea id="notes" name="notes" maxLength={2000} placeholder="For example: a new starter process with HR and IT approvals" />
      </div>
      {/* Spam trap: people never see or fill this. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      <div>
        <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send application'}
        </button>
      </div>
      {state === 'error' ? (
        <p className="form-note" role="alert">
          {error} Please try again.
        </p>
      ) : (
        <p className="form-note">We&apos;ll reply within {site.replyWithin}.</p>
      )}
    </form>
  );
}

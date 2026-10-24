'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/app/actions';

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submit: string;
  pending: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
};

/** A form wired to a server action, with a pending label and inline success or error messages. */
export function ActionForm({ action, submit, pending, variant = 'primary', size = 'md', className, children }: Props) {
  const [state, run, busy] = useActionState(action, {});
  return (
    <form action={run} className={className}>
      {children}
      <div>
        <button className={`btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''}`} type="submit" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? pending : submit}
        </button>
      </div>
      {state.error ? <p className="notice error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="notice ok" role="status">{state.ok}</p> : null}
    </form>
  );
}

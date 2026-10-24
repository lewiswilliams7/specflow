'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/app/actions';

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submit: string;
  pending: string;
  className?: string;
  children?: React.ReactNode;
};

/** A form wired to a server action, with a pending label and inline success/error messages. */
export function ActionForm({ action, submit, pending, className, children }: Props) {
  const [state, run, busy] = useActionState(action, {});
  return (
    <form action={run} className={className}>
      {children}
      <div className="inline-form">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? pending : submit}
        </button>
      </div>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="thanks" role="status">{state.ok}</p> : null}
    </form>
  );
}

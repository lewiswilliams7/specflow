'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { AuthState } from '@/app/(auth)/actions';

type Props = {
  mode: 'login' | 'signup';
  action: (state: AuthState, form: FormData) => Promise<AuthState>;
  next?: string;
  plan?: string;
};

export function AuthForm({ mode, action, next, plan }: Props) {
  const [state, run, pending] = useActionState(action, {});
  const signup = mode === 'signup';

  if (state.message) {
    return (
      <div className="auth-card">
        <h1>Check your inbox</h1>
        <p>{state.message}</p>
        <Link className="btn btn-ghost" href="/login">Go to sign in</Link>
      </div>
    );
  }

  return (
    <form className="auth-card" action={run}>
      <h1>{signup ? 'Create your account' : 'Sign in'}</h1>
      <p>{signup ? 'Free to connect your Halo and generate plans. No card needed.' : 'Welcome back.'}</p>
      {plan && signup && plan !== 'explore' ? (
        <p className="muted">You’ll start on Explore. Paid plans open with our first pilots.</p>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {signup ? (
        <div className="field">
          <label htmlFor="workspace">Company or team name</label>
          <input id="workspace" name="workspace" autoComplete="organization" maxLength={80} placeholder="Acme IT" />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 10 : undefined} required />
      </div>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
      </button>
      <p className="muted">
        {signup ? (
          <>Already have an account? <Link href="/login">Sign in</Link></>
        ) : (
          <>New here? <Link href="/signup">Create an account</Link></>
        )}
      </p>
    </form>
  );
}

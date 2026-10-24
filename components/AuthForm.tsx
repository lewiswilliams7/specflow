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
        <div>
          <h1>Check your inbox</h1>
          <p className="lead">{state.message}</p>
        </div>
        <Link className="btn btn-secondary btn-block" href="/login">Go to sign in</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div>
        <h1>{signup ? 'Create your account' : 'Sign in'}</h1>
        <p className="lead">{signup ? 'Free to connect your Halo and generate plans. No card needed.' : 'Sign in to your workspace.'}</p>
      </div>
      <form className="card" action={run}>
        {plan && signup && plan !== 'explore' ? <p className="notice info">You’ll start on Explore. Paid plans open with our first pilots.</p> : null}
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
          {signup ? <span className="hint">At least 10 characters.</span> : null}
        </div>
        {state.error ? <p className="notice error" role="alert">{state.error}</p> : null}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? 'Please wait' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="switch">
        {signup ? (
          <>Already have an account? <Link href="/login">Sign in</Link></>
        ) : (
          <>New here? <Link href="/signup">Create an account</Link></>
        )}
      </p>
    </div>
  );
}

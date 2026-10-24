'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

export type AuthState = { error?: string; message?: string };

const safeNext = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.startsWith('/app') ? v : '/app');

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === 'Email not confirmed' ? 'Confirm your email first: check your inbox for the link.' : 'That email and password don’t match an account.' };
  redirect(safeNext(form.get('next')));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const workspace = String(form.get('workspace') ?? '').trim().slice(0, 80);
  if (!email || password.length < 10) return { error: 'Enter your work email and a password of at least 10 characters.' };
  const origin = (await headers()).get('origin') ?? '';
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback`, data: { workspace } },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: `Check ${email} for a link to confirm your account, then sign in.` };
  redirect('/app');
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}

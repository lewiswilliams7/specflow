/**
 * Pilot applications: validate, store in Supabase, email a notification via Resend.
 * Both services are optional so the site works before they're set up: without them, applications are logged.
 * Keys are server-only env vars (see .env.example); nothing secret reaches the browser.
 */
import { NextResponse } from 'next/server';

type Application = { name: string; company: string; email: string; builds: string; notes: string };

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'That request could not be read.' }, { status: 400 });
  }
  // Spam trap: a hidden field people never fill.
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const app: Application = {
    name: clean(body.name, 120),
    company: clean(body.company, 160),
    email: clean(body.email, 200),
    builds: clean(body.builds, 40),
    notes: clean(body.notes, 2000),
  };
  if (!app.name || !app.company || !EMAIL.test(app.email)) {
    return NextResponse.json({ error: 'Please add your name, company and a valid work email.' }, { status: 400 });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, PILOT_NOTIFY_EMAIL, PILOT_FROM_EMAIL } = process.env;
  let stored = false;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pilot_applications`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify(app),
    });
    if (!res.ok) {
      console.error('pilot: Supabase insert failed', res.status, await res.text());
      return NextResponse.json({ error: 'We couldn’t save your application just now.' }, { status: 502 });
    }
    stored = true;
  }

  if (RESEND_API_KEY && PILOT_NOTIFY_EMAIL && PILOT_FROM_EMAIL) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: PILOT_FROM_EMAIL,
        to: PILOT_NOTIFY_EMAIL,
        reply_to: app.email,
        subject: `Pilot application: ${app.company}`,
        text: `Name: ${app.name}\nCompany: ${app.company}\nEmail: ${app.email}\nImplementations a year: ${app.builds}\n\nWhat they'd build first:\n${app.notes || '(not given)'}`,
      }),
    });
    if (!res.ok) console.error('pilot: Resend email failed', res.status, await res.text());
  }

  if (!stored) console.log('pilot application (Supabase not configured):', JSON.stringify(app));
  return NextResponse.json({ ok: true });
}

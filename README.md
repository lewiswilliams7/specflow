# Specflow website and app

Next.js 16 (App Router) on Vercel, Supabase for accounts and data.

- `/` landing page, `/pricing` launch pricing (billing not connected)
- `/signup`, `/login`: Supabase email and password accounts. Each account gets its own workspace on Explore.
- `/app`: connect a Halo instance (secret encrypted), read its configuration, generate a plan and review it.
  **Read-only:** the app has no code that writes to Halo. Building stays in the spike's builder for now.

## Environment variables (Vercel → Project → Settings → Environment Variables)

See `.env.example`. Required for the app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`APP_ENCRYPTION_KEY`, and `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`).

Generate `APP_ENCRYPTION_KEY` once (any terminal with Node):

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Optional for the pilot form: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PILOT_NOTIFY_EMAIL`, `PILOT_FROM_EMAIL`.

## Supabase

Project `specflow` (London). Tables and row level security are in `supabase/migrations` (already applied).
In Supabase → Authentication → URL Configuration, set the Site URL to the Vercel address and add
`https://YOUR-VERCEL-ADDRESS/auth/callback` to Redirect URLs, so confirmation emails come back to the app.

## Long requests

Reading an instance and generating a plan can each take 1 to 3 minutes. The instance page allows 300 seconds,
which needs Vercel's Pro plan (Hobby stops at 60 seconds).

## Renaming

The product name and page promises live in `lib/site.ts`; prices in `lib/pricing.ts`.

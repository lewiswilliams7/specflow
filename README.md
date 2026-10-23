# Specflow website

Landing page and pilot applications. Next.js 16 (App Router), deployed on Vercel.

## Run locally

```
npm install
npm run dev
```

Open http://localhost:3000.

## Pilot form

`app/api/pilot` validates applications, stores them in Supabase and emails you through Resend. Both are optional:
without the keys, applications are written to the server log. Set them in Vercel (Project → Settings → Environment
Variables), using `.env.example` as the list:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: run `supabase/migrations/001_pilot_applications.sql` in the Supabase SQL editor first.
- `RESEND_API_KEY`, `PILOT_NOTIFY_EMAIL` (where applications go), `PILOT_FROM_EMAIL` (a sender on a domain verified in Resend).

## Renaming

The product name and the dates/promises on the page live in `lib/site.ts`.

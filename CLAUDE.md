# Instructions for AI coding tools

Marketing site for Specflow (HaloITSM configuration from plain English). The product itself is built in the
`halo-config-spike` repo for now.

- Copy: British English, no em dashes, "we" not "I", plain words, no claims we haven't proven. Numbers on the page
  (objects built, rule count) must match the spike repo's evidence.
- The product name and page promises live in `lib/site.ts` only.
- Never commit `.env` or keys. Supabase service role and Resend keys are server-only (route handlers).
- Pin dependency versions exactly. Keep `npm audit --omit=dev` clean.
- Run `npm run build` before pushing.

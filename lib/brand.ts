/** A client's branding, kept on their Halo instance: the emails the builder writes (rule EM1) and the sign-off reports. */
import { type EmailBrand, brandProblems } from '@/lib/specflow/build/email-brand';
import { FEATURES, featureReady } from '@/lib/specflow/build/translators';
import type { Plan } from '@/lib/specflow/plan-types';

export type BrandColumns = { brand_name?: string | null; brand_colour?: string | null; brand_logo_url?: string | null; brand_footer?: string | null };

/** True once the trial has shown Halo keeps the branded layout (SPIKE_MAP.emailBrand). Until then emails go out plain. */
export const brandingLive = () => featureReady(FEATURES.find((f) => f.key === 'email_branding')!);

/** The instance's brand, or null when it has no colour set. */
export function brandOf(w: BrandColumns | null | undefined): EmailBrand | null {
  if (!w?.brand_colour) return null;
  const b: EmailBrand = { colour: w.brand_colour, name: w.brand_name ?? undefined, logo_url: w.brand_logo_url ?? undefined, footer: w.brand_footer ?? undefined };
  return brandProblems(b).length ? null : b;
}

/**
 * The plan as the builder should run it: every email template carries the client's brand when branding is live,
 * and never a brand the planner wrote.
 */
export function withBrand(plan: Plan, brand: EmailBrand | null): Plan {
  const live = brand && brandingLive() ? brand : null;
  return {
    ...plan,
    steps: plan.steps.map((s) => {
      if (s.object !== 'email_template') return s;
      const { brand: _ignored, ...rest } = s;
      return live ? { ...rest, brand: live } : rest;
    }),
  };
}

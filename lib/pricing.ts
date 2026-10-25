/** Launch prices agreed by the board on 24 Oct 2026. Hypotheses until 3 partners pay them. Billing not connected yet. */
export type Plan = {
  id: 'explore' | 'solo' | 'team' | 'partner';
  name: string;
  price: string;
  per: string;
  annual?: string;
  summary: string;
  limits: { instances: number | null; users: number | null; plansPerMonth: number | null; builds: boolean };
  features: string[];
  cta: string;
  highlight?: boolean;
};

export const plans: Plan[] = [
  {
    id: 'explore',
    name: 'Explore',
    price: '£0',
    per: 'free',
    summary: 'See what it would build in your Halo before you pay anything.',
    limits: { instances: 1, users: 1, plansPerMonth: 10, builds: false },
    features: ['1 connected Halo instance', 'Reads your configuration', '10 plans a month', 'Plan review: what exists, what it would build, what it can’t do'],
    cta: 'Start free',
  },
  {
    id: 'solo',
    name: 'Solo',
    price: '£149',
    per: 'a month',
    annual: '£1,490 a year (2 months free)',
    summary: 'For one Halo admin or consultant, with a test and a live instance.',
    limits: { instances: 2, users: 1, plansPerMonth: null, builds: true },
    features: ['2 Halo instances: test and live', 'Unlimited plans', 'Builds with preview, checks and audit log', 'Emails and sign-off reports in the client’s brand', 'Changes to existing configuration'],
    cta: 'Start with Solo',
  },
  {
    id: 'team',
    name: 'Team',
    price: '£499',
    per: 'a month',
    annual: '£4,990 a year (2 months free)',
    summary: 'For a team or a small partner running several client instances.',
    limits: { instances: 5, users: 5, plansPerMonth: null, builds: true },
    features: ['5 Halo instances, swap them as clients change', 'A brand per client instance', '5 users in a shared workspace', 'Build packs: your standard build, reused', 'Everything in Solo'],
    cta: 'Start with Team',
    highlight: true,
  },
  {
    id: 'partner',
    name: 'Partner',
    price: '£1,250+',
    per: 'a month',
    summary: 'For Halo partners running implementations at scale.',
    limits: { instances: null, users: null, plansPerMonth: null, builds: true },
    features: ['Unlimited instances and users', 'Single sign-on', 'Priority support', 'Everything in Team'],
    cta: 'Talk to us',
  },
];

export const foundingOffer = '50% off for 12 months for our first 10 partners, in return for feedback and a case study.';

/** The product name lives here only, so a rename is a one-line change. */
export const site = {
  name: 'Enact',
  wordmark: 'enact',
  tagline: "Your client's design, built in their Halo.",
  description:
    'Enact builds HaloITSM configuration from a brief or a form design spreadsheet. You review the plan, then it builds and checks every change.',
  pilotStart: 'December 2026',
  replyWithin: 'two working days',
  company: 'the team behind Handover',
  location: 'Birmingham, UK',
  /** Proof numbers on the site. Must match the spike repo's evidence (HALO_RULES.md rows, NOTES.md 19 Oct run). */
  proof: { objectsInOneRun: 47, rules: 124, deletes: 0, exampleRunDate: '19 October 2026' },
  /**
   * Proof from real implementation work, shown on the homepage when set. Off until Lewis has cleared using it publicly
   * (employer and client). Never name the client. Example: { forms: 6, note: 'service request forms built on a customer instance during a live implementation' }.
   */
  liveProof: null as { forms: number; note: string } | null,
};

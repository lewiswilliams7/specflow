/**
 * Founder-only tools. Learning rounds make "zz Enact sample" records, so they only ever run on Lewis's own Halo trial
 * (spike CLAUDE.md: never an employer or client instance). Both locks are checked on the server.
 */
export const ADMIN_EMAILS = ['lewis@alliedesm.com', 'lewis@gethandover.uk'];
export const TRIAL_HOSTS = ['gethandoveruk.haloitsm.com'];

export const isAdmin = (email?: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());
export const isTrial = (baseUrl: string) => {
  try {
    return TRIAL_HOSTS.includes(new URL(baseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
};

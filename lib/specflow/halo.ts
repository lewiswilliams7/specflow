/**
 * READ-ONLY Halo client for the app. There is deliberately no write method here: the app connects,
 * reads configuration and plans. Building stays in the builder until it ships with its safety gates.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type HaloConnection = { baseUrl: string; tenant: string; clientId: string; clientSecret: string };
export type HaloReader = { get: <T = unknown>(path: string, params?: Record<string, string>) => Promise<T> };

/** https://yourco.haloitsm.com/anything → https://yourco.haloitsm.com */
export function normaliseBaseUrl(input: string): string {
  const raw = input.trim().match(/^https?:\/\//i) ? input.trim() : `https://${input.trim()}`;
  const u = new URL(raw);
  return `https://${u.host}`;
}

const PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd]/i, /^fe80/i];

/**
 * The server calls whatever address a user enters, so only public https hosts are allowed:
 * no IP addresses, no localhost, nothing that resolves to a private network.
 */
export async function assertPublicHost(baseUrl: string): Promise<void> {
  const u = new URL(baseUrl);
  if (u.protocol !== 'https:') throw new Error('Use your Halo address starting https://');
  const host = u.hostname.toLowerCase();
  if (isIP(host) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) {
    throw new Error('Use your Halo web address (for example yourco.haloitsm.com), not an IP or internal name.');
  }
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`Couldn't find ${host}. Check the address.`);
  if (addrs.some((a) => PRIVATE.some((re) => re.test(a.address)))) throw new Error('That address points to a private network.');
}

const RETRY = new Set([429, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function haloReader(conn: HaloConnection): HaloReader & { token: () => Promise<string> } {
  let cached: { token: string; expiresAt: number } | null = null;

  async function token(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
    const q = conn.tenant ? `?tenant=${encodeURIComponent(conn.tenant)}` : '';
    const ask = (scope: string) =>
      fetch(`${conn.baseUrl}/auth/token${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: conn.clientId, client_secret: conn.clientSecret, scope }),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    // Ask for everything the API application allows; an application set to read-only may refuse "all", so fall back.
    let res = await ask('all');
    if (res.status === 400) res = await ask('read:all');
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) throw new Error('Halo rejected the client ID or secret. Check them in Halo: Configuration → Integrations → Halo API.');
      throw new Error(`Halo sign-in failed (${res.status}).`);
    }
    const raw = JSON.parse(text) as Record<string, unknown>;
    const expiresIn = typeof raw.expires_in === 'number' ? raw.expires_in : 3600;
    cached = { token: String(raw.access_token), expiresAt: Date.now() + expiresIn * 1000 };
    return cached.token;
  }

  async function get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${conn.baseUrl}/api${path.startsWith('/') ? path : `/${path}`}`);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    // Rule R1 (24 Oct): Halo answers 504/429/502/503 under load (seen on the first in-app read, Workflow/9).
    // Reads are safe to repeat, so retry with back-off, honouring Retry-After.
    for (let attempt = 1; ; attempt++) {
      let res: Response | null = null;
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(45_000),
        });
      } catch (e) {
        if (attempt >= 4) throw new Error(`Halo didn't answer GET ${url.pathname} after ${attempt} tries.`);
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      if (res.ok) return (text ? JSON.parse(text) : null) as T;
      if (RETRY.has(res.status) && attempt < 4) {
        const after = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 20) * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`Halo GET ${url.pathname} failed (${res.status}${RETRY.has(res.status) ? ` after ${attempt} tries: Halo is busy, try again in a minute` : ''})`);
    }
  }

  return { get, token };
}

/** Halo list endpoints return either an array or an object wrapping one. Find the array. */
export function extractList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') for (const v of Object.values(data)) if (Array.isArray(v)) return v as Record<string, unknown>[];
  return [];
}

export function firstRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return null;
}

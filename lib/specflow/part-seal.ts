/**
 * M14: a form planned in its own request comes back to the browser and is sent on with the message. The seal proves
 * the server made it for this instance, so a plan can't be written by hand and passed off as the planner's.
 * Server only.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Plan } from './plan-types';

const key = () => {
  const k = process.env.APP_ENCRYPTION_KEY;
  if (!k) throw new Error('APP_ENCRYPTION_KEY is not set.');
  return `enact-plan-part:${k}`;
};

export function sealPart(instanceId: string, title: string, plan: Plan | null): string {
  return createHmac('sha256', key()).update(JSON.stringify([instanceId, title, plan])).digest('hex');
}

export function partIsSealed(instanceId: string, title: string, plan: Plan | null, seal: string): boolean {
  const want = Buffer.from(sealPart(instanceId, title, plan), 'hex');
  const got = Buffer.from(String(seal ?? ''), 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

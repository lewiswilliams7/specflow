import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Readable function names in server errors (a planning fault reports where it happened).
  experimental: { serverMinification: false },
  // Saved plan parts are keyed by the build, so a planner change never reuses parts planned by the old one.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
};

export default nextConfig;

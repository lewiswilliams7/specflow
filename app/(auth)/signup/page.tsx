import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { SiteHeader } from '@/components/SiteChrome';
import { site } from '@/lib/site';
import { signUp } from '../actions';

export const metadata: Metadata = { title: `Create account · ${site.name}` };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="wrap auth">
        <AuthForm mode="signup" action={signUp} plan={plan} />
      </main>
    </>
  );
}

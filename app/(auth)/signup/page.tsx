import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { Brand } from '@/components/SiteChrome';
import { site } from '@/lib/site';
import { signUp } from '../actions';

export const metadata: Metadata = { title: `Create account · ${site.name}` };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <div className="auth-page">
      <header className="site-header"><div className="wrap"><Brand /></div></header>
      <main className="auth">
        <AuthForm mode="signup" action={signUp} plan={plan} />
      </main>
    </div>
  );
}

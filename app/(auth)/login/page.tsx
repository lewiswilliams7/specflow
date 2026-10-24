import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { Brand } from '@/components/SiteChrome';
import { site } from '@/lib/site';
import { signIn } from '../actions';

export const metadata: Metadata = { title: `Sign in · ${site.name}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="auth-page">
      <header className="site-header"><div className="wrap"><Brand /></div></header>
      <main className="auth">
        <AuthForm mode="login" action={signIn} next={next} />
      </main>
    </div>
  );
}

import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { SiteHeader } from '@/components/SiteChrome';
import { site } from '@/lib/site';
import { signIn } from '../actions';

export const metadata: Metadata = { title: `Sign in · ${site.name}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="wrap auth">
        <AuthForm mode="login" action={signIn} next={next} />
      </main>
    </>
  );
}

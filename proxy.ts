/** Keeps the Supabase session fresh and sends signed-out visitors from /app to /login. */
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export default async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  if (!user && path.startsWith('/app')) {
    const to = new URL('/login', req.url);
    to.searchParams.set('next', path);
    return NextResponse.redirect(to);
  }
  if (user && (path === '/login' || path === '/signup')) return NextResponse.redirect(new URL('/app', req.url));
  return res;
}

export const config = { matcher: ['/app/:path*', '/login', '/signup'] };

import type { Database } from '@petsitter/shared/database';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

// Refreshes the Supabase session cookie on every request and sends signed-out
// visitors to /sign-in. Admin-only access is checked in app/(admin)/layout.tsx;
// RLS is the real boundary.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Validates the token with Supabase Auth (getSession alone trusts the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSignIn = request.nextUrl.pathname.startsWith('/sign-in');
  if (!user && !isSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (user && isSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

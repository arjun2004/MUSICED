import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";
import { serverRealtimeOptions } from "@/lib/supabase/realtime-transport";

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = ["/onboarding", "/settings", "/diary", "/notifications", "/lists/new", "/admin"];

/** Protected routes with dynamic segments. */
const PROTECTED_PATTERNS = [/^\/list\/[^/]+\/edit\/?$/];

/** Auth pages a signed-in user should not see. */
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtected(pathname: string) {
  return matches(pathname, PROTECTED_PREFIXES) || PROTECTED_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Refreshes the Supabase session cookie on every request and performs coarse
 * route gating. This is a UX optimisation only: every protected page and
 * server action re-verifies the user on the server, close to the data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      realtime: serverRealtimeOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Prevent CDNs from caching responses that set auth cookies.
          for (const [key, value] of Object.entries(headers ?? {})) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it must be the
  // first call so an expired access token is refreshed before anything else.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  if (isSignedIn && matches(pathname, GUEST_ONLY)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** Redirect while preserving any refreshed session cookies. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

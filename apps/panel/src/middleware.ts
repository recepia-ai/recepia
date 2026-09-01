import type { Database } from "@recepia/db";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const SESSION_ROUTING_TIMEOUT_MS = 1_500;

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthCallback = pathname.startsWith("/auth");
  const bypassesUserAuth =
    isAuthCallback ||
    pathname === "/privacidad" ||
    pathname === "/terminos" ||
    pathname === "/aviso-legal" ||
    pathname === "/eliminacion-de-datos" ||
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/api/channels/") ||
    pathname.startsWith("/api/test-agent");

  // Webhooks and public routes must never depend on the dashboard session.
  // In particular, a temporary Auth outage must not stop inbound WhatsApp events.
  if (bypassesUserAuth) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Middleware only needs a routing hint. Authorisation remains enforced by
  // server-side getUser() checks and Supabase RLS on every protected resource.
  // getSession() normally reads the cookie locally, avoiding an Auth network
  // request from Vercel Edge on every navigation.
  const sessionResult = await Promise.race([
    supabase.auth.getSession().then((result) => ({ kind: "result" as const, result })),
    new Promise<{ kind: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ kind: "timeout" }), SESSION_ROUTING_TIMEOUT_MS),
    ),
  ]);

  if (sessionResult.kind === "timeout") {
    console.warn(
      `[middleware] Session routing check exceeded ${SESSION_ROUTING_TIMEOUT_MS}ms; deferring verification to the server`,
    );
    return response;
  }

  const { data: sessionData, error: sessionError } = sessionResult.result;
  const isAuthenticated = Boolean(sessionData.session?.access_token);

  const isLoginRoute = pathname.startsWith("/login");

  if (sessionError) {
    console.warn("[middleware] Session cookie could not be read", { name: sessionError.name });
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // No autenticado + ruta protegida → login
  if (!isAuthenticated && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Autenticado en /login → home
  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estáticos
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

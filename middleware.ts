import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_HOST = "app.fyp.nathanielsinnott.com";
const MARKETING_HOST = "fyp.nathanielsinnott.com";

// Allow local dev to use a single host without rewrites.
function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const pathname = url.pathname;

  // Skip host-based routing on localhost.
  if (isLocalHost(hostname)) {
    return NextResponse.next();
  }

  // App subdomain should land under /app routes.
  if (hostname === APP_HOST) {
    if (pathname === "/") {
      url.pathname = "/app";
      return NextResponse.rewrite(url);
    }

    if (pathname === "/login") {
      url.pathname = "/app/login";
      return NextResponse.rewrite(url);
    }

    if (pathname === "/admin") {
      url.pathname = "/app/admin";
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // Marketing domain should redirect protected paths to the app subdomain.
  if (hostname === MARKETING_HOST) {
    if (
      pathname === "/login" ||
      pathname === "/admin" ||
      pathname.startsWith("/app")
    ) {
      url.hostname = APP_HOST;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};

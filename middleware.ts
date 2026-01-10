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

  // App subdomain serves all protected routes directly.
  if (hostname === APP_HOST) {
    url.hostname = APP_HOST;
    if (pathname === "/") {
      url.pathname = "/app";
    } else if (pathname === "/login") {
      url.pathname = "/app/login";
    } else if (pathname === "/admin") {
      url.pathname = "/app/admin";
    }
    return NextResponse.rewrite(url);
  }

  // Marketing domain should only serve the public landing page.
  if (hostname === MARKETING_HOST) {
    if (pathname !== "/") {
      url.hostname = APP_HOST;
      if (pathname === "/login") {
        url.pathname = "/app/login";
      } else if (pathname === "/admin") {
        url.pathname = "/app/admin";
      } else if (pathname.startsWith("/app")) {
        url.pathname = pathname;
      } else {
        url.pathname = `/app${pathname}`;
      }
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};

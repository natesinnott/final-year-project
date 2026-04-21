"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/app/invite", "/app/login", "/app/onboarding"];

export default function DashboardShortcut() {
  const pathname = usePathname();
  const hideForProductionSubnav =
    pathname?.startsWith("/app/productions/") &&
    (pathname.includes("/availability") ||
      pathname.includes("/schedule") ||
      pathname.includes("/rehearsals") ||
      pathname.includes("/attendance/"));

  if (
    !pathname ||
    pathname === "/app" ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    hideForProductionSubnav
  ) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl justify-end">
        <Link
          href="/app"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}

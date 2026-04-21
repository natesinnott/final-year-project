"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ProductionNavProps = {
  productionId: string;
  canAccessScheduling?: boolean;
  canAccessToday?: boolean;
  canAccessAttendance?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  isActive: boolean;
};

export default function ProductionNav({
  productionId,
  canAccessScheduling = false,
  canAccessToday = false,
  canAccessAttendance = false,
}: ProductionNavProps) {
  const pathname = usePathname();
  const basePath = `/app/productions/${productionId}`;
  const dashboardHref = `/app?productionId=${productionId}`;
  const conflictsHref = `${basePath}/availability`;
  const teamConflictsHref = `${basePath}/availability/team`;
  const rehearsalsHref = `${basePath}/rehearsals`;
  const todayHref = `${basePath}/attendance/today`;
  const attendanceHref = `${basePath}/attendance/report`;

  const items: NavItem[] = [
    {
      href: dashboardHref,
      label: "Dashboard",
      isActive: false,
    },
    ...(canAccessScheduling
      ? [
          {
            href: `${basePath}/schedule`,
            label: "Scheduling",
            isActive: pathname === `${basePath}/schedule`,
          },
        ]
      : []),
    {
      href: conflictsHref,
      label: "Conflicts",
      isActive: pathname === conflictsHref,
    },
    ...(canAccessScheduling
      ? [
          {
            href: teamConflictsHref,
            label: "Cast & Crew Conflicts",
            isActive: pathname === teamConflictsHref,
          },
        ]
      : []),
    {
      href: rehearsalsHref,
      label: "Rehearsals",
      isActive:
        pathname === rehearsalsHref || pathname.startsWith(`${rehearsalsHref}/`),
    },
    ...(canAccessToday
      ? [
          {
            href: todayHref,
            label: "Today",
            isActive: pathname === todayHref,
          },
        ]
      : []),
    ...(canAccessAttendance
      ? [
          {
            href: attendanceHref,
            label: "Attendance",
            isActive: pathname === attendanceHref,
          },
        ]
      : []),
  ];

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Production navigation"
      className="-mt-2 overflow-x-auto pb-1"
    >
      <div className="flex min-w-max flex-wrap gap-2">
        {items.map((item) => {
          const activeClasses = item.isActive
            ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
            : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-slate-100";

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${activeClasses}`}
            >
              {item.label === "Dashboard" ? (
                <span aria-hidden="true" className="mr-2">
                  ←
                </span>
              ) : null}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

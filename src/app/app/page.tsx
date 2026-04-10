import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityCompleteness } from "@/lib/availability";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SignOutButton from "../sign-out-button";
import AnnouncementsPanel from "./announcements-panel";
import FilesPanel from "./files-panel";
import UpcomingRehearsalsPanel from "./upcoming-rehearsals-panel";
import ProductionSwitcher from "./production-switcher";
import { isAppAdminEmail } from "@/lib/app-admin";
import {
  countVisibleRehearsalsThisWeek,
  getVisibleUpcomingRehearsals,
} from "@/lib/rehearsals";

export const metadata = {
  title: "StageSuite | Dashboard",
};

const PRODUCTION_ROLES = [
  "DIRECTOR",
  "STAGE_MANAGER",
  "CHOREOGRAPHER",
  "MUSIC_DIRECTOR",
  "CAST",
  "CREW",
  "VIEWER",
];

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];
const ANNOUNCEMENT_ROLES = new Set(["DIRECTOR", "STAGE_MANAGER"]);

type DashboardLink = {
  href: string;
  label: string;
  description: string;
};

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ productionId?: string | string[] }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user?.id;
  if (!userId) {
    redirect("/login");
  }

  const isAppAdmin = isAppAdminEmail(session.user?.email);
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { organisation: true },
  });

  if (!membership) {
    redirect("/app/onboarding");
  }

  const organisationId = membership.organisationId;
  const productionMemberships = await prisma.productionMember.findMany({
    where: { userId, production: { organisationId } },
    include: { production: true },
    orderBy: { createdAt: "asc" },
  });

  if (productionMemberships.length === 0) {
    if (membership.role === "ADMIN") {
      redirect("/app/productions/new");
    }
    redirect("/app/productions");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedProductionId = Array.isArray(resolvedSearchParams?.productionId)
    ? resolvedSearchParams?.productionId[0]
    : resolvedSearchParams?.productionId;
  const productionMembership =
    productionMemberships.find(
      (entry) => entry.productionId === selectedProductionId
    ) ?? productionMemberships[0];

  const production = productionMembership.production;
  const productionId = production.id;
  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;
  const canManageProduction =
    membership.role === "ADMIN" || directorRoles.includes(productionMembership.role);
  const canAccessScheduling = directorRoles.includes(productionMembership.role);
  const canPostAnnouncement =
    membership.role === "ADMIN" || ANNOUNCEMENT_ROLES.has(productionMembership.role);

  const announcements = await prisma.announcement.findMany({
    where:
      membership.role === "ADMIN"
        ? { organisationId, productionId }
        : {
            organisationId,
            productionId,
            OR: [
              { visibleToRoles: { isEmpty: true } },
              { visibleToRoles: { has: productionMembership.role } },
            ],
          },
    include: {
      createdBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const files = await prisma.fileAsset.findMany({
    where: { organisationId, productionId },
    include: {
      uploadedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  const visibleFiles =
    membership.role === "ADMIN"
      ? files
      : files.filter(
          (file) =>
            file.visibleToRoles.length === 0 ||
            file.visibleToRoles.includes(productionMembership.role)
        );

  const [upcomingRehearsals, rehearsalsThisWeek] = await Promise.all([
    getVisibleUpcomingRehearsals({
      productionId,
      userId,
      canViewAll: canAccessScheduling,
      limit: 5,
    }),
    countVisibleRehearsalsThisWeek({
      productionId,
      userId,
      canViewAll: canAccessScheduling,
    }),
  ]);

  const tasks = [
    {
      title: "Submit conflicts for Week 4",
      due: "Due in 2 days",
    },
    {
      title: "Review updated scene breakdown",
      due: "Due in 4 days",
    },
    {
      title: "Confirm costume fitting slot",
      due: "Due next week",
    },
  ];

  const productionSnapshot = [
    {
      label: "Production",
      value: production.name,
    },
    {
      label: "Next performance",
      value: "May 17, 7:30pm",
    },
    {
      label: "Rehearsals this week",
      value: `${rehearsalsThisWeek} scheduled`,
    },
    {
      label: "Attendance flagged",
      value: "2 absences",
    },
  ];
  const hasMultipleProductions = productionMemberships.length > 1;
  const organisationName =
    membership.organisation?.name ?? "No organisation selected";
  const organisationRoleLabel = formatEnumLabel(membership.role ?? "MEMBER");
  const productionRoleLabel = formatEnumLabel(productionMembership.role);
  const accessibleProductions = productionMemberships.map((entry) => ({
    id: entry.productionId,
    name: entry.production.name,
  }));
  const productionWorkspaceLinks: DashboardLink[] = [
    {
      href: `/app/productions/${productionId}/availability`,
      label: "My conflicts",
      description: "Share when you are unavailable for rehearsals.",
    },
    {
      href: `/app/productions/${productionId}/rehearsals`,
      label: "Rehearsals",
      description: "See the published rehearsal plan for this production.",
    },
    canAccessScheduling
      ? {
          href: `/app/productions/${productionId}/availability/team`,
          label: "Cast & crew conflicts",
          description: "Review submitted conflicts and follow up on missing responses.",
        }
      : null,
    canAccessScheduling
      ? {
          href: `/app/productions/${productionId}/schedule`,
          label: "Scheduling",
          description: "Build, review, and publish rehearsal blocks.",
        }
      : null,
    canManageProduction
      ? {
          href: `/app/productions/${productionId}/settings`,
          label: "Production settings",
          description: "Manage members, permissions, and production details.",
        }
      : null,
  ].filter((link): link is DashboardLink => Boolean(link));

  const availabilityCompleteness = canAccessScheduling
    ? await getAvailabilityCompleteness(productionId)
    : null;

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-5 text-slate-100 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                StageSuite
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Welcome back, {session.user?.name ?? "artist"}.
              </h1>
              {hasMultipleProductions ? (
                <p className="mt-2 text-sm text-slate-300">
                  Signed in to {organisationName} as {organisationRoleLabel}.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-1 text-sm text-slate-300">
                  <p>Signed in to {organisationName}.</p>
                  <p>
                    Working in {production.name} as {productionRoleLabel}.
                  </p>
                  {production.venue ? (
                    <p className="text-slate-400">{production.venue}</p>
                  ) : null}
                </div>
              )}
              {session.user?.email ? (
                <p className="mt-1 text-sm text-slate-400">{session.user.email}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {isAppAdmin ? (
                <Link
                  href="/app/super-admin/organisations"
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                >
                  App Admin
                </Link>
              ) : null}
              {membership.role === "ADMIN" ? (
                <>
                  <Link
                    href="/app/organisation/settings"
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Org Settings
                  </Link>
                  <Link
                    href="/app/productions/new"
                    className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                  >
                    Create Production
                  </Link>
                </>
              ) : null}
              <SignOutButton />
            </div>
          </div>
        </header>

        {hasMultipleProductions ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                Current production
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-white">{production.name}</h2>
                  <p className="text-sm text-slate-300">
                    {production.venue ?? "Venue to be confirmed"}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Your production role: {productionRoleLabel}
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm sm:p-5">
              <div>
                <ProductionSwitcher
                  currentProductionId={productionId}
                  productions={accessibleProductions}
                />
              </div>
            </section>
          </section>
        ) : null}

        <nav
          aria-label="Production tools"
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Production tools
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
              {productionWorkspaceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-slate-700/70 bg-slate-950/30 px-4 py-3 text-left transition hover:border-slate-500"
                >
                  <span className="block text-sm font-semibold text-slate-100">
                    {link.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                    {link.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {productionSnapshot.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-4 py-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {item.label}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-100">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="grid gap-6">
            <UpcomingRehearsalsPanel
              productionId={productionId}
              rehearsals={upcomingRehearsals.map((rehearsal) => ({
                id: rehearsal.id,
                title: rehearsal.title,
                startsAt: rehearsal.start.toISOString(),
                location: production.venue ?? "Default room",
              }))}
            />

            <AnnouncementsPanel
              organisationId={organisationId}
              productionId={productionId}
              productionRoles={PRODUCTION_ROLES}
              canPost={canPostAnnouncement}
              announcements={announcements.map((announcement) => ({
                id: announcement.id,
                title: announcement.title,
                body: announcement.body,
                createdAt: announcement.createdAt.toISOString(),
                createdByName: announcement.createdBy.name,
              }))}
            />
          </div>

          <div className="grid gap-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Your tasks</h2>
                <span className="text-xs text-slate-400">Static sample</span>
              </div>
              <div className="mt-4 grid gap-3">
                {tasks.map((task) => (
                  <div
                    key={task.title}
                    className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4"
                  >
                    <div className="font-medium text-white">{task.title}</div>
                    <div className="text-xs text-slate-400">{task.due}</div>
                  </div>
                ))}
              </div>
            </section>

            <FilesPanel
              organisationId={organisationId}
              productionId={productionId}
              productionRoles={PRODUCTION_ROLES}
              canUpload
              files={visibleFiles.map((file) => ({
                id: file.id,
                originalName: file.originalName,
                size: file.size,
                mimeType: file.mimeType,
                createdAt: file.createdAt.toISOString(),
                uploadedByName: file.uploadedBy.name,
              }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Conflict submission snapshot</h2>
            <span className="text-xs text-slate-400">Static sample</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Cast</div>
              <div className="mt-1 text-xl font-semibold text-white">18</div>
              <div className="text-xs text-slate-400">confirmed this week</div>
            </div>
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Crew</div>
              <div className="mt-1 text-xl font-semibold text-white">7</div>
              <div className="text-xs text-slate-400">pending responses</div>
            </div>
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Absences</div>
              <div className="mt-1 text-xl font-semibold text-white">2</div>
              <div className="text-xs text-slate-400">reported this week</div>
            </div>
          </div>

          {availabilityCompleteness ? (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 px-4 py-3 text-sm text-slate-300">
              {availabilityCompleteness.missingMembers.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {availabilityCompleteness.missingMembers.length} people haven&apos;t submitted
                    conflicts.
                  </span>
                  <Link
                    href={`/app/productions/${productionId}/availability/team`}
                    className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-400"
                  >
                    Review cast &amp; crew conflicts
                  </Link>
                </div>
              ) : (
                <span>All required members have submitted conflicts.</span>
              )}
            </div>
          ) : (
            <div className="mt-4 text-xs text-slate-500">
              {/* TODO: Replace with live missing-conflicts callout for non-director roles if needed. */}
              Missing-submission callout is shown for scheduling roles.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

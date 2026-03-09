import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityCompleteness } from "@/lib/availability";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SignOutButton from "../sign-out-button";
import AnnouncementsPanel from "./announcements-panel";
import FilesPanel from "./files-panel";
import UpcomingRehearsalsPanel from "./upcoming-rehearsals-panel";
import { isAppAdminEmail } from "@/lib/app-admin";

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
  const isAppAdmin = isAppAdminEmail(session.user?.email);
  const membership = userId
    ? await prisma.membership.findFirst({
        where: { userId },
        include: { organisation: true },
      })
    : null;

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

  const upcomingRehearsals = [
    {
      id: "sample-act-1-blocking",
      title: "Act 1 Blocking",
      startsAt: "2026-03-05T19:00:00.000Z",
      location: "Studio A",
    },
    {
      id: "sample-dance-call",
      title: "Dance Call",
      startsAt: "2026-03-07T18:30:00.000Z",
      location: "Main Stage",
    },
    {
      id: "sample-full-cast-run",
      title: "Full Cast Run",
      startsAt: "2026-03-10T14:00:00.000Z",
      location: "Main Stage",
    },
  ];

  const tasks = [
    {
      title: "Submit availability for Week 4",
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
      value: "4 scheduled",
    },
    {
      label: "Attendance flagged",
      value: "2 absences",
    },
  ];

  const availabilityCompleteness = canAccessScheduling
    ? await getAvailabilityCompleteness(productionId)
    : null;

  return (
    <main className="min-h-dvh bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                StageSuite
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">
                Welcome back, {session.user?.name ?? "artist"}.
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {membership?.organisation?.name ?? "No organisation selected"} ·{" "}
                {membership?.role ?? "Member"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAppAdmin ? (
                <a
                  href="/app/super-admin/organisations"
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  App Admin
                </a>
              ) : null}
              {membership?.role === "ADMIN" ? (
                <>
                  <a
                    href="/app/organisation/settings"
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                  >
                    Org Settings
                  </a>
                  <a
                    href="/app/productions/new"
                    className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950"
                  >
                    Create Production
                  </a>
                </>
              ) : null}
              <SignOutButton />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Current production
              </div>
              <div className="text-sm font-semibold text-white">{production.name}</div>
              <div className="text-xs text-slate-300">
                {production.venue ?? "Venue TBC"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action="/app" method="get" className="flex items-center gap-2">
                <select
                  name="productionId"
                  defaultValue={productionId}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                >
                  {productionMemberships.map((entry) => (
                    <option key={entry.productionId} value={entry.productionId}>
                      {entry.production.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Switch
                </button>
              </form>
              {canManageProduction ? (
                <a
                  href={`/app/productions/${productionId}/settings`}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Settings
                </a>
              ) : null}
              <a
                href={`/app/productions/${productionId}/availability`}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Availability
              </a>
              {canAccessScheduling ? (
                <a
                  href={`/app/productions/${productionId}/availability/team`}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Team Availability
                </a>
              ) : null}
              {canAccessScheduling ? (
                <a
                  href={`/app/productions/${productionId}/schedule`}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Scheduling
                </a>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {productionSnapshot.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-700/70 bg-slate-900/40 px-3 py-2"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {item.label}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-100">{item.value}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="grid gap-6">
            <UpcomingRehearsalsPanel
              productionId={productionId}
              rehearsals={upcomingRehearsals}
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
            <h2 className="text-base font-semibold text-white">Availability snapshot</h2>
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
                    availability.
                  </span>
                  <a
                    href={`/app/productions/${productionId}/availability/team`}
                    className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-400"
                  >
                    Open Team Availability
                  </a>
                </div>
              ) : (
                <span>All required members have submitted availability.</span>
              )}
            </div>
          ) : (
            <div className="mt-4 text-xs text-slate-500">
              {/* TODO: Replace with live missing-availability callout for non-director roles if needed. */}
              Missing-submission callout is shown for scheduling roles.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

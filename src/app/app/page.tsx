import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SignOutButton from "../sign-out-button";
import AnnouncementComposer from "./announcement-composer";
import FileUploadCard from "./file-upload-card";

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
  // Resolve the user's organisation membership (first org for now).
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
  // Load all production memberships to populate the production picker.
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
  // Select the production from query params or fall back to the first membership.
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
  // Admins or director-roles can manage production settings.
  const canManageProduction =
    membership.role === "ADMIN" || directorRoles.includes(productionMembership.role);
  const canPostAnnouncement =
    membership.role === "ADMIN" || ANNOUNCEMENT_ROLES.has(productionMembership.role);

  const announcements = await prisma.announcement.findMany({
    where: { organisationId, productionId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const files = await prisma.fileAsset.findMany({
    where: { organisationId, productionId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Placeholder data for the demo until scheduling is implemented.
  const upcomingRehearsals = [
    {
      title: "Act 1 Blocking",
      date: "Mon 7:00pm",
      location: "Studio A",
    },
    {
      title: "Dance Call",
      date: "Wed 6:30pm",
      location: "Main Stage",
    },
    {
      title: "Full Cast Run",
      date: "Sat 2:00pm",
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

  const tools = [
    "Generate rehearsal schedule",
    "Post announcement",
    "Upload files",
    "Track attendance",
  ];

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
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
            <SignOutButton />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Current production
              </div>
              <div className="text-sm font-semibold text-white">
                {production.name}
              </div>
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
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {productionSnapshot.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  {item.label}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Upcoming rehearsals
              </h2>
              <span className="text-xs text-slate-400">Static sample</span>
            </div>
            <div className="mt-4 grid gap-4">
              {upcomingRehearsals.map((rehearsal) => (
                <div
                  key={rehearsal.title}
                  className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 p-4"
                >
                  <div>
                    <div className="font-medium text-white">
                      {rehearsal.title}
                    </div>
                    <div className="text-sm text-slate-400">
                      {rehearsal.location}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-200">
                    {rehearsal.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Your tasks
              </h2>
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
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Announcements
              </h2>
              <span className="text-xs text-slate-400">Live data</span>
            </div>
            <AnnouncementComposer
              organisationId={organisationId}
              productionId={productionId}
              productionRoles={PRODUCTION_ROLES}
              canPost={canPostAnnouncement}
            />
            <div className="mt-4 grid gap-4">
              {announcements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-400">
                  No announcements yet. When directors or stage managers post
                  updates, they will appear here.
                </div>
              ) : (
                announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4"
                  >
                    <div className="font-medium text-white">
                      {announcement.title}
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {announcement.body}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {announcement.createdAt.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Files</h2>
              <span className="text-xs text-slate-400">Live data</span>
            </div>
            <FileUploadCard
              organisationId={organisationId}
              productionId={productionId}
              productionRoles={PRODUCTION_ROLES}
            />
            <div className="mt-4 grid gap-4">
              {files.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-400">
                  No files uploaded yet. Choreography, music, and blocking files
                  will show up here.
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/40 p-4"
                  >
                    <div>
                      <div className="font-medium text-white">
                        {file.originalName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {Math.round(file.size / 1024)} KB · {file.mimeType}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {file.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-white">Quick tools</h2>
            <div className="mt-4 grid gap-3">
              {tools.map((tool) => (
                <div
                  key={tool}
                  className="rounded-xl border border-slate-800/70 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
                >
                  {tool}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Availability snapshot
              </h2>
              <span className="text-xs text-slate-400">Static sample</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Cast
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  18
                </div>
                <div className="text-xs text-slate-400">confirmed this week</div>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Crew
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  7
                </div>
                <div className="text-xs text-slate-400">pending responses</div>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Absences
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  2
                </div>
                <div className="text-xs text-slate-400">reported this week</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

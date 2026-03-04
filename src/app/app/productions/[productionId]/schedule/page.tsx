import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ScheduleClient from "./schedule-client";

export const metadata = {
  title: "StageSuite | Scheduling",
};

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];

const EXAMPLE_PAYLOAD = {
  horizon_start: "2026-03-01T08:00:00Z",
  horizon_end: "2026-03-01T18:00:00Z",
  time_granularity_minutes: 15,
  blocks: [
    {
      id: "block-001",
      duration_minutes: 60,
      required_people_ids: ["person-a"],
      allowed_room_ids: ["room-1", "room-2"],
    },
    {
      id: "block-002",
      duration_minutes: 30,
      required_people_ids: ["person-a", "person-b"],
      fixed_room_id: "room-2",
    },
  ],
  people: [
    {
      id: "person-a",
      availability_windows: [
        { start: "2026-03-01T08:00:00Z", end: "2026-03-01T12:00:00Z" },
        { start: "2026-03-01T13:00:00Z", end: "2026-03-01T18:00:00Z" },
      ],
    },
    {
      id: "person-b",
      availability_windows: [
        { start: "2026-03-01T10:00:00Z", end: "2026-03-01T16:00:00Z" },
      ],
    },
  ],
  rooms: [
    {
      id: "room-1",
      availability_windows: [
        { start: "2026-03-01T08:00:00Z", end: "2026-03-01T18:00:00Z" },
      ],
    },
    {
      id: "room-2",
      availability_windows: [
        { start: "2026-03-01T09:00:00Z", end: "2026-03-01T17:00:00Z" },
      ],
    },
  ],
};

export default async function ProductionSchedulePage({
  params,
}: {
  params: Promise<{ productionId: string }>;
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

  const resolvedParams = await params;
  const production = await prisma.production.findUnique({
    where: { id: resolvedParams.productionId },
    select: {
      id: true,
      name: true,
      directorRoles: true,
    },
  });

  if (!production) {
    redirect("/app/productions");
  }

  const productionMember = await prisma.productionMember.findUnique({
    where: {
      productionId_userId: {
        productionId: production.id,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!productionMember) {
    redirect("/app/productions");
  }

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;

  if (!directorRoles.includes(productionMember.role)) {
    redirect(`/app?productionId=${production.id}`);
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Scheduling
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {production.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Run the solver and review generated block placements.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app?productionId=${production.id}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Back to dashboard
              </a>
              <a
                href={`/app/productions/${production.id}/settings`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Production settings
              </a>
            </div>
          </div>
        </header>

        <ScheduleClient
          productionId={production.id}
          examplePayload={JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
        />
      </div>
    </main>
  );
}

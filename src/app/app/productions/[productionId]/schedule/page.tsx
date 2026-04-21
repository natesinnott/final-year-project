import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import { getTeamAvailabilitySnapshot } from "@/lib/availability";
import { getSchedulingDraftState } from "@/lib/scheduling-draft-store";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProductionNav from "@/components/production-nav";
import ScheduleClient from "./schedule-client";

export const metadata = {
  title: "StageSuite | Scheduling",
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
      rehearsalStart: true,
      rehearsalEnd: true,
      timeZone: true,
    },
  });

  if (!production) {
    redirect("/app/productions");
  }

  const canAccess = await canAccessProductionScheduling(userId, production.id);
  if (!canAccess) {
    redirect(`/app?productionId=${production.id}`);
  }

  const [teamSnapshot, initialDraft] = await Promise.all([
    getTeamAvailabilitySnapshot(production.id),
    getSchedulingDraftState({
      productionId: production.id,
      userId,
    }).catch((error) => {
      console.error("Unable to load scheduling draft.", {
        productionId: production.id,
        userId,
        error,
      });

      return null;
    }),
  ]);

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Scheduling
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            {production.name}
          </h1>
          <p className="mt-2 text-sm text-slate-300">Build and publish schedules.</p>
        </header>

        <ProductionNav
          productionId={production.id}
          canAccessScheduling
          canAccessToday
          canAccessAttendance
        />

        <ScheduleClient
          productionId={production.id}
          initialHorizonStart={
            production.rehearsalStart ? production.rehearsalStart.toISOString() : null
          }
          initialHorizonEnd={
            production.rehearsalEnd ? production.rehearsalEnd.toISOString() : null
          }
          initialTimeZone={production.timeZone}
          initialMembers={teamSnapshot.members}
          initialDraft={initialDraft}
          initialCompleteness={{
            is_complete: teamSnapshot.completeness.isComplete,
            total_members: teamSnapshot.completeness.totalMembers,
            required_members: teamSnapshot.completeness.requiredMembers,
            submitted_members: teamSnapshot.completeness.submittedMembers,
            missing_members: teamSnapshot.completeness.missingMembers,
          }}
        />
      </div>
    </main>
  );
}

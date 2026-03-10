import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessProduction,
  getProductionMemberContext,
} from "@/lib/scheduler-access";
import { getVisibleUpcomingRehearsals } from "@/lib/rehearsals";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Rehearsals",
};

export default async function ProductionRehearsalsPage({
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

  const { productionId } = await params;
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      name: true,
      venue: true,
    },
  });

  if (!production) {
    redirect("/app/productions");
  }

  const isMember = await canAccessProduction(userId, productionId);
  if (!isMember) {
    redirect("/app/productions");
  }

  const memberContext = await getProductionMemberContext(userId, productionId);
  const canViewAll = Boolean(
    memberContext?.productionMemberRole &&
      memberContext.directorRoles.includes(memberContext.productionMemberRole)
  );

  const rehearsals = await getVisibleUpcomingRehearsals({
    productionId,
    userId,
    canViewAll,
    limit: 20,
  });

  return (
    <main className="min-h-dvh bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Published rehearsals
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {production.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {canViewAll
                  ? "Directors can see every published rehearsal for this production."
                  : "You can see the published rehearsals where you are assigned as a participant."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app?productionId=${production.id}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Back to dashboard
              </a>
              {canViewAll ? (
                <a
                  href={`/app/productions/${production.id}/schedule`}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Scheduling workspace
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Upcoming rehearsals</h2>
            <span className="text-xs text-slate-400">{rehearsals.length} scheduled</span>
          </div>

          {rehearsals.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              No published rehearsals are scheduled yet.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
              <div className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <div>Rehearsal</div>
                <div>Start</div>
                <div>End</div>
                <div>Location</div>
              </div>
              {rehearsals.map((rehearsal) => (
                <div
                  key={rehearsal.id}
                  className="grid grid-cols-[1.1fr_1fr_1fr_0.8fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
                >
                  <div className="font-medium text-white">{rehearsal.title}</div>
                  <div>{rehearsal.start.toLocaleString()}</div>
                  <div>{rehearsal.end.toLocaleString()}</div>
                  <div>{production.venue ?? "Default room"}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

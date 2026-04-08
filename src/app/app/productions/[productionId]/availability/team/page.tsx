import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import TeamAvailabilityClient from "./team-availability-client";

export const metadata = {
  title: "StageSuite | Team conflicts",
};

export default async function ProductionTeamAvailabilityPage({
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
    select: { id: true, name: true },
  });

  if (!production) {
    redirect("/app/productions");
  }

  const canAccess = await canAccessProductionScheduling(userId, production.id);
  if (!canAccess) {
    redirect(`/app?productionId=${production.id}`);
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Team conflicts
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {production.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Read-only conflicts across the production and missing submissions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app/productions/${production.id}/availability`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                My conflicts
              </a>
              <a
                href={`/app/productions/${production.id}/schedule`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Scheduling
              </a>
            </div>
          </div>
        </header>

        <TeamAvailabilityClient productionId={production.id} />
      </div>
    </main>
  );
}

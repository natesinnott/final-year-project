import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import ProductionNav from "@/components/production-nav";
import TeamAvailabilityClient from "./team-availability-client";

export const metadata = {
  title: "StageSuite | Cast & crew conflicts",
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
        <header className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Cast &amp; crew conflicts
          </p>
          <h1 className="mt-2 text-lg font-semibold text-white">
            {production.name}
          </h1>
        </header>

        <ProductionNav
          productionId={production.id}
          canAccessScheduling
          canAccessToday
          canAccessAttendance
        />

        <TeamAvailabilityClient productionId={production.id} />
      </div>
    </main>
  );
}

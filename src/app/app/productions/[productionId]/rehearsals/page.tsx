import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import { getVisiblePublishedRehearsals } from "@/lib/attendance-read";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProductionNav from "@/components/production-nav";
import ProductionRehearsalsClient from "./rehearsals-client";

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

  const access = await getAttendanceAccessContext(userId, productionId);
  if (!access?.isMember) {
    redirect("/app/productions");
  }

  const rehearsals = await getVisiblePublishedRehearsals({
    productionId,
    userId,
    canViewAll: access.canViewAllRehearsals,
  });

  return (
    <main className="min-h-dvh bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Published rehearsals
          </p>
          <h1 className="mt-2 text-lg font-semibold text-white">
            {production.name}
          </h1>
        </header>

        <ProductionNav
          productionId={production.id}
          canAccessScheduling={access.isDirectorRole}
          canAccessToday={access.canManageAttendance}
          canAccessAttendance={access.canViewAttendanceReport}
        />

        <ProductionRehearsalsClient
          productionId={production.id}
          venue={production.venue}
          productionTimeZone={access.productionTimeZone}
          canManageAttendance={access.canManageAttendance}
          canViewAllRehearsals={access.canViewAllRehearsals}
          rehearsals={rehearsals.map((rehearsal) => ({
            id: rehearsal.id,
            title: rehearsal.title,
            start: rehearsal.start.toISOString(),
            end: rehearsal.end.toISOString(),
            calledUserCount: rehearsal.calledUserCount,
            absentCount: rehearsal.absentCount,
            noShowCount: rehearsal.noShowCount,
            myStatus: rehearsal.myStatus,
          }))}
        />
      </div>
    </main>
  );
}

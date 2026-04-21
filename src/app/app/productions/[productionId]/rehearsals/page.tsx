import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import { getVisiblePublishedRehearsals } from "@/lib/attendance-read";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Published rehearsals
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {production.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {access.canManageAttendance
                  ? "Review rosters and attendance."
                  : "View your rehearsal calls."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app?productionId=${production.id}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Back to dashboard
              </a>
              {access.canManageAttendance ? (
                <a
                  href={`/app/productions/${production.id}/attendance/today`}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Today interface
                </a>
              ) : null}
              {access.canViewAttendanceReport ? (
                <a
                  href={`/app/productions/${production.id}/attendance/report`}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Attendance report
                </a>
              ) : null}
            </div>
          </div>
        </header>

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

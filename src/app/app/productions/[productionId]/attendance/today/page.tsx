import { auth } from "@/lib/auth";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import { getTodayAttendanceBlocks } from "@/lib/attendance-read";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TodayAttendanceClient from "./today-attendance-client";

export const metadata = {
  title: "StageSuite | Today attendance",
};

export default async function TodayAttendancePage({
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
  const access = await getAttendanceAccessContext(userId, productionId);

  if (!access?.isMember) {
    redirect("/app/productions");
  }

  if (!access.canManageAttendance) {
    redirect(`/app/productions/${productionId}/rehearsals`);
  }

  const blocks = await getTodayAttendanceBlocks({
    productionId,
    productionTimeZone: access.productionTimeZone,
  });

  return (
    <main className="min-h-dvh bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Today interface
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {access.productionName}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Attendance for rehearsal blocks happening today in{" "}
                {access.productionTimeZone}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app/productions/${productionId}/rehearsals`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Rehearsals
              </a>
              {access.canViewAttendanceReport ? (
                <a
                  href={`/app/productions/${productionId}/attendance/report`}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Attendance report
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <TodayAttendanceClient
          productionId={productionId}
          productionTimeZone={access.productionTimeZone}
          blocks={blocks.map((block) => ({
            id: block.id,
            title: block.title,
            start: block.start.toISOString(),
            end: block.end.toISOString(),
            calledUserCount: block.calledUserCount,
            roster: block.roster,
          }))}
        />
      </div>
    </main>
  );
}

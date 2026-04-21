import { auth } from "@/lib/auth";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import { getProductionAttendanceReport } from "@/lib/attendance-read";
import { formatInstantInTimeZone } from "@/lib/availabilityTime";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Attendance report",
};

function statusClasses(status: "REPORTED_ABSENT" | "NO_SHOW") {
  if (status === "REPORTED_ABSENT") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  return "border-rose-500/40 bg-rose-500/10 text-rose-100";
}

export default async function AttendanceReportPage({
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

  if (!access.canViewAttendanceReport) {
    redirect(`/app/productions/${productionId}/rehearsals`);
  }

  const rows = await getProductionAttendanceReport(productionId);

  return (
    <main className="min-h-dvh bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Attendance report
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {access.productionName}
              </h1>
              <p className="mt-2 text-sm text-slate-300">Non-present entries in {access.productionTimeZone}.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app/productions/${productionId}/rehearsals`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Rehearsals
              </a>
              <a
                href={`/app/productions/${productionId}/attendance/today`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Today interface
              </a>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              No attendance issues recorded
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <div className="grid grid-cols-[1.35fr_1fr_0.85fr_1.2fr] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <div>Rehearsal</div>
                <div>User</div>
                <div>Status</div>
                <div>Note</div>
              </div>
              {rows.map((row) => (
                <div
                  key={row.attendanceId}
                  className="grid grid-cols-[1.35fr_1fr_0.85fr_1.2fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
                >
                  <div>
                    <div className="font-medium text-white">{row.rehearsalTitle}</div>
                    <div className="text-xs text-slate-400">
                      {formatInstantInTimeZone(
                        row.rehearsalStart,
                        access.productionTimeZone
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-white">{row.userName}</div>
                    <div className="text-xs text-slate-400">
                      {row.userEmail} · {row.userRole}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs ${statusClasses(
                        row.status
                      )}`}
                    >
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    {row.note?.trim() || <span className="text-slate-500">No note</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

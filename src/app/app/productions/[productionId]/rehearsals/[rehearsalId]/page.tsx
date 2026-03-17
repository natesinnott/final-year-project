import { auth } from "@/lib/auth";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import {
  getSelfRehearsalAttendanceDetail,
  getStaffRehearsalAttendanceDetail,
} from "@/lib/attendance-read";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RehearsalDetailClient from "./rehearsal-detail-client";

export const metadata = {
  title: "StageSuite | Rehearsal attendance",
};

export default async function RehearsalDetailPage({
  params,
}: {
  params: Promise<{ productionId: string; rehearsalId: string }>;
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

  const { productionId, rehearsalId } = await params;
  const access = await getAttendanceAccessContext(userId, productionId);

  if (!access?.isMember) {
    redirect("/app/productions");
  }

  const detail = access.canManageAttendance
    ? await getStaffRehearsalAttendanceDetail({
        productionId,
        rehearsalId,
      })
    : await getSelfRehearsalAttendanceDetail({
        productionId,
        rehearsalId,
        userId,
      });

  if (!detail) {
    redirect(`/app/productions/${productionId}/rehearsals`);
  }

  const selfAttendance = "myStatus" in detail
    ? {
        myStatus: detail.myStatus,
        myNote: detail.myNote,
        isCalledUser: detail.isCalledUser,
        canSelfReport: detail.canSelfReport,
      }
    : undefined;
  const roster = "roster" in detail ? detail.roster : undefined;

  return (
    <main className="min-h-dvh bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Rehearsal attendance
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {detail.title}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {access.productionName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app/productions/${productionId}/rehearsals`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Back to rehearsals
              </a>
              {access.canManageAttendance ? (
                <a
                  href={`/app/productions/${productionId}/attendance/today`}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Today interface
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <RehearsalDetailClient
          productionId={productionId}
          rehearsalId={rehearsalId}
          productionTimeZone={access.productionTimeZone}
          canManageAttendance={access.canManageAttendance}
          detail={{
            id: detail.id,
            title: detail.title,
            start: detail.start.toISOString(),
            end: detail.end.toISOString(),
            calledUserCount: detail.calledUserCount,
          }}
          selfAttendance={selfAttendance}
          roster={roster}
        />
      </div>
    </main>
  );
}

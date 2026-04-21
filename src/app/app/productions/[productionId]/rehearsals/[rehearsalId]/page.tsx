import { auth } from "@/lib/auth";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import {
  getSelfRehearsalAttendanceDetail,
  getStaffRehearsalAttendanceDetail,
} from "@/lib/attendance-read";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProductionNav from "@/components/production-nav";
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
        <header className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Rehearsal attendance
          </p>
          <h1 className="mt-2 text-lg font-semibold text-white">{access.productionName}</h1>
        </header>

        <ProductionNav
          productionId={productionId}
          canAccessScheduling={access.isDirectorRole}
          canAccessToday={access.canManageAttendance}
          canAccessAttendance={access.canViewAttendanceReport}
        />

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

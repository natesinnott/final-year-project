import { auth } from "@/lib/auth";
import { getAttendanceAccessContext } from "@/lib/attendance-access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProductionNav from "@/components/production-nav";
import AvailabilityClient from "./availability-client";

export const metadata = {
  title: "StageSuite | Conflicts",
};

export default async function ProductionAvailabilityPage({
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

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Conflicts
          </p>
          <h1 className="mt-2 text-lg font-semibold text-white">
            {access.productionName}
          </h1>
        </header>

        <ProductionNav
          productionId={productionId}
          canAccessScheduling={access.isDirectorRole}
          canAccessToday={access.canManageAttendance}
          canAccessAttendance={access.canViewAttendanceReport}
        />

        <AvailabilityClient productionId={productionId} />
      </div>
    </main>
  );
}

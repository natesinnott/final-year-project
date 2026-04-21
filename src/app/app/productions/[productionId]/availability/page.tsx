import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProductionMemberContext } from "@/lib/scheduler-access";
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
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { id: true, name: true },
  });

  if (!production) {
    redirect("/app/productions");
  }

  const memberContext = await getProductionMemberContext(userId, productionId);
  if (!memberContext?.isProductionMember) {
    redirect("/app/productions");
  }

  const canAccessScheduling = Boolean(
    memberContext.productionMemberRole &&
      memberContext.directorRoles.includes(memberContext.productionMemberRole)
  );

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Conflicts
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {production.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">Add conflict windows.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/app?productionId=${production.id}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                Back to dashboard
              </a>
              {canAccessScheduling ? (
                <a
                  href={`/app/productions/${production.id}/schedule`}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                >
                  Scheduling
                </a>
              ) : null}
            </div>
          </div>
        </header>

        <AvailabilityClient productionId={production.id} />
      </div>
    </main>
  );
}

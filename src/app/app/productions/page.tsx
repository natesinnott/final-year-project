import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Productions",
};

// Lists productions in the org and allows members to enter dashboards.
export default async function ProductionsPage() {
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

  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { organisation: true },
  });

  if (!membership) {
    redirect("/app/onboarding");
  }

  const productionMemberships = await prisma.productionMember.findMany({
    where: {
      userId,
      production: { organisationId: membership.organisationId },
    },
    include: { production: true },
    orderBy: { createdAt: "asc" },
  });

  const productions = await prisma.production.findMany({
    where: { organisationId: membership.organisationId },
    orderBy: { createdAt: "asc" },
  });

  const productionIds = new Set(
    productionMemberships.map((membershipEntry) => membershipEntry.productionId)
  );

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Productions
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {membership.organisation.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Select a production to enter the rehearsal dashboard.
              </p>
            </div>
            {membership.role === "ADMIN" ? (
              <a
                href="/app/productions/new"
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Create production
              </a>
            ) : null}
          </div>
        </header>

        <section className="grid gap-4">
          {productions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              No productions yet. Ask an admin to create the first production.
            </div>
          ) : (
            productions.map((production) => (
              <div
                key={production.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {production.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {production.venue ?? "Venue to be confirmed"}
                    </p>
                  </div>
                  {productionIds.has(production.id) ? (
                    <a
                      href={`/app?productionId=${production.id}`}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                      Open dashboard
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Invite required
                    </span>
                  )}
                </div>
                {membership.role === "ADMIN" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/app/productions/${production.id}/settings`}
                      className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
                    >
                      Manage settings
                    </a>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProductionSettingsForm from "./production-settings-form";
import ProductionInviteCard from "./production-invite-card";

export const metadata = {
  title: "StageSuite | Production settings",
};

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];

export default async function ProductionSettingsPage({
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

  const resolvedParams = await params;
  const production = await prisma.production.findUnique({
    where: { id: resolvedParams.productionId },
    include: { organisation: true },
  });

  if (!production) {
    redirect("/app/productions");
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, organisationId: production.organisationId },
  });

  const productionMember = await prisma.productionMember.findFirst({
    where: { userId, productionId: production.id },
  });

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;

  const canManage =
    membership?.role === "ADMIN" ||
    (productionMember && directorRoles.includes(productionMember.role));

  if (!canManage) {
    redirect("/app/productions");
  }

  const productionRoles = [
    "DIRECTOR",
    "STAGE_MANAGER",
    "CHOREOGRAPHER",
    "MUSIC_DIRECTOR",
    "CAST",
    "CREW",
    "VIEWER",
  ];

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                Production settings
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white">
                {production.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Update core details, choose who can manage the production, and
                generate invite links.
              </p>
            </div>
            <a
              href={`/app?productionId=${production.id}`}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Back to dashboard
            </a>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <ProductionSettingsForm
            production={{
              id: production.id,
              name: production.name,
              description: production.description,
              rehearsalStart: production.rehearsalStart
                ? production.rehearsalStart.toISOString()
                : null,
              rehearsalEnd: production.rehearsalEnd
                ? production.rehearsalEnd.toISOString()
                : null,
              venue: production.venue,
              directorRoles: production.directorRoles,
            }}
            productionRoles={productionRoles}
          />
          <ProductionInviteCard
            productionId={production.id}
            productionName={production.name}
            productionRoles={productionRoles}
          />
        </div>
      </div>
    </main>
  );
}

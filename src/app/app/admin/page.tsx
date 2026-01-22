import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ProductionAccessManager from "./production-access-manager";

export const metadata = {
  title: "StageSuite | Administration",
};

const productionRoles = [
  "DIRECTOR",
  "STAGE_MANAGER",
  "CHOREOGRAPHER",
  "MUSIC_DIRECTOR",
  "CAST",
  "CREW",
  "VIEWER",
];

// Organisation-level admin overview for production access management.
export default async function AdminPage() {
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

  const adminMembership = await prisma.membership.findFirst({
    where: { userId, role: "ADMIN" },
    include: { organisation: true },
  });

  if (!adminMembership) {
    redirect("/app");
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: adminMembership.organisationId },
    include: {
      memberships: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!organisation) {
    redirect("/app");
  }

  const productionMembers = await prisma.productionMember.findMany({
    where: { production: { organisationId: organisation.id } },
    include: { production: true, user: true },
    orderBy: { createdAt: "asc" },
  });

  const userAccessMap = new Map<
    string,
    { userId: string; name: string; email: string; productions: { productionId: string; productionName: string; role: string }[] }
  >();

  organisation.memberships.forEach((membership) => {
    userAccessMap.set(membership.userId, {
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      productions: [],
    });
  });

  productionMembers.forEach((member) => {
    const entry =
      userAccessMap.get(member.userId) ??
      {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        productions: [],
      };

    entry.productions.push({
      productionId: member.productionId,
      productionName: member.production.name,
      role: member.role,
    });

    userAccessMap.set(member.userId, entry);
  });

  const userAccess = Array.from(userAccessMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Administration
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Manage production access and keep roles up to date across your
                organisation.
              </p>
            </div>
            <a
              href="/app/admin/sso"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Configure SSO
            </a>
          </div>
        </header>

        <ProductionAccessManager
          productionRoles={productionRoles}
          users={userAccess}
        />
      </div>
    </main>
  );
}

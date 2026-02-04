import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OrganisationSettingsTabs from "./organisation-settings-tabs";

export const metadata = {
  title: "StageSuite | Organisation settings",
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

export default async function OrganisationSettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user?.id;
  const membership = userId
    ? await prisma.membership.findFirst({
        where: { userId },
        include: { organisation: true },
      })
    : null;

  if (!membership) {
    redirect("/app/onboarding");
  }

  const isAdmin = membership.role === "ADMIN";

  let userAccess: {
    userId: string;
    name: string;
    email: string;
    productions: { productionId: string; productionName: string; role: string }[];
  }[] = [];

  if (isAdmin) {
    const organisation = await prisma.organisation.findUnique({
      where: { id: membership.organisationId },
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
      {
        userId: string;
        name: string;
        email: string;
        productions: { productionId: string; productionName: string; role: string }[];
      }
    >();

    organisation.memberships.forEach((orgMembership) => {
      userAccessMap.set(orgMembership.userId, {
        userId: orgMembership.userId,
        name: orgMembership.user.name,
        email: orgMembership.user.email,
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

    userAccess = Array.from(userAccessMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Organisation settings
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Manage your organisation profile, production access, and SSO
                configuration.
              </p>
            </div>
            <a
              href="/app"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              Back to dashboard
            </a>
          </div>
        </header>

        <OrganisationSettingsTabs
          isAdmin={isAdmin}
          organisation={membership.organisation}
          productionRoles={productionRoles}
          users={userAccess}
        />
      </div>
    </main>
  );
}

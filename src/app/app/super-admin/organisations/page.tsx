import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAppAdminEmail } from "@/lib/app-admin";
import OrganisationsClient from "./organisations-client";

export const metadata = {
  title: "StageSuite | Organisation Admin",
};

export default async function OrganisationAdminPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const email = session?.user?.email;
  if (!email || !isAppAdminEmail(email)) {
    redirect("/app");
  }

  const organisations = await prisma.organisation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          memberships: true,
          productions: true,
          announcements: true,
          fileAssets: true,
        },
      },
    },
  });

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Organisation Admin
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                App-admin-only view for managing organisations and cascading
                deletes.
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

        <OrganisationsClient
          organisations={organisations.map((org) => ({
            ...org,
            createdAt: org.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}

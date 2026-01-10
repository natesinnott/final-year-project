import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Administration",
};

const roleOptions = ["ADMIN", "DIRECTOR", "STAGE_MANAGER", "MEMBER"];

// Organisation-level admin overview for role assignments (UI-only for now).
export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const organisations = await prisma.organisation.findMany({
    include: {
      memberships: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

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
                Assign roles and manage permissions per organisation and
                production. Role updates will be wired up next.
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

        <section className="grid gap-6">
          {organisations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              No organisations yet. Create an organisation to start assigning
              roles.
            </div>
          ) : (
            organisations.map((organisation) => (
              <div
                key={organisation.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {organisation.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {organisation.memberships.length} members
                    </p>
                  </div>
                  <button
                    className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400"
                    disabled
                  >
                    Invite member (coming soon)
                  </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                  <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    <div>Name</div>
                    <div>Role</div>
                    <div>Actions</div>
                  </div>
                  {organisation.memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
                    >
                      <div>
                        <div className="font-medium text-white">
                          {membership.user.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {membership.user.email}
                        </div>
                      </div>
                      <div>
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-300"
                          defaultValue={membership.role}
                          disabled
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <button
                          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-400"
                          disabled
                        >
                          Update (soon)
                        </button>
                      </div>
                    </div>
                  ))}
                  {organisation.memberships.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-400">
                      No members assigned yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

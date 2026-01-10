import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OrganisationForm from "./organisation-form";

export const metadata = {
  title: "StageSuite | Organisation settings",
};

export default async function OrganisationPage() {
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

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Organisation setup
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Confirm your details
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            You can update this information at any time. Administrators manage
            membership and production setup from here.
          </p>
          {membership.role === "ADMIN" ? (
            <a
              href="/app/productions/new"
              className="mt-4 inline-flex rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Create production
            </a>
          ) : null}
        </header>

        <OrganisationForm
          initialValues={{
            name: membership.organisation.name,
            primaryLocation: membership.organisation.primaryLocation ?? "",
            contactEmail: membership.organisation.contactEmail ?? "",
            description: membership.organisation.description ?? "",
          }}
        />
      </div>
    </main>
  );
}

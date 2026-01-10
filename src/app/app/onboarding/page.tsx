import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingForm from "./onboarding-form";

export const metadata = {
  title: "StageSuite | Create organisation",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user?.id;
  const membership = userId
    ? await prisma.membership.findFirst({ where: { userId } })
    : null;

  if (membership) {
    redirect("/app");
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Get started
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white">
            Create your organisation
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            You will be set as the first admin, then taken into the app to fill
            in the rest of your organisation details.
          </p>
        </header>

        <OnboardingForm userName={session.user?.name ?? ""} />
      </div>
    </main>
  );
}

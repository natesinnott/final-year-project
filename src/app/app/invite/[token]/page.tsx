import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import InviteAcceptCard from "./invite-accept-card";

export const metadata = {
  title: "StageSuite | Accept invite",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const resolvedParams = await params;
  // Load invite details to show production info and validate expiry.
  const invite = await prisma.productionInvite.findUnique({
    where: { token: resolvedParams.token },
    include: { production: true },
  });

  if (!invite) {
    return (
      <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-white">Invite not found</h1>
          <p className="text-sm text-slate-300">
            This invite link is invalid or has been removed.
          </p>
          <a href="/login" className="text-sm text-amber-300">
            Return to sign in
          </a>
        </div>
      </main>
    );
  }

  const isExpired =
    (invite.expiresAt && invite.expiresAt < new Date()) ||
    (invite.maxUses !== null && invite.uses >= invite.maxUses);

  if (isExpired) {
    return (
      <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-white">Invite expired</h1>
          <p className="text-sm text-slate-300">
            Ask an admin for a fresh invite link to join this production.
          </p>
          <a href="/login" className="text-sm text-amber-300">
            Return to sign in
          </a>
        </div>
      </main>
    );
  }

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <InviteAcceptCard
          token={invite.token}
          productionName={invite.production.name}
          role={invite.role}
        />
      </div>
    </main>
  );
}

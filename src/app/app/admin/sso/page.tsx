import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | SSO setup",
};

// Admin-only SSO configuration entry point.
export default async function SsoSetupPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user?.id;
  const membership = userId
    ? await prisma.membership.findFirst({
        where: { userId, role: "ADMIN" },
      })
    : null;

  if (!membership) {
    redirect("/app");
  }

  redirect("/app/organisation/settings");
}

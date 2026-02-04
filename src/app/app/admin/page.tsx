import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StageSuite | Administration",
};

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
  });

  if (!adminMembership) {
    redirect("/app");
  }

  redirect("/app/organisation/settings");
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAppAdminEmail } from "@/lib/app-admin";
import { deleteOrganisationBlobs } from "@/lib/azure-blob";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAppAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({ organisations });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAppAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as { organisationId?: string };
  const organisationId = payload?.organisationId?.trim();

  if (!organisationId) {
    return NextResponse.json({ error: "Missing organisationId" }, { status: 400 });
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { id: true },
  });

  if (!organisation) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  // Delete blobs first to avoid orphaned storage if DB delete succeeds.
  await deleteOrganisationBlobs(organisationId);
  await prisma.organisation.delete({ where: { id: organisationId } });

  return NextResponse.json({ success: true });
}

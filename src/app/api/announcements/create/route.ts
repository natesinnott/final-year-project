import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Only directors and stage managers can post announcements by default.
const POSTING_ROLES = new Set(["DIRECTOR", "STAGE_MANAGER"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    title?: string;
    body?: string;
    organisationId?: string;
    productionId?: string;
    visibleToRoles?: string[];
  };

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const organisationId = payload.organisationId?.trim();
  const productionId = payload.productionId?.trim();

  if (!title || !body || !organisationId || !productionId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Ensure the production belongs to the organisation in the request.
  const production = await prisma.production.findUnique({
    where: { id: productionId },
  });

  if (!production || production.organisationId !== organisationId) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  // Org admins can always post; production roles can if allowed.
  const membership = await prisma.membership.findFirst({
    where: { userId, organisationId },
  });

  const productionMember = await prisma.productionMember.findFirst({
    where: { userId, productionId },
  });

  const canPost =
    membership?.role === "ADMIN" ||
    (productionMember && POSTING_ROLES.has(productionMember.role));

  if (!canPost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Persist the announcement and mark as published immediately.
  const created = await prisma.announcement.create({
    data: {
      title,
      body,
      organisationId,
      productionId,
      visibleToRoles:
        payload.visibleToRoles?.map((role) => role.trim()).filter(Boolean) ??
        [],
      createdById: userId,
      publishedAt: new Date(),
    },
  });

  return NextResponse.json({ id: created.id });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductionRole } from "@prisma/client";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];
const PRODUCTION_ROLES = new Set<ProductionRole>([
  "DIRECTOR",
  "STAGE_MANAGER",
  "CHOREOGRAPHER",
  "MUSIC_DIRECTOR",
  "CAST",
  "CREW",
  "VIEWER",
]);

type UpdateMemberPayload = {
  productionId?: string;
  userId?: string;
  role?: string;
};

type RemoveMemberPayload = {
  productionId?: string;
  userId?: string;
};

async function canManageProduction(userId: string, productionId: string) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
  });

  if (!production) {
    return { ok: false, error: "Production not found" };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, organisationId: production.organisationId },
  });

  const productionMember = await prisma.productionMember.findFirst({
    where: { userId, productionId },
  });

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;

  const canManage =
    membership?.role === "ADMIN" ||
    (productionMember && directorRoles.includes(productionMember.role));

  if (!canManage) {
    return { ok: false, error: "Forbidden" };
  }

  return { ok: true, production };
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const actorId = session?.user?.id;

  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as UpdateMemberPayload;
  const productionId = payload.productionId?.trim();
  const userId = payload.userId?.trim();
  const role = payload.role?.trim();

  if (!productionId || !userId || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!PRODUCTION_ROLES.has(role as ProductionRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const permission = await canManageProduction(actorId, productionId);
  if (!permission.ok) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.error === "Forbidden" ? 403 : 404 }
    );
  }

  const existing = await prisma.productionMember.findUnique({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const updated = await prisma.productionMember.update({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
    data: { role: role as ProductionRole },
  });

  return NextResponse.json({
    userId: updated.userId,
    role: updated.role,
  });
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const actorId = session?.user?.id;

  if (!actorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as RemoveMemberPayload;
  const productionId = payload.productionId?.trim();
  const userId = payload.userId?.trim();

  if (!productionId || !userId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const permission = await canManageProduction(actorId, productionId);
  if (!permission.ok) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.error === "Forbidden" ? 403 : 404 }
    );
  }

  const existing = await prisma.productionMember.findUnique({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.productionMember.delete({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
  });

  return NextResponse.json({ ok: true });
}

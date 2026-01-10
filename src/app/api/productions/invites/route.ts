import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
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

type CreateInvitePayload = {
  productionId?: string;
  role?: string;
  expiresAt?: string;
  maxUses?: number;
};

function normalizeRoles(roles: string[] | undefined) {
  if (!roles || roles.length === 0) {
    return DEFAULT_DIRECTOR_ROLES;
  }
  return roles.map((role) => role.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as CreateInvitePayload;
  const productionId = payload.productionId?.trim();

  if (!productionId) {
    return NextResponse.json({ error: "Missing productionId" }, { status: 400 });
  }

  const production = await prisma.production.findUnique({
    where: { id: productionId },
  });

  if (!production) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, organisationId: production.organisationId },
  });

  const productionMember = await prisma.productionMember.findFirst({
    where: { userId, productionId },
  });

  const directorRoles = normalizeRoles(production.directorRoles);
  const canManage =
    membership?.role === "ADMIN" ||
    (productionMember && directorRoles.includes(productionMember.role));

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;

  const inviteRole = payload.role && PRODUCTION_ROLES.has(payload.role as ProductionRole)
    ? (payload.role as ProductionRole)
    : "CAST";

  const created = await prisma.productionInvite.create({
    data: {
      token,
      role: inviteRole,
      expiresAt,
      maxUses:
        typeof payload.maxUses === "number" ? payload.maxUses : null,
      productionId,
      createdById: userId,
    },
  });

  return NextResponse.json({
    token: created.token,
    role: created.role,
    expiresAt: created.expiresAt,
  });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];
const PRODUCTION_ROLES = new Set([
  "DIRECTOR",
  "STAGE_MANAGER",
  "CHOREOGRAPHER",
  "MUSIC_DIRECTOR",
  "CAST",
  "CREW",
  "VIEWER",
]);

type UpdateProductionPayload = {
  productionId?: string;
  name?: string;
  description?: string;
  rehearsalStart?: string;
  rehearsalEnd?: string;
  venue?: string;
  directorRoles?: string[];
};

function normalizeRoles(roles: string[] | undefined) {
  if (!roles || roles.length === 0) {
    return DEFAULT_DIRECTOR_ROLES;
  }
  return roles
    .map((role) => role.trim())
    .filter((role) => role && PRODUCTION_ROLES.has(role));
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as UpdateProductionPayload;
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

  const updated = await prisma.production.update({
    where: { id: productionId },
    data: {
      name: payload.name?.trim() || production.name,
      description: payload.description?.trim() || null,
      rehearsalStart: payload.rehearsalStart
        ? new Date(payload.rehearsalStart)
        : null,
      rehearsalEnd: payload.rehearsalEnd ? new Date(payload.rehearsalEnd) : null,
      venue: payload.venue?.trim() || null,
      directorRoles: payload.directorRoles
        ? normalizeRoles(payload.directorRoles)
        : production.directorRoles,
    },
  });

  return NextResponse.json({ productionId: updated.id });
}

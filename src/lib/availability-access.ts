import { prisma } from "@/lib/prisma";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];

export async function getAvailabilityAccessContext(
  userId: string,
  productionId: string
) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      directorRoles: true,
    },
  });

  if (!production) {
    return null;
  }

  const productionMember = await prisma.productionMember.findUnique({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
    select: {
      role: true,
    },
  });

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;

  const memberRole = productionMember?.role ?? null;

  return {
    productionId: production.id,
    isMember: Boolean(productionMember),
    memberRole,
    directorRoles,
    isDirectorRole: memberRole ? directorRoles.includes(memberRole) : false,
  };
}

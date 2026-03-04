import { prisma } from "@/lib/prisma";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];

export async function canAccessProductionScheduling(
  userId: string,
  productionId: string
): Promise<boolean> {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { directorRoles: true },
  });

  if (!production) {
    return false;
  }

  const productionMember = await prisma.productionMember.findUnique({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!productionMember) {
    return false;
  }

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;

  return directorRoles.includes(productionMember.role);
}

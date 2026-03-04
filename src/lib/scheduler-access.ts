import { prisma } from "@/lib/prisma";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];

export async function getProductionMemberContext(
  userId: string,
  productionId: string
) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { id: true, directorRoles: true },
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
    select: { role: true },
  });

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : DEFAULT_DIRECTOR_ROLES;

  return {
    productionId: production.id,
    productionMemberRole: productionMember?.role ?? null,
    isProductionMember: Boolean(productionMember),
    directorRoles,
  };
}

export async function canAccessProduction(userId: string, productionId: string) {
  const context = await getProductionMemberContext(userId, productionId);
  return Boolean(context?.isProductionMember);
}

export async function canAccessProductionScheduling(
  userId: string,
  productionId: string
): Promise<boolean> {
  const context = await getProductionMemberContext(userId, productionId);
  if (!context || !context.isProductionMember || !context.productionMemberRole) {
    return false;
  }

  return context.directorRoles.includes(context.productionMemberRole);
}

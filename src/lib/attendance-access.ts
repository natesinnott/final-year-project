import { prisma } from "@/lib/prisma";
import { isValidTimeZone } from "@/lib/availabilityTime";

const DEFAULT_DIRECTOR_ROLES = ["DIRECTOR"];
const STAGE_MANAGER_ROLE = "STAGE_MANAGER";
const FALLBACK_TIME_ZONE = "UTC";

export function normalizeProductionTimeZone(timeZone: string | null | undefined) {
  if (timeZone && isValidTimeZone(timeZone)) {
    return timeZone;
  }

  return FALLBACK_TIME_ZONE;
}

export async function getAttendanceAccessContext(
  userId: string,
  productionId: string
) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      name: true,
      directorRoles: true,
      timeZone: true,
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
  const isDirectorRole = memberRole ? directorRoles.includes(memberRole) : false;
  const isStageManagerRole = memberRole === STAGE_MANAGER_ROLE;

  return {
    productionId: production.id,
    productionName: production.name,
    productionTimeZone: normalizeProductionTimeZone(production.timeZone),
    hasConfiguredTimeZone: Boolean(production.timeZone && isValidTimeZone(production.timeZone)),
    directorRoles,
    isMember: Boolean(productionMember),
    memberRole,
    isDirectorRole,
    isStageManagerRole,
    canViewAllRehearsals: isDirectorRole || isStageManagerRole,
    canManageAttendance: isDirectorRole || isStageManagerRole,
    canViewAttendanceReport: isDirectorRole,
  };
}

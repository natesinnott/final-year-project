import { AvailabilityKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type MissingMember = {
  userId: string;
  name: string;
  role: string;
};

export type AvailabilityCompleteness = {
  isComplete: boolean;
  totalMembers: number;
  requiredMembers: number;
  submittedMembers: number;
  missingMembers: MissingMember[];
};

export function parseAvailabilityKind(kind: unknown) {
  if (kind === "AVAILABLE" || kind === "UNAVAILABLE") {
    return kind as AvailabilityKind;
  }
  return null;
}

export function parseUtcDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function findOverlappingAvailabilityWindow({
  productionId,
  userId,
  start,
  end,
  excludeWindowId,
}: {
  productionId: string;
  userId: string;
  start: Date;
  end: Date;
  excludeWindowId?: string;
}) {
  return prisma.availabilityWindow.findFirst({
    where: {
      productionId,
      userId,
      ...(excludeWindowId
        ? {
            NOT: {
              id: excludeWindowId,
            },
          }
        : {}),
      start: {
        lt: end,
      },
      end: {
        gt: start,
      },
    },
    select: { id: true },
  });
}

export async function getAvailabilityCompleteness(
  productionId: string
): Promise<AvailabilityCompleteness> {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      directorRoles: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!production) {
    return {
      isComplete: false,
      totalMembers: 0,
      requiredMembers: 0,
      submittedMembers: 0,
      missingMembers: [],
    };
  }

  const directorRoles =
    production.directorRoles.length > 0
      ? production.directorRoles
      : ["DIRECTOR"];

  const requiredMembers = production.members.filter(
    (member) => !directorRoles.includes(member.role)
  );

  if (requiredMembers.length === 0) {
    return {
      isComplete: true,
      totalMembers: production.members.length,
      requiredMembers: 0,
      submittedMembers: 0,
      missingMembers: [],
    };
  }

  const submitted = await prisma.availabilityWindow.findMany({
    where: {
      productionId,
      userId: {
        in: requiredMembers.map((member) => member.userId),
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const submittedUserIds = new Set(submitted.map((entry) => entry.userId));

  const missingMembers = requiredMembers
    .filter((member) => !submittedUserIds.has(member.userId))
    .map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      role: member.role,
    }));

  return {
    isComplete: missingMembers.length === 0,
    totalMembers: production.members.length,
    requiredMembers: requiredMembers.length,
    submittedMembers: requiredMembers.length - missingMembers.length,
    missingMembers,
  };
}

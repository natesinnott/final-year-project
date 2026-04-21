import { prisma } from "@/lib/prisma";

type MissingMember = {
  userId: string;
  name: string;
  role: string;
};

export type TeamAvailabilityWindow = {
  id: string;
  start: string;
  end: string;
};

export type TeamAvailabilityMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  submittedAt: string | null;
  windows: TeamAvailabilityWindow[];
};

export type AvailabilityCompleteness = {
  isComplete: boolean;
  totalMembers: number;
  requiredMembers: number;
  submittedMembers: number;
  missingMembers: MissingMember[];
};

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
  // Half-open overlap logic allows back-to-back conflicts where one window ends
  // exactly when the next begins without treating that boundary as a collision.
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

export async function markConflictsSubmitted({
  productionId,
  userId,
  submittedAt,
}: {
  productionId: string;
  userId: string;
  submittedAt?: Date;
}) {
  const timestamp = submittedAt ?? new Date();

  await prisma.productionMember.updateMany({
    where: {
      productionId,
      userId,
    },
    data: {
      conflictsSubmittedAt: timestamp,
    },
  });

  return timestamp;
}

export async function getAvailabilityCompleteness(
  productionId: string
): Promise<AvailabilityCompleteness> {
  // Scheduling only blocks on non-director members. Director-equivalent roles
  // coordinate the solve, so their own conflicts are informational rather than required.
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

  const submittedUserIds = new Set(
    requiredMembers
      .filter((member) => member.conflictsSubmittedAt !== null)
      .map((member) => member.userId)
  );

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

export async function getTeamAvailabilitySnapshot(productionId: string): Promise<{
  members: TeamAvailabilityMember[];
  completeness: AvailabilityCompleteness;
}> {
  const [members, windows, completeness] = await Promise.all([
    prisma.productionMember.findMany({
      where: { productionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.availabilityWindow.findMany({
      where: { productionId },
      orderBy: [{ userId: "asc" }, { start: "asc" }],
    }),
    getAvailabilityCompleteness(productionId),
  ]);

  const windowsByUser = new Map<string, TeamAvailabilityWindow[]>();

  for (const window of windows) {
    const serializedWindow = {
      id: window.id,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    };
    const existing = windowsByUser.get(window.userId);

    if (existing) {
      existing.push(serializedWindow);
    } else {
      windowsByUser.set(window.userId, [serializedWindow]);
    }
  }

  return {
    members: members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      submittedAt: member.conflictsSubmittedAt?.toISOString() ?? null,
      windows: windowsByUser.get(member.userId) ?? [],
    })),
    completeness,
  };
}

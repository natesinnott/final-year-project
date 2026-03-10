import type { Prisma } from "@prisma/client";
import { RehearsalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PersistedRehearsalInput = {
  title: string;
  start: Date;
  end: Date;
  participantUserIds: string[];
};

function getPublishedRehearsalVisibilityFilter(userId: string, canViewAll: boolean) {
  if (canViewAll) {
    return {};
  }

  return {
    participants: {
      some: {
        userId,
      },
    },
  };
}

export function getCurrentWeekRange(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const currentDay = start.getDay();
  const daysFromMonday = (currentDay + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

export async function getVisibleUpcomingRehearsals({
  productionId,
  userId,
  canViewAll,
  limit = 5,
  referenceDate = new Date(),
}: {
  productionId: string;
  userId: string;
  canViewAll: boolean;
  limit?: number;
  referenceDate?: Date;
}) {
  return prisma.productionRehearsal.findMany({
    where: {
      productionId,
      status: RehearsalStatus.PUBLISHED,
      end: {
        gte: referenceDate,
      },
      ...getPublishedRehearsalVisibilityFilter(userId, canViewAll),
    },
    orderBy: {
      start: "asc",
    },
    take: limit,
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
    },
  });
}

export async function countVisibleRehearsalsThisWeek({
  productionId,
  userId,
  canViewAll,
  referenceDate = new Date(),
}: {
  productionId: string;
  userId: string;
  canViewAll: boolean;
  referenceDate?: Date;
}) {
  const weekRange = getCurrentWeekRange(referenceDate);

  return prisma.productionRehearsal.count({
    where: {
      productionId,
      status: RehearsalStatus.PUBLISHED,
      start: {
        gte: weekRange.start,
        lt: weekRange.end,
      },
      ...getPublishedRehearsalVisibilityFilter(userId, canViewAll),
    },
  });
}

export async function publishProductionRehearsals({
  productionId,
  createdById,
  solveRunId,
  sourceMetadata,
  horizonStart,
  horizonEnd,
  rehearsals,
}: {
  productionId: string;
  createdById: string;
  solveRunId?: string | null;
  sourceMetadata?: Prisma.InputJsonValue | null;
  horizonStart: Date;
  horizonEnd: Date;
  rehearsals: PersistedRehearsalInput[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.productionRehearsal.deleteMany({
      where: {
        productionId,
        start: {
          lt: horizonEnd,
        },
        end: {
          gt: horizonStart,
        },
      },
    });

    const createdRehearsals = [];

    for (const rehearsal of rehearsals) {
      const participantUserIds = [...new Set(rehearsal.participantUserIds)];

      const created = await tx.productionRehearsal.create({
        data: {
          productionId,
          createdById,
          title: rehearsal.title,
          start: rehearsal.start,
          end: rehearsal.end,
          status: RehearsalStatus.PUBLISHED,
          solveRunId: solveRunId ?? null,
          sourceMetadata: sourceMetadata ?? undefined,
          participants: participantUserIds.length
            ? {
                createMany: {
                  data: participantUserIds.map((userId) => ({
                    userId,
                  })),
                },
              }
            : undefined,
        },
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          status: true,
        },
      });

      createdRehearsals.push(created);
    }

    return createdRehearsals;
  });
}

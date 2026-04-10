import type { Prisma } from "@prisma/client";
import { RehearsalStatus } from "@prisma/client";
import {
  auditAttendanceDiscardForRehearsal,
  buildRehearsalReconciliationKey,
  deleteAttendanceForRemovedParticipants,
} from "@/lib/attendance";
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
  timeZone,
  solveRunId,
  sourceMetadata,
  horizonStart,
  horizonEnd,
  rehearsals,
  clearSchedulingDrafts = false,
}: {
  productionId: string;
  createdById: string;
  timeZone: string;
  solveRunId?: string | null;
  sourceMetadata?: Prisma.InputJsonValue | null;
  horizonStart: Date;
  horizonEnd: Date;
  rehearsals: PersistedRehearsalInput[];
  clearSchedulingDrafts?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const production = await tx.production.findUnique({
      where: {
        id: productionId,
      },
      select: {
        id: true,
        timeZone: true,
      },
    });

    if (!production) {
      throw new Error("Production not found.");
    }

    if (production.timeZone && production.timeZone !== timeZone) {
      throw new Error(
        `This production is already locked to ${production.timeZone}.`
      );
    }

    if (!production.timeZone) {
      await tx.production.update({
        where: {
          id: productionId,
        },
        data: {
          timeZone,
        },
      });
    }

    const now = new Date();
    const existingFutureRehearsals = await tx.productionRehearsal.findMany({
      where: {
        productionId,
        status: RehearsalStatus.PUBLISHED,
        start: {
          gte: now,
          lt: horizonEnd,
        },
        end: {
          gt: horizonStart,
        },
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        productionId: true,
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });

    const existingByKey = new Map<
      string,
      (typeof existingFutureRehearsals)[number]
    >();

    for (const rehearsal of existingFutureRehearsals) {
      const key = buildRehearsalReconciliationKey(rehearsal);

      if (existingByKey.has(key)) {
        throw new Error(
          `Existing published rehearsal reconciliation is ambiguous for "${rehearsal.title}".`
        );
      }

      existingByKey.set(key, rehearsal);
    }

    const normalizedRehearsals = rehearsals.map((rehearsal) => ({
      ...rehearsal,
      title: rehearsal.title.trim(),
      participantUserIds: [...new Set(rehearsal.participantUserIds)],
    }));

    const nextKeys = new Set<string>();
    const matchedExistingIds = new Set<string>();
    const createdRehearsals = [];

    for (const rehearsal of normalizedRehearsals) {
      const reconciliationKey = buildRehearsalReconciliationKey(rehearsal);

      if (nextKeys.has(reconciliationKey)) {
        throw new Error(
          `Duplicate rehearsal reconciliation key for "${rehearsal.title}".`
        );
      }

      nextKeys.add(reconciliationKey);
      const existing = existingByKey.get(reconciliationKey);

      if (existing) {
        matchedExistingIds.add(existing.id);

        const currentParticipantIds = new Set(
          existing.participants.map((participant) => participant.userId)
        );
        const nextParticipantIds = new Set(rehearsal.participantUserIds);
        const removedUserIds = [...currentParticipantIds].filter(
          (userId) => !nextParticipantIds.has(userId)
        );
        const addedUserIds = [...nextParticipantIds].filter(
          (userId) => !currentParticipantIds.has(userId)
        );

        if (removedUserIds.length > 0) {
          await deleteAttendanceForRemovedParticipants(tx, {
            rehearsal: existing,
            removedUserIds,
          });

          await tx.rehearsalParticipant.deleteMany({
            where: {
              rehearsalId: existing.id,
              userId: {
                in: removedUserIds,
              },
            },
          });
        }

        if (addedUserIds.length > 0) {
          await tx.rehearsalParticipant.createMany({
            data: addedUserIds.map((userId) => ({
              rehearsalId: existing.id,
              userId,
            })),
            skipDuplicates: true,
          });
        }

        continue;
      }

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
          participants: rehearsal.participantUserIds.length
            ? {
                createMany: {
                  data: rehearsal.participantUserIds.map((userId) => ({
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

    const rehearsalsToReplace = existingFutureRehearsals.filter(
      (rehearsal) => !matchedExistingIds.has(rehearsal.id)
    );

    for (const rehearsal of rehearsalsToReplace) {
      await auditAttendanceDiscardForRehearsal(tx, rehearsal);

      await tx.productionRehearsal.delete({
        where: {
          id: rehearsal.id,
        },
      });
    }

    if (clearSchedulingDrafts) {
      await tx.schedulingDraft.deleteMany({
        where: {
          productionId,
        },
      });
    }

    return createdRehearsals;
  });
}

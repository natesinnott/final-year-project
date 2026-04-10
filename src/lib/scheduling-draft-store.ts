import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeSchedulingDraftState,
  type SchedulingDraftState,
} from "@/lib/scheduling-draft";

export async function getSchedulingDraftState({
  productionId,
  userId,
}: {
  productionId: string;
  userId: string;
}): Promise<SchedulingDraftState | null> {
  const draft = await prisma.schedulingDraft.findUnique({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
    select: {
      id: true,
      selectedTimeZone: true,
      horizonStart: true,
      horizonEnd: true,
      blocks: true,
    },
  });

  if (!draft) {
    return null;
  }

  const normalized = normalizeSchedulingDraftState({
    selectedTimeZone: draft.selectedTimeZone,
    horizonStart: draft.horizonStart,
    horizonEnd: draft.horizonEnd,
    blocks: draft.blocks,
  });

  if (normalized) {
    return normalized;
  }

  console.error("Ignoring invalid scheduling draft payload.", {
    draftId: draft.id,
    productionId,
    userId,
  });

  return null;
}

export async function upsertSchedulingDraftState({
  productionId,
  userId,
  draft,
}: {
  productionId: string;
  userId: string;
  draft: SchedulingDraftState;
}) {
  const normalized = normalizeSchedulingDraftState(draft);

  if (!normalized) {
    throw new Error("Invalid scheduling draft payload.");
  }

  return prisma.schedulingDraft.upsert({
    where: {
      productionId_userId: {
        productionId,
        userId,
      },
    },
    create: {
      productionId,
      userId,
      selectedTimeZone: normalized.selectedTimeZone,
      horizonStart: normalized.horizonStart,
      horizonEnd: normalized.horizonEnd,
      blocks: normalized.blocks as Prisma.InputJsonValue,
    },
    update: {
      selectedTimeZone: normalized.selectedTimeZone,
      horizonStart: normalized.horizonStart,
      horizonEnd: normalized.horizonEnd,
      blocks: normalized.blocks as Prisma.InputJsonValue,
    },
    select: {
      updatedAt: true,
    },
  });
}

export async function deleteSchedulingDraftState({
  productionId,
  userId,
}: {
  productionId: string;
  userId: string;
}) {
  return prisma.schedulingDraft.deleteMany({
    where: {
      productionId,
      userId,
    },
  });
}

import {
  AttendanceAuditActorType,
  AttendanceAuditEvent,
  AttendanceStatus,
  Prisma,
  RehearsalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

type RehearsalAuditSnapshot = {
  productionId: string;
  rehearsalId: string;
  rehearsalTitle: string;
  rehearsalStart: Date;
  rehearsalEnd: Date;
};

function isFutureRehearsal(start: Date, referenceDate = new Date()) {
  return start.getTime() > referenceDate.getTime();
}

function hasStarted(start: Date, referenceDate = new Date()) {
  return start.getTime() <= referenceDate.getTime();
}

export function buildRehearsalReconciliationKey({
  title,
  start,
  end,
}: {
  title: string;
  start: Date;
  end: Date;
}) {
  return `${title.trim()}|${start.toISOString()}|${end.toISOString()}`;
}

function buildAuditSnapshot(rehearsal: {
  id: string;
  productionId: string;
  title: string;
  start: Date;
  end: Date;
}): RehearsalAuditSnapshot {
  return {
    productionId: rehearsal.productionId,
    rehearsalId: rehearsal.id,
    rehearsalTitle: rehearsal.title,
    rehearsalStart: rehearsal.start,
    rehearsalEnd: rehearsal.end,
  };
}

async function createAttendanceAudit(
  tx: DbClient,
  {
    rehearsal,
    subjectUserId,
    actorUserId,
    actorType,
    event,
    previousStatus,
    nextStatus,
    note,
  }: {
    rehearsal: RehearsalAuditSnapshot;
    subjectUserId: string;
    actorUserId?: string | null;
    actorType: AttendanceAuditActorType;
    event: AttendanceAuditEvent;
    previousStatus?: AttendanceStatus | null;
    nextStatus?: AttendanceStatus | null;
    note?: string | null;
  }
) {
  await tx.rehearsalAttendanceAudit.create({
    data: {
      productionId: rehearsal.productionId,
      rehearsalId: rehearsal.rehearsalId,
      rehearsalTitle: rehearsal.rehearsalTitle,
      rehearsalStart: rehearsal.rehearsalStart,
      rehearsalEnd: rehearsal.rehearsalEnd,
      subjectUserId,
      actorUserId: actorUserId ?? null,
      actorType,
      event,
      previousStatus: previousStatus ?? null,
      nextStatus: nextStatus ?? null,
      note: note ?? null,
    },
  });
}

async function findAttendanceMutationTarget(
  tx: DbClient,
  {
    productionId,
    rehearsalId,
    subjectUserId,
  }: {
    productionId: string;
    rehearsalId: string;
    subjectUserId: string;
  }
) {
  const rehearsal = await tx.productionRehearsal.findFirst({
    where: {
      id: rehearsalId,
      productionId,
      status: RehearsalStatus.PUBLISHED,
    },
    select: {
      id: true,
      productionId: true,
      title: true,
      start: true,
      end: true,
      participants: {
        where: {
          userId: subjectUserId,
        },
        select: {
          userId: true,
        },
      },
      attendance: {
        where: {
          userId: subjectUserId,
        },
        select: {
          id: true,
          status: true,
          note: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!rehearsal) {
    return null;
  }

  return {
    rehearsal,
    isCalledUser: rehearsal.participants.length > 0,
    attendance: rehearsal.attendance[0] ?? null,
    auditSnapshot: buildAuditSnapshot(rehearsal),
  };
}

export async function selfReportAbsence({
  productionId,
  rehearsalId,
  userId,
  note,
}: {
  productionId: string;
  rehearsalId: string;
  userId: string;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await findAttendanceMutationTarget(tx, {
      productionId,
      rehearsalId,
      subjectUserId: userId,
    });

    if (!target || !target.isCalledUser) {
      return { ok: false as const, status: 404, error: "Rehearsal not found." };
    }

    if (!isFutureRehearsal(target.rehearsal.start)) {
      return {
        ok: false as const,
        status: 409,
        error: "You can only report absence before the rehearsal starts.",
      };
    }

    if (target.attendance?.status === AttendanceStatus.NO_SHOW) {
      return {
        ok: false as const,
        status: 409,
        error: "Staff attendance decisions cannot be overridden here.",
      };
    }

    const nextNote = note?.trim() || null;
    const previousStatus = target.attendance?.status ?? AttendanceStatus.PRESENT;
    const previousNote = target.attendance?.note ?? null;

    if (
      previousStatus === AttendanceStatus.REPORTED_ABSENT &&
      previousNote === nextNote &&
      target.attendance
    ) {
      return {
        ok: true as const,
        attendance: target.attendance,
      };
    }

    const attendance = target.attendance
      ? await tx.rehearsalAttendance.update({
          where: {
            rehearsalId_userId: {
              rehearsalId,
              userId,
            },
          },
          data: {
            status: AttendanceStatus.REPORTED_ABSENT,
            note: nextNote,
            updatedById: userId,
          },
        })
      : await tx.rehearsalAttendance.create({
          data: {
            rehearsalId,
            userId,
            status: AttendanceStatus.REPORTED_ABSENT,
            note: nextNote,
            createdById: userId,
            updatedById: userId,
          },
        });

    if (previousStatus !== AttendanceStatus.REPORTED_ABSENT) {
      await createAttendanceAudit(tx, {
        rehearsal: target.auditSnapshot,
        subjectUserId: userId,
        actorUserId: userId,
        actorType: AttendanceAuditActorType.USER,
        event: AttendanceAuditEvent.SELF_REPORTED_ABSENT,
        previousStatus,
        nextStatus: AttendanceStatus.REPORTED_ABSENT,
        note: nextNote,
      });
    } else if (previousNote !== nextNote) {
      await createAttendanceAudit(tx, {
        rehearsal: target.auditSnapshot,
        subjectUserId: userId,
        actorUserId: userId,
        actorType: AttendanceAuditActorType.USER,
        event: AttendanceAuditEvent.UPDATED_ABSENCE_NOTE,
        previousStatus: AttendanceStatus.REPORTED_ABSENT,
        nextStatus: AttendanceStatus.REPORTED_ABSENT,
        note: nextNote,
      });
    }

    return {
      ok: true as const,
      attendance,
    };
  });
}

export async function clearSelfReportedAbsence({
  productionId,
  rehearsalId,
  userId,
}: {
  productionId: string;
  rehearsalId: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await findAttendanceMutationTarget(tx, {
      productionId,
      rehearsalId,
      subjectUserId: userId,
    });

    if (!target || !target.isCalledUser) {
      return { ok: false as const, status: 404, error: "Rehearsal not found." };
    }

    if (!isFutureRehearsal(target.rehearsal.start)) {
      return {
        ok: false as const,
        status: 409,
        error: "You can only edit attendance before the rehearsal starts.",
      };
    }

    if (!target.attendance) {
      return {
        ok: true as const,
        attendance: null,
      };
    }

    if (target.attendance.status !== AttendanceStatus.REPORTED_ABSENT) {
      return {
        ok: true as const,
        attendance: target.attendance,
      };
    }

    await tx.rehearsalAttendance.delete({
      where: {
        rehearsalId_userId: {
          rehearsalId,
          userId,
        },
      },
    });

    await createAttendanceAudit(tx, {
      rehearsal: target.auditSnapshot,
      subjectUserId: userId,
      actorUserId: userId,
      actorType: AttendanceAuditActorType.USER,
      event: AttendanceAuditEvent.CLEARED_TO_PRESENT,
      previousStatus: AttendanceStatus.REPORTED_ABSENT,
      nextStatus: AttendanceStatus.PRESENT,
    });

    return {
      ok: true as const,
      attendance: null,
    };
  });
}

export async function staffMarkNoShow({
  productionId,
  rehearsalId,
  subjectUserId,
  actorUserId,
}: {
  productionId: string;
  rehearsalId: string;
  subjectUserId: string;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await findAttendanceMutationTarget(tx, {
      productionId,
      rehearsalId,
      subjectUserId,
    });

    if (!target || !target.isCalledUser) {
      return { ok: false as const, status: 404, error: "Rehearsal not found." };
    }

    if (!hasStarted(target.rehearsal.start)) {
      return {
        ok: false as const,
        status: 409,
        error: "No-shows can only be marked once the rehearsal has started.",
      };
    }

    if (target.attendance?.status === AttendanceStatus.REPORTED_ABSENT) {
      return {
        ok: false as const,
        status: 409,
        error: "Reported absences must be cleared before marking a no-show.",
      };
    }

    const previousStatus = target.attendance?.status ?? AttendanceStatus.PRESENT;

    if (previousStatus === AttendanceStatus.NO_SHOW && target.attendance) {
      return {
        ok: true as const,
        attendance: target.attendance,
      };
    }

    const attendance = target.attendance
      ? await tx.rehearsalAttendance.update({
          where: {
            rehearsalId_userId: {
              rehearsalId,
              userId: subjectUserId,
            },
          },
          data: {
            status: AttendanceStatus.NO_SHOW,
            note: null,
            updatedById: actorUserId,
          },
        })
      : await tx.rehearsalAttendance.create({
          data: {
            rehearsalId,
            userId: subjectUserId,
            status: AttendanceStatus.NO_SHOW,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        });

    await createAttendanceAudit(tx, {
      rehearsal: target.auditSnapshot,
      subjectUserId,
      actorUserId,
      actorType: AttendanceAuditActorType.STAFF,
      event: AttendanceAuditEvent.MARKED_NO_SHOW,
      previousStatus,
      nextStatus: AttendanceStatus.NO_SHOW,
    });

    return {
      ok: true as const,
      attendance,
    };
  });
}

export async function staffClearAttendance({
  productionId,
  rehearsalId,
  subjectUserId,
  actorUserId,
}: {
  productionId: string;
  rehearsalId: string;
  subjectUserId: string;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await findAttendanceMutationTarget(tx, {
      productionId,
      rehearsalId,
      subjectUserId,
    });

    if (!target || !target.isCalledUser) {
      return { ok: false as const, status: 404, error: "Rehearsal not found." };
    }

    if (!target.attendance) {
      return {
        ok: true as const,
        attendance: null,
      };
    }

    await tx.rehearsalAttendance.delete({
      where: {
        rehearsalId_userId: {
          rehearsalId,
          userId: subjectUserId,
        },
      },
    });

    if (target.attendance.status !== AttendanceStatus.PRESENT) {
      await createAttendanceAudit(tx, {
        rehearsal: target.auditSnapshot,
        subjectUserId,
        actorUserId,
        actorType: AttendanceAuditActorType.STAFF,
        event: AttendanceAuditEvent.CLEARED_TO_PRESENT,
        previousStatus: target.attendance.status,
        nextStatus: AttendanceStatus.PRESENT,
      });
    }

    return {
      ok: true as const,
      attendance: null,
    };
  });
}

export async function deleteAttendanceForRemovedParticipants(
  tx: DbClient,
  {
    rehearsal,
    removedUserIds,
  }: {
    rehearsal: {
      id: string;
      productionId: string;
      title: string;
      start: Date;
      end: Date;
    };
    removedUserIds: string[];
  }
) {
  if (removedUserIds.length === 0) {
    return;
  }

  const existingAttendance = await tx.rehearsalAttendance.findMany({
    where: {
      rehearsalId: rehearsal.id,
      userId: {
        in: removedUserIds,
      },
    },
    select: {
      userId: true,
      status: true,
      note: true,
    },
  });

  const auditSnapshot = buildAuditSnapshot(rehearsal);

  for (const row of existingAttendance) {
    await createAttendanceAudit(tx, {
      rehearsal: auditSnapshot,
      subjectUserId: row.userId,
      actorType: AttendanceAuditActorType.SYSTEM,
      event: AttendanceAuditEvent.DELETED_ON_PARTICIPANT_REMOVAL,
      previousStatus: row.status,
      note: row.note,
    });
  }

  await tx.rehearsalAttendance.deleteMany({
    where: {
      rehearsalId: rehearsal.id,
      userId: {
        in: removedUserIds,
      },
    },
  });
}

export async function auditAttendanceDiscardForRehearsal(
  tx: DbClient,
  rehearsal: {
    id: string;
    productionId: string;
    title: string;
    start: Date;
    end: Date;
  }
) {
  const attendanceRows = await tx.rehearsalAttendance.findMany({
    where: {
      rehearsalId: rehearsal.id,
    },
    select: {
      userId: true,
      status: true,
      note: true,
    },
  });

  const auditSnapshot = buildAuditSnapshot(rehearsal);

  for (const row of attendanceRows) {
    await createAttendanceAudit(tx, {
      rehearsal: auditSnapshot,
      subjectUserId: row.userId,
      actorType: AttendanceAuditActorType.SYSTEM,
      event: AttendanceAuditEvent.DISCARDED_ON_REHEARSAL_REPLACEMENT,
      previousStatus: row.status,
      note: row.note,
    });
  }
}

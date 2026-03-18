import { AttendanceStatus, Prisma, RehearsalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTodayUtcRange } from "@/lib/availabilityTime";

const NON_PRESENT_STATUSES = [
  AttendanceStatus.REPORTED_ABSENT,
  AttendanceStatus.NO_SHOW,
] as const;

export type VisibleRehearsalAttendanceSummary = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calledUserCount: number;
  absentCount: number;
  noShowCount: number;
  myStatus: AttendanceStatus;
};

export type RehearsalAttendanceRosterEntry = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: AttendanceStatus;
  note: string | null;
  hasExplicitRow: boolean;
};

export type RehearsalAttendanceDetailBase = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  productionId: string;
  calledUserCount: number;
};

export type SelfRehearsalAttendanceState = {
  myStatus: AttendanceStatus;
  myNote: string | null;
  isCalledUser: boolean;
  canSelfReport: boolean;
};

export type SelfRehearsalAttendanceDetail = RehearsalAttendanceDetailBase &
  SelfRehearsalAttendanceState;

export type StaffRehearsalAttendanceDetail = RehearsalAttendanceDetailBase & {
  roster: RehearsalAttendanceRosterEntry[];
};

export type TodayAttendanceBlock = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  calledUserCount: number;
  roster: RehearsalAttendanceRosterEntry[];
};

export type AttendanceReportRow = {
  attendanceId: string;
  rehearsalId: string;
  rehearsalTitle: string;
  rehearsalStart: Date;
  rehearsalEnd: Date;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  status: "REPORTED_ABSENT" | "NO_SHOW";
  note: string | null;
  updatedAt: Date;
};

const ROSTER_REHEARSAL_SELECT =
  Prisma.validator<Prisma.ProductionRehearsalSelect>()({
    participants: {
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: "asc",
        },
      },
    },
    attendance: {
      select: {
        userId: true,
        status: true,
        note: true,
      },
    },
    production: {
      select: {
        members: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    },
  });

type RosterBackedRehearsal = Prisma.ProductionRehearsalGetPayload<{
  select: typeof ROSTER_REHEARSAL_SELECT;
}>;

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

function isFutureRehearsal(start: Date, referenceDate = new Date()) {
  return start.getTime() > referenceDate.getTime();
}

export function getEffectiveAttendanceStatus(
  attendance: { status: AttendanceStatus } | null | undefined
) {
  return attendance?.status ?? AttendanceStatus.PRESENT;
}

function mapRosterEntries(rehearsal: RosterBackedRehearsal) {
  const attendanceByUser = new Map(
    rehearsal.attendance.map((entry) => [entry.userId, entry])
  );
  const roleByUser = new Map(
    rehearsal.production.members.map((member) => [member.userId, member.role])
  );

  return rehearsal.participants
    .map((participant) => {
      const attendance = attendanceByUser.get(participant.userId);

      return {
        userId: participant.userId,
        name: participant.user.name,
        email: participant.user.email,
        role: roleByUser.get(participant.userId) ?? "MEMBER",
        status: getEffectiveAttendanceStatus(attendance),
        note: attendance?.note ?? null,
        hasExplicitRow: Boolean(attendance),
      } satisfies RehearsalAttendanceRosterEntry;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getVisiblePublishedRehearsals({
  productionId,
  userId,
  canViewAll,
}: {
  productionId: string;
  userId: string;
  canViewAll: boolean;
}) {
  const rehearsals = await prisma.productionRehearsal.findMany({
    where: {
      productionId,
      status: RehearsalStatus.PUBLISHED,
      ...getPublishedRehearsalVisibilityFilter(userId, canViewAll),
    },
    orderBy: {
      start: "asc",
    },
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
      participants: {
        select: {
          userId: true,
        },
      },
      attendance: {
        where: canViewAll ? undefined : { userId },
        select: {
          userId: true,
          status: true,
        },
      },
    },
  });

  const flagsByRehearsal = new Map<string, { absentCount: number; noShowCount: number }>();

  if (canViewAll) {
    const flaggedAttendance = await prisma.rehearsalAttendance.findMany({
      where: {
        status: {
          in: [...NON_PRESENT_STATUSES],
        },
        rehearsal: {
          productionId,
          status: RehearsalStatus.PUBLISHED,
        },
      },
      select: {
        rehearsalId: true,
        status: true,
      },
    });

    for (const row of flaggedAttendance) {
      const existing = flagsByRehearsal.get(row.rehearsalId) ?? {
        absentCount: 0,
        noShowCount: 0,
      };

      if (row.status === AttendanceStatus.REPORTED_ABSENT) {
        existing.absentCount += 1;
      }

      if (row.status === AttendanceStatus.NO_SHOW) {
        existing.noShowCount += 1;
      }

      flagsByRehearsal.set(row.rehearsalId, existing);
    }
  }

  return rehearsals.map((rehearsal) => {
    const counts = flagsByRehearsal.get(rehearsal.id) ?? {
      absentCount: 0,
      noShowCount: 0,
    };

    return {
      id: rehearsal.id,
      title: rehearsal.title,
      start: rehearsal.start,
      end: rehearsal.end,
      calledUserCount: rehearsal.participants.length,
      absentCount: counts.absentCount,
      noShowCount: counts.noShowCount,
      myStatus: getEffectiveAttendanceStatus(
        rehearsal.attendance.find((entry) => entry.userId === userId)
      ),
    } satisfies VisibleRehearsalAttendanceSummary;
  });
}

export async function getSelfRehearsalAttendanceDetail({
  productionId,
  rehearsalId,
  userId,
}: {
  productionId: string;
  rehearsalId: string;
  userId: string;
}) {
  const rehearsal = await prisma.productionRehearsal.findFirst({
    where: {
      id: rehearsalId,
      productionId,
      status: RehearsalStatus.PUBLISHED,
      ...getPublishedRehearsalVisibilityFilter(userId, false),
    },
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
      productionId: true,
      participants: {
        where: {
          userId,
        },
        select: {
          userId: true,
        },
      },
      attendance: {
        where: {
          userId,
        },
        select: {
          status: true,
          note: true,
        },
      },
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  if (!rehearsal) {
    return null;
  }

  const ownAttendance = rehearsal.attendance[0] ?? null;

  return {
    id: rehearsal.id,
    title: rehearsal.title,
    start: rehearsal.start,
    end: rehearsal.end,
    productionId: rehearsal.productionId,
    calledUserCount: rehearsal._count.participants,
    myStatus: getEffectiveAttendanceStatus(ownAttendance),
    myNote: ownAttendance?.note ?? null,
    isCalledUser: rehearsal.participants.length > 0,
    canSelfReport:
      rehearsal.participants.length > 0 && isFutureRehearsal(rehearsal.start),
  } satisfies SelfRehearsalAttendanceDetail;
}

export async function getStaffRehearsalAttendanceDetail({
  productionId,
  rehearsalId,
}: {
  productionId: string;
  rehearsalId: string;
}) {
  const rehearsal = await prisma.productionRehearsal.findFirst({
    where: {
      id: rehearsalId,
      productionId,
      status: RehearsalStatus.PUBLISHED,
    },
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
      productionId: true,
      _count: {
        select: {
          participants: true,
        },
      },
      ...ROSTER_REHEARSAL_SELECT,
    },
  });

  if (!rehearsal) {
    return null;
  }

  return {
    id: rehearsal.id,
    title: rehearsal.title,
    start: rehearsal.start,
    end: rehearsal.end,
    productionId: rehearsal.productionId,
    calledUserCount: rehearsal._count.participants,
    roster: mapRosterEntries(rehearsal),
  } satisfies StaffRehearsalAttendanceDetail;
}

export async function getTodayAttendanceBlocks({
  productionId,
  productionTimeZone,
}: {
  productionId: string;
  productionTimeZone: string;
}) {
  const todayRange = getTodayUtcRange(productionTimeZone);
  if (!todayRange) {
    return [] as TodayAttendanceBlock[];
  }

  const rehearsals = await prisma.productionRehearsal.findMany({
    where: {
      productionId,
      status: RehearsalStatus.PUBLISHED,
      start: {
        lt: todayRange.endUtc,
      },
      end: {
        gt: todayRange.startUtc,
      },
    },
    orderBy: {
      start: "asc",
    },
    select: {
      id: true,
      title: true,
      start: true,
      end: true,
      ...ROSTER_REHEARSAL_SELECT,
    },
  });

  return rehearsals.map((rehearsal) => ({
    id: rehearsal.id,
    title: rehearsal.title,
    start: rehearsal.start,
    end: rehearsal.end,
    calledUserCount: rehearsal.participants.length,
    roster: mapRosterEntries(rehearsal),
  }));
}

export async function getProductionAttendanceReport(productionId: string) {
  const rows = await prisma.rehearsalAttendance.findMany({
    where: {
      status: {
        in: [...NON_PRESENT_STATUSES],
      },
      rehearsal: {
        productionId,
        status: RehearsalStatus.PUBLISHED,
      },
    },
    orderBy: [
      {
        rehearsal: {
          start: "desc",
        },
      },
      {
        user: {
          name: "asc",
        },
      },
    ],
    select: {
      id: true,
      status: true,
      note: true,
      updatedAt: true,
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      rehearsal: {
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          production: {
            select: {
              members: {
                select: {
                  userId: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    attendanceId: row.id,
    rehearsalId: row.rehearsal.id,
    rehearsalTitle: row.rehearsal.title,
    rehearsalStart: row.rehearsal.start,
    rehearsalEnd: row.rehearsal.end,
    userId: row.userId,
    userName: row.user.name,
    userEmail: row.user.email,
    userRole:
      row.rehearsal.production.members.find((member) => member.userId === row.userId)?.role ??
      "MEMBER",
    status: row.status,
    note: row.note,
    updatedAt: row.updatedAt,
  })) as AttendanceReportRow[];
}

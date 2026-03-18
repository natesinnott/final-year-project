import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidTimeZone } from "@/lib/availabilityTime";
import { canAccessProductionScheduling } from "@/lib/scheduler-access";
import { publishProductionRehearsals } from "@/lib/rehearsals";

type RouteParams = {
  params: Promise<{ productionId: string }>;
};

type PublishBlock = {
  id?: string;
  label?: string;
  required_people_ids?: string[];
};

type PublishPlacement = {
  block_id?: string;
  blockId?: string;
  start?: string;
  end?: string;
};

type PublishRehearsalsPayload = {
  horizon_start?: string;
  horizon_end?: string;
  time_zone?: string;
  solve_run_id?: string | null;
  solver_status?: string;
  blocks?: PublishBlock[];
  placements?: PublishPlacement[];
};

const PUBLISHABLE_SOLVER_STATUSES = new Set(["OPTIMAL", "FEASIBLE"]);

function parseIsoDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = await params;
  const canAccess = await canAccessProductionScheduling(userId, productionId);

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: PublishRehearsalsPayload;
  try {
    payload = (await request.json()) as PublishRehearsalsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const horizonStart = parseIsoDate(payload.horizon_start);
  const horizonEnd = parseIsoDate(payload.horizon_end);
  const timeZone = payload.time_zone?.trim();

  if (!horizonStart || !horizonEnd || horizonEnd <= horizonStart) {
    return NextResponse.json(
      { error: "Invalid publish horizon." },
      { status: 400 }
    );
  }

  if (!timeZone || !isValidTimeZone(timeZone)) {
    return NextResponse.json(
      { error: "Choose a valid scheduling time zone before publishing." },
      { status: 400 }
    );
  }

  if (!payload.solver_status || !PUBLISHABLE_SOLVER_STATUSES.has(payload.solver_status)) {
    return NextResponse.json(
      { error: "Only feasible solver results can be published." },
      { status: 400 }
    );
  }

  const blocks = payload.blocks ?? [];
  const placements = payload.placements ?? [];

  if (blocks.length === 0 || placements.length === 0) {
    return NextResponse.json(
      { error: "There are no scheduled rehearsals to publish." },
      { status: 400 }
    );
  }

  const members = await prisma.productionMember.findMany({
    where: { productionId },
    select: { userId: true },
  });
  const memberUserIds = new Set(members.map((member) => member.userId));

  const blockMap = new Map<
    string,
    {
      label: string;
      requiredPeopleIds: string[];
    }
  >();

  for (const block of blocks) {
    const blockId = block.id?.trim();
    const label = block.label?.trim();
    const requiredPeopleIds = (block.required_people_ids ?? []).filter(Boolean);

    if (!blockId || !label) {
      return NextResponse.json(
        { error: "Each published block must include an id and label." },
        { status: 400 }
      );
    }

    if (blockMap.has(blockId)) {
      return NextResponse.json(
        { error: `Duplicate block id "${blockId}" in publish payload.` },
        { status: 400 }
      );
    }

    const unknownPeople = requiredPeopleIds.filter((participantId) => !memberUserIds.has(participantId));
    if (unknownPeople.length > 0) {
      return NextResponse.json(
        { error: `Block "${label}" references unknown production members.` },
        { status: 400 }
      );
    }

    blockMap.set(blockId, {
      label,
      requiredPeopleIds,
    });
  }

  const seenPlacementBlockIds = new Set<string>();
  const rehearsalsToCreate = [];

  for (const placement of placements) {
    const blockId = placement.block_id?.trim() || placement.blockId?.trim();
    const start = parseIsoDate(placement.start);
    const end = parseIsoDate(placement.end);

    if (!blockId || !start || !end || end <= start) {
      return NextResponse.json(
        { error: "Each published placement must include a valid block id, start, and end." },
        { status: 400 }
      );
    }

    if (start < horizonStart || end > horizonEnd) {
      return NextResponse.json(
        { error: "Published placements must fall within the scheduling horizon." },
        { status: 400 }
      );
    }

    if (seenPlacementBlockIds.has(blockId)) {
      return NextResponse.json(
        { error: `Block "${blockId}" appears more than once in the published placements.` },
        { status: 400 }
      );
    }

    const block = blockMap.get(blockId);
    if (!block) {
      return NextResponse.json(
        { error: `Published placement references unknown block "${blockId}".` },
        { status: 400 }
      );
    }

    seenPlacementBlockIds.add(blockId);
    rehearsalsToCreate.push({
      title: block.label,
      start,
      end,
      participantUserIds: block.requiredPeopleIds,
    });
  }

  let created;
  try {
    created = await publishProductionRehearsals({
      productionId,
      createdById: userId,
      timeZone,
      solveRunId: payload.solve_run_id ?? null,
      sourceMetadata: {
        solverStatus: payload.solver_status,
        source: "schedule-page",
        timeZone,
      },
      horizonStart,
      horizonEnd,
      rehearsals: rehearsalsToCreate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to publish rehearsals.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    created_count: created.length,
    time_zone: timeZone,
    rehearsals: created.map((rehearsal) => ({
      id: rehearsal.id,
      title: rehearsal.title,
      start: rehearsal.start.toISOString(),
      end: rehearsal.end.toISOString(),
      status: rehearsal.status,
    })),
  });
}

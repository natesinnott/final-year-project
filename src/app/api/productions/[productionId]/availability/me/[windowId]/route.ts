import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityAccessContext } from "@/lib/availability-access";
import {
  findOverlappingAvailabilityWindow,
  parseAvailabilityKind,
  parseUtcDate,
} from "@/lib/availability";

type RouteParams = {
  params: Promise<{ productionId: string; windowId: string }>;
};

type UpdateWindowPayload = {
  start?: string;
  end?: string;
  kind?: string;
};

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId, windowId } = await params;
  const access = await getAvailabilityAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.availabilityWindow.findFirst({
    where: {
      id: windowId,
      productionId,
      userId,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Availability window not found" }, { status: 404 });
  }

  let payload: UpdateWindowPayload;
  try {
    payload = (await request.json()) as UpdateWindowPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const start = parseUtcDate(payload.start);
  const end = parseUtcDate(payload.end);
  const kind = parseAvailabilityKind(payload.kind ?? existing.kind);

  if (!start || !end || !kind) {
    return NextResponse.json(
      { error: "Invalid start/end/kind values" },
      { status: 400 }
    );
  }

  if (end <= start) {
    return NextResponse.json(
      { error: "Availability end must be after start" },
      { status: 400 }
    );
  }

  const overlapping = await findOverlappingAvailabilityWindow({
    productionId,
    userId,
    start,
    end,
    excludeWindowId: windowId,
  });

  if (overlapping) {
    return NextResponse.json(
      { error: "Availability window overlaps an existing window" },
      { status: 409 }
    );
  }

  const updated = await prisma.availabilityWindow.update({
    where: {
      id: windowId,
    },
    data: {
      start,
      end,
      kind,
    },
  });

  return NextResponse.json({
    id: updated.id,
    start: updated.start.toISOString(),
    end: updated.end.toISOString(),
    kind: updated.kind,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId, windowId } = await params;
  const access = await getAvailabilityAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.availabilityWindow.findFirst({
    where: {
      id: windowId,
      productionId,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Availability window not found" }, { status: 404 });
  }

  await prisma.availabilityWindow.delete({
    where: {
      id: windowId,
    },
  });

  return NextResponse.json({ ok: true });
}

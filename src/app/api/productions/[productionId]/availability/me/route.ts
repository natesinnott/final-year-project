import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityAccessContext } from "@/lib/availability-access";
import {
  findOverlappingAvailabilityWindow,
  parseUtcDate,
} from "@/lib/availability";

type RouteParams = {
  params: Promise<{ productionId: string }>;
};

type CreateWindowPayload = {
  start?: string;
  end?: string;
};

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = await params;
  const access = await getAvailabilityAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [windows, productionMember] = await Promise.all([
    prisma.availabilityWindow.findMany({
      where: {
        productionId,
        userId,
      },
      orderBy: {
        start: "asc",
      },
    }),
    prisma.productionMember.findUnique({
      where: {
        productionId_userId: {
          productionId,
          userId,
        },
      },
      select: {
        conflictsSubmittedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    submittedAt: productionMember?.conflictsSubmittedAt?.toISOString() ?? null,
    windows: windows.map((window) => ({
      id: window.id,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      createdAt: window.createdAt.toISOString(),
      updatedAt: window.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productionId } = await params;
  const access = await getAvailabilityAccessContext(userId, productionId);

  if (!access) {
    return NextResponse.json({ error: "Production not found" }, { status: 404 });
  }

  if (!access.isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CreateWindowPayload;
  try {
    payload = (await request.json()) as CreateWindowPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const start = parseUtcDate(payload.start);
  const end = parseUtcDate(payload.end);

  if (!start || !end) {
    return NextResponse.json(
      { error: "Invalid start/end values" },
      { status: 400 }
    );
  }

  if (end <= start) {
    return NextResponse.json(
      { error: "Conflict end must be after start" },
      { status: 400 }
    );
  }

  const overlapping = await findOverlappingAvailabilityWindow({
    productionId,
    userId,
    start,
    end,
  });

  if (overlapping) {
    return NextResponse.json(
      { error: "Conflict overlaps an existing conflict" },
      { status: 409 }
    );
  }

  const submittedAt = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const window = await tx.availabilityWindow.create({
      data: {
        productionId,
        userId,
        start,
        end,
        kind: "UNAVAILABLE",
      },
    });

    await tx.productionMember.updateMany({
      where: {
        productionId,
        userId,
      },
      data: {
        conflictsSubmittedAt: submittedAt,
      },
    });

    return window;
  });

  return NextResponse.json(
    {
      id: created.id,
      start: created.start.toISOString(),
      end: created.end.toISOString(),
      submittedAt: submittedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    { status: 201 }
  );
}

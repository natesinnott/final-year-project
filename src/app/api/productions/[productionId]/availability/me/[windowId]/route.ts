import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityAccessContext } from "@/lib/availability-access";

type RouteParams = {
  params: Promise<{ productionId: string; windowId: string }>;
};

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

  const submittedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.availabilityWindow.delete({
      where: {
        id: windowId,
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
  });

  return NextResponse.json({ ok: true, submittedAt: submittedAt.toISOString() });
}

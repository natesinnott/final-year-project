import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXPIRED_ERROR = "Invite is no longer valid.";

type AcceptInvitePayload = {
  token?: string;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as AcceptInvitePayload;
  const token = payload.token?.trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const invite = await prisma.productionInvite.findUnique({
    where: { token },
    include: { production: true },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: EXPIRED_ERROR }, { status: 410 });
  }

  if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
    return NextResponse.json({ error: EXPIRED_ERROR }, { status: 410 });
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.productionMember.findFirst({
      where: { userId, productionId: invite.productionId },
    });

    if (!existing) {
      await tx.productionMember.create({
        data: {
          userId,
          productionId: invite.productionId,
          role: invite.role,
        },
      });
    }

    const membership = await tx.membership.findFirst({
      where: { userId, organisationId: invite.production.organisationId },
    });

    if (!membership) {
      await tx.membership.create({
        data: {
          userId,
          organisationId: invite.production.organisationId,
          role: "MEMBER",
        },
      });
    }

    await tx.productionInvite.update({
      where: { id: invite.id },
      data: {
        uses: { increment: 1 },
      },
    });
  });

  return NextResponse.json({ productionId: invite.productionId });
}

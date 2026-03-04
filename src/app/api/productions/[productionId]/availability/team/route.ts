import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityAccessContext } from "@/lib/availability-access";
import { getAvailabilityCompleteness } from "@/lib/availability";

type RouteParams = {
  params: Promise<{ productionId: string }>;
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

  if (!access.isDirectorRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [members, windows, completeness] = await Promise.all([
    prisma.productionMember.findMany({
      where: { productionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.availabilityWindow.findMany({
      where: { productionId },
      orderBy: [{ userId: "asc" }, { start: "asc" }],
    }),
    getAvailabilityCompleteness(productionId),
  ]);

  const windowsByUser = new Map<string, typeof windows>();
  for (const window of windows) {
    const existing = windowsByUser.get(window.userId);
    if (existing) {
      existing.push(window);
    } else {
      windowsByUser.set(window.userId, [window]);
    }
  }

  return NextResponse.json({
    members: members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      windows: (windowsByUser.get(member.userId) ?? []).map((window) => ({
        id: window.id,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        kind: window.kind,
      })),
    })),
    completeness: {
      is_complete: completeness.isComplete,
      total_members: completeness.totalMembers,
      required_members: completeness.requiredMembers,
      submitted_members: completeness.submittedMembers,
      missing_members: completeness.missingMembers,
    },
  });
}

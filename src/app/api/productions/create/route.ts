import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CreateProductionPayload = {
  name?: string;
  description?: string;
  rehearsalStart?: string;
  rehearsalEnd?: string;
  venue?: string;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only org admins can create productions.
  const membership = await prisma.membership.findFirst({
    where: { userId, role: "ADMIN" },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as CreateProductionPayload;
  const name = payload.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Production name is required." }, { status: 400 });
  }

  // Create production and seed the creator as a director.
  const production = await prisma.production.create({
    data: {
      name,
      description: payload.description?.trim() || null,
      rehearsalStart: payload.rehearsalStart
        ? new Date(payload.rehearsalStart)
        : null,
      rehearsalEnd: payload.rehearsalEnd ? new Date(payload.rehearsalEnd) : null,
      venue: payload.venue?.trim() || null,
      directorRoles: ["DIRECTOR"],
      organisationId: membership.organisationId,
      members: {
        create: {
          userId,
          role: "DIRECTOR",
        },
      },
    },
  });

  return NextResponse.json({ productionId: production.id });
}

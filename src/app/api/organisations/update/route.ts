import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Updates organisation profile details (admin-only).
type UpdatePayload = {
  name?: string;
  primaryLocation?: string;
  description?: string;
  contactEmail?: string;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as UpdatePayload;
  const name = payload.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, role: "ADMIN" },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organisation = await prisma.organisation.update({
    where: { id: membership.organisationId },
    data: {
      name,
      primaryLocation: payload.primaryLocation?.trim() || null,
      description: payload.description?.trim() || null,
      contactEmail: payload.contactEmail?.trim() || null,
    },
  });

  return NextResponse.json({ organisationId: organisation.id });
}

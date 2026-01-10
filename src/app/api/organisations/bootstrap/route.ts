import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Creates the first organisation for a user and assigns them as ADMIN.
type BootstrapPayload = {
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

  const existingMembership = await prisma.membership.findFirst({
    where: { userId },
  });

  // Prevent multiple orgs per user in the current onboarding flow.
  if (existingMembership) {
    return NextResponse.json(
      { error: "User already belongs to an organisation." },
      { status: 409 }
    );
  }

  const payload = (await request.json()) as BootstrapPayload;
  const name = payload.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Organisation name is required." }, { status: 400 });
  }

  const organisation = await prisma.organisation.create({
    data: {
      name,
      primaryLocation: payload.primaryLocation?.trim() || null,
      description: payload.description?.trim() || null,
      contactEmail: payload.contactEmail?.trim() || null,
      memberships: {
        create: {
          userId,
          role: "ADMIN",
        },
      },
    },
  });

  return NextResponse.json({ organisationId: organisation.id });
}

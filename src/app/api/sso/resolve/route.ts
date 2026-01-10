import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ResolvePayload = {
  email?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json()) as ResolvePayload;
  const email = payload.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  const orgDomain = await prisma.organisationDomain.findUnique({
    where: { domain },
    include: {
      organisation: {
        include: { ssoConfig: true },
      },
    },
  });

  const config = orgDomain?.organisation?.ssoConfig;
  if (!config || !config.enabled) {
    return NextResponse.json({ providerId: null });
  }

  let providerId: string | null = null;
  if (config.provider === "ENTRA") {
    providerId = `entra-${config.id}`;
  } else if (config.provider === "OKTA") {
    providerId = `okta-${config.id}`;
  } else if (config.provider === "GOOGLE_WORKSPACE") {
    providerId = `google-workspace-${config.id}`;
  }

  return NextResponse.json({ providerId });
}

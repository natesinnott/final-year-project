import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Resolves an email domain to the configured SSO providerId (if any).
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

  // Match the email domain to an organisation's SSO config.
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

  // Provider IDs must match those generated in auth.ts.
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

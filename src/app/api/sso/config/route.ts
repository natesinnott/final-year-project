import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { SsoProvider } from "@prisma/client";

// Admin-only endpoint to save/read organisation SSO configuration and domain routing.
type ConfigPayload = {
  provider?: "ENTRA" | "OKTA" | "GOOGLE_WORKSPACE";
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  tenantId?: string;
  domains?: string[];
  enabled?: boolean;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, role: "ADMIN" },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as ConfigPayload;

  // Guard required fields before encrypting secrets.
  if (!payload.provider || !payload.clientId || !payload.clientSecret) {
    return NextResponse.json(
      { error: "Provider, clientId, and clientSecret are required." },
      { status: 400 }
    );
  }
  const provider = payload.provider as SsoProvider;
  const clientId = payload.clientId.trim();
  const clientSecret = payload.clientSecret.trim();
  if (!clientSecret) {
    return NextResponse.json(
      { error: "Client secret is required." },
      { status: 400 }
    );
  }
  if (!clientId) {
    return NextResponse.json({ error: "Client ID is required." }, { status: 400 });
  }

  // Normalize domains for deterministic matching.
  const domains = (payload.domains ?? [])
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (domains.length === 0) {
    return NextResponse.json({ error: "At least one domain is required." }, { status: 400 });
  }

  const organisationId = membership.organisationId;

  // Update the SSO config and overwrite domain mappings in a single transaction.
  await prisma.$transaction(async (tx) => {
    const encryptedSecret = encryptSecret(clientSecret);
    await tx.organisationSsoConfig.upsert({
      where: { organisationId },
      create: {
        organisationId,
        provider,
        clientId,
        clientSecret: encryptedSecret,
        issuer: payload.issuer?.trim() || null,
        tenantId: payload.tenantId?.trim() || null,
        enabled: payload.enabled ?? true,
      },
      update: {
        provider,
        clientId,
        clientSecret: encryptedSecret,
        issuer: payload.issuer?.trim() || null,
        tenantId: payload.tenantId?.trim() || null,
        enabled: payload.enabled ?? true,
      },
    });

    // Replace existing domain entries to keep routing deterministic.
    await tx.organisationDomain.deleteMany({
      where: { organisationId },
    });

    if (domains.length > 0) {
      await tx.organisationDomain.createMany({
        data: domains.map((domain) => ({
          domain,
          organisationId,
        })),
        skipDuplicates: true,
      });
    }
  });

  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, role: "ADMIN" },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: membership.organisationId },
    include: {
      ssoConfig: true,
      domains: true,
    },
  });

  if (!organisation) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  // Return decrypted secrets so admins can see/update the current config.
  let ssoConfig = null;
  if (organisation.ssoConfig) {
    try {
      ssoConfig = {
        provider: organisation.ssoConfig.provider,
        clientId: organisation.ssoConfig.clientId,
        clientSecret: decryptSecret(organisation.ssoConfig.clientSecret),
        issuer: organisation.ssoConfig.issuer,
        tenantId: organisation.ssoConfig.tenantId,
        enabled: organisation.ssoConfig.enabled,
      };
    } catch (error) {
      return NextResponse.json(
        { error: "SSO secret could not be decrypted." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    organisationId: organisation.id,
    domains: organisation.domains.map((domain) => domain.domain),
    ssoConfig,
  });
}

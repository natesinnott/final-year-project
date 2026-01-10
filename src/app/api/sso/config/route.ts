import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

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

  if (!payload.provider || !payload.clientId || !payload.clientSecret) {
    return NextResponse.json(
      { error: "Provider, clientId, and clientSecret are required." },
      { status: 400 }
    );
  }

  const domains = (payload.domains ?? [])
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (domains.length === 0) {
    return NextResponse.json({ error: "At least one domain is required." }, { status: 400 });
  }

  const organisationId = membership.organisationId;

  await prisma.$transaction(async (tx) => {
    const encryptedSecret = encryptSecret(payload.clientSecret);
    await tx.organisationSsoConfig.upsert({
      where: { organisationId },
      create: {
        organisationId,
        provider: payload.provider,
        clientId: payload.clientId,
        clientSecret: encryptedSecret,
        issuer: payload.issuer?.trim() || null,
        tenantId: payload.tenantId?.trim() || null,
        enabled: payload.enabled ?? true,
      },
      update: {
        provider: payload.provider,
        clientId: payload.clientId,
        clientSecret: encryptedSecret,
        issuer: payload.issuer?.trim() || null,
        tenantId: payload.tenantId?.trim() || null,
        enabled: payload.enabled ?? true,
      },
    });

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

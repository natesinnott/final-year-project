import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import {
    genericOAuth,
    microsoftEntraId,
    okta,
    type GenericOAuthConfig,
} from "better-auth/plugins/generic-oauth";
import { decryptSecret } from "@/lib/crypto";

// Keep a single Prisma client in dev to avoid hot-reload connection churn.
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Optional enterprise SSO providers configured via env vars.
const enterpriseOAuthProviders: GenericOAuthConfig[] = [
    process.env.ENTRA_CLIENT_ID &&
    process.env.ENTRA_CLIENT_SECRET &&
    process.env.ENTRA_TENANT_ID
        ? microsoftEntraId({
              clientId: process.env.ENTRA_CLIENT_ID,
              clientSecret: process.env.ENTRA_CLIENT_SECRET,
              tenantId: process.env.ENTRA_TENANT_ID,
          })
        : null,
    process.env.OKTA_CLIENT_ID &&
    process.env.OKTA_CLIENT_SECRET &&
    process.env.OKTA_ISSUER
        ? okta({
              clientId: process.env.OKTA_CLIENT_ID,
              clientSecret: process.env.OKTA_CLIENT_SECRET,
              issuer: process.env.OKTA_ISSUER,
          })
        : null,
    process.env.GOOGLE_WORKSPACE_CLIENT_ID &&
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET
        ? ({
              providerId: "google-workspace",
              discoveryUrl:
                  "https://accounts.google.com/.well-known/openid-configuration",
              clientId: process.env.GOOGLE_WORKSPACE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_WORKSPACE_CLIENT_SECRET,
              scopes: ["openid", "profile", "email"],
          } as GenericOAuthConfig)
        : null,
].filter(isGenericOAuthConfig);

// Narrow nullable configs after env-gated construction.
function isGenericOAuthConfig(
    config: GenericOAuthConfig | null | undefined,
): config is GenericOAuthConfig {
    return Boolean(config);
}

// Base auth options shared by static and dynamic auth instances.
const baseAuthOptions = {
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL!,
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        apple: {
            clientId: process.env.APPLE_CLIENT_ID!,
            clientSecret: process.env.APPLE_CLIENT_SECRET!,
            appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER!,
        },
    },
    trustedOrigins: ["https://appleid.apple.com"],
};

// Static auth instance with only globally configured SSO providers.
export const auth = betterAuth({
    ...baseAuthOptions,
    emailAndPassword: {
        enabled: true,
    },
    plugins: enterpriseOAuthProviders.length
        ? [
              genericOAuth({
                  config: enterpriseOAuthProviders,
              }),
          ]
        : [],
});

// Dynamic auth instance that injects per-organisation SSO providers.
export async function getAuthWithSsoProviders() {
    const ssoConfigs = await prisma.organisationSsoConfig.findMany({
        where: { enabled: true },
    });

    // Build provider configs per org, decrypting stored secrets.
    const dynamicProviders: GenericOAuthConfig[] = ssoConfigs
        .map((config): GenericOAuthConfig | null => {
            let clientSecret: string;
            try {
                clientSecret = decryptSecret(config.clientSecret);
            } catch (error) {
                console.error(
                    "Failed to decrypt SSO client secret",
                    config.id,
                    error,
                );
                return null;
            }

            if (config.provider === "ENTRA") {
                const tenantId = config.tenantId?.trim() || "common";
                // Entra doesn't expose a discovery URL for multi-tenant routing.
                return {
                    providerId: `entra-${config.id}`,
                    authorizationUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
                    tokenUrl: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
                    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
                    clientId: config.clientId,
                    clientSecret,
                    scopes: ["openid", "profile", "email"],
                } as GenericOAuthConfig;
            }

            if (config.provider === "OKTA") {
                if (!config.issuer) {
                    return null;
                }
                // Okta uses issuer-based OIDC discovery.
                return {
                    providerId: `okta-${config.id}`,
                    discoveryUrl: `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
                    clientId: config.clientId,
                    clientSecret,
                    scopes: ["openid", "profile", "email"],
                } as GenericOAuthConfig;
            }

            if (config.provider === "GOOGLE_WORKSPACE") {
                // Google Workspace uses the standard Google OIDC discovery endpoint.
                return {
                    providerId: `google-workspace-${config.id}`,
                    discoveryUrl:
                        "https://accounts.google.com/.well-known/openid-configuration",
                    clientId: config.clientId,
                    clientSecret,
                    scopes: ["openid", "profile", "email"],
                } as GenericOAuthConfig;
            }

            return null;
        })
        .filter(isGenericOAuthConfig);

    const allProviders: GenericOAuthConfig[] = [
        ...enterpriseOAuthProviders,
        ...dynamicProviders,
    ];

    // Create a fresh auth instance with merged provider config.
    return betterAuth({
        ...baseAuthOptions,
        emailAndPassword: {
            enabled: true,
        },
        plugins: allProviders.length
            ? [
                  genericOAuth({
                      config: allProviders,
                  }),
              ]
            : [],
    });
}

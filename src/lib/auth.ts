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

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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

function isGenericOAuthConfig(
    config: GenericOAuthConfig | null | undefined,
): config is GenericOAuthConfig {
    return Boolean(config);
}

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

export async function getAuthWithSsoProviders() {
    const ssoConfigs = await prisma.organisationSsoConfig.findMany({
        where: { enabled: true },
    });

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
                return {
                    providerId: `okta-${config.id}`,
                    discoveryUrl: `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
                    clientId: config.clientId,
                    clientSecret,
                    scopes: ["openid", "profile", "email"],
                } as GenericOAuthConfig;
            }

            if (config.provider === "GOOGLE_WORKSPACE") {
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

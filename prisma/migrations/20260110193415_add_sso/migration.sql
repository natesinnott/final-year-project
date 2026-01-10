-- CreateEnum
CREATE TYPE "SsoProvider" AS ENUM ('ENTRA', 'OKTA', 'GOOGLE_WORKSPACE');

-- CreateTable
CREATE TABLE "OrganisationDomain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "OrganisationDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganisationSsoConfig" (
    "id" TEXT NOT NULL,
    "provider" "SsoProvider" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "issuer" TEXT,
    "tenantId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organisationId" TEXT NOT NULL,

    CONSTRAINT "OrganisationSsoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationDomain_domain_key" ON "OrganisationDomain"("domain");

-- CreateIndex
CREATE INDEX "OrganisationDomain_organisationId_idx" ON "OrganisationDomain"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationSsoConfig_organisationId_key" ON "OrganisationSsoConfig"("organisationId");

-- AddForeignKey
ALTER TABLE "OrganisationDomain" ADD CONSTRAINT "OrganisationDomain_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganisationSsoConfig" ADD CONSTRAINT "OrganisationSsoConfig_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

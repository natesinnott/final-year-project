import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Paste the demo production IDs you want to reset here.
const PRODUCTION_IDS_TO_RESET: string[] = [
  "cmnqb4j9a0001rvfghksjkodw",
  "cmnqb9edb000hrvfg7rr7g8xp",
  "cmnqbcyh2000xrvfg6a79usse",
  "cmnqbhwo7001drvfg41hbvk82",
  "cmnqs9rul0003nxfg6sofqe6t",
  "cmnrlejve0001nyfgdavlmiv0",
  "cmnrlhl3p000hnyfg0uy2ropc",
  "cmnujf6u6001vnyfgakkriiuc",
  "cmnujx1tb002bnyfg92lg6866",
  "cmnus47yd003dnyfgi04amhmk"
];

// Safety-first default. Use DRY_RUN=false to apply deletes/updates.
const DRY_RUN = parseBooleanEnv(process.env.DRY_RUN, true);

const DEMO_KEYWORDS = [
  "demo",
  "sample",
  "sandbox",
  "test",
  "testing",
  "qa",
  "usability",
  "fixture",
  "staging",
] as const;

const FILE_STORAGE_PATH_PREVIEW_LIMIT = 20;

type ResetCounts = {
  availabilityWindows: number;
  rehearsalAttendance: number;
  rehearsalAttendanceAudits: number;
  rehearsalParticipants: number;
  productionRehearsals: number;
  announcements: number;
  fileAssets: number;
  productionInvites: number;
  schedulingDrafts: number;
  conflictsSubmittedFlagsReset: number;
  productionTimeZonesCleared: number;
};

type ProductionResetResult =
  | {
      kind: "missing";
      productionId: string;
    }
  | {
      kind: "processed";
      productionId: string;
      productionName: string;
      organisationId: string;
      organisationName: string;
      productionTimeZone: string | null;
      looksLikeDemo: boolean;
      preservedProductionMembers: number;
      rehearsalDraftCount: number;
      rehearsalPublishedCount: number;
      rehearsalsWithSolveRunId: number;
      rehearsalsWithSourceMetadata: number;
      fileStoragePaths: string[];
      counts: ResetCounts;
    };

type Summary = {
  requested: number;
  processed: number;
  missing: number;
  warnings: number;
  errors: number;
  totals: ResetCounts;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function zeroCounts(): ResetCounts {
  return {
    availabilityWindows: 0,
    rehearsalAttendance: 0,
    rehearsalAttendanceAudits: 0,
    rehearsalParticipants: 0,
    productionRehearsals: 0,
    announcements: 0,
    fileAssets: 0,
    productionInvites: 0,
    schedulingDrafts: 0,
    conflictsSubmittedFlagsReset: 0,
    productionTimeZonesCleared: 0,
  };
}

function addCounts(target: ResetCounts, value: ResetCounts) {
  for (const key of Object.keys(target) as Array<keyof ResetCounts>) {
    target[key] += value[key];
  }
}

function looksLikeDemoProduction(production: {
  name: string;
  description: string | null;
  organisation: {
    name: string;
    contactEmail: string | null;
  };
}) {
  const haystack = [
    production.name,
    production.description,
    production.organisation.name,
    production.organisation.contactEmail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return DEMO_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function printCounts(counts: ResetCounts, verb: string) {
  console.log(`  ${verb} availability windows: ${counts.availabilityWindows}`);
  console.log(
    `  ${verb} rehearsal attendance rows: ${counts.rehearsalAttendance}`
  );
  console.log(
    `  ${verb} rehearsal attendance audit rows: ${counts.rehearsalAttendanceAudits}`
  );
  console.log(
    `  ${verb} rehearsal participant rows: ${counts.rehearsalParticipants}`
  );
  console.log(
    `  ${verb} production rehearsals: ${counts.productionRehearsals}`
  );
  console.log(`  ${verb} announcements: ${counts.announcements}`);
  console.log(`  ${verb} file asset metadata rows: ${counts.fileAssets}`);
  console.log(`  ${verb} production invite rows: ${counts.productionInvites}`);
  console.log(`  ${verb} scheduling drafts: ${counts.schedulingDrafts}`);
  console.log(
    `  ${verb} ProductionMember.conflictsSubmittedAt flags reset to null: ${counts.conflictsSubmittedFlagsReset}`
  );
  console.log(
    `  ${verb} production.timeZone fields cleared to null: ${counts.productionTimeZonesCleared}`
  );
}

function printStoragePaths(storagePaths: string[]) {
  const preview = storagePaths.slice(0, FILE_STORAGE_PATH_PREVIEW_LIMIT);

  for (const storagePath of preview) {
    console.log(`    - ${storagePath}`);
  }

  if (storagePaths.length > preview.length) {
    console.log(`    ... ${storagePaths.length - preview.length} more`);
  }
}

async function resetProduction(
  productionId: string
): Promise<ProductionResetResult> {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      name: true,
      description: true,
      timeZone: true,
      organisationId: true,
      organisation: {
        select: {
          name: true,
          contactEmail: true,
        },
      },
    },
  });

  if (!production) {
    return {
      kind: "missing",
      productionId,
    };
  }

  const looksLikeDemo = looksLikeDemoProduction(production);

  const result = await prisma.$transaction(
    async (tx) => {
      const [
        productionMembers,
        availabilityWindows,
        rehearsalAttendanceAudits,
        announcements,
        fileAssets,
        productionInvites,
        schedulingDrafts,
        rehearsals,
      ] = await Promise.all([
        tx.productionMember.findMany({
          where: { productionId },
          select: {
            conflictsSubmittedAt: true,
          },
        }),
        tx.availabilityWindow.count({
          where: { productionId },
        }),
        tx.rehearsalAttendanceAudit.count({
          where: { productionId },
        }),
        tx.announcement.count({
          where: { productionId },
        }),
        tx.fileAsset.findMany({
          where: { productionId },
          select: {
            storagePath: true,
          },
        }),
        tx.productionInvite.count({
          where: { productionId },
        }),
        tx.schedulingDraft.count({
          where: { productionId },
        }),
        tx.productionRehearsal.findMany({
          where: { productionId },
          select: {
            id: true,
            status: true,
            solveRunId: true,
            sourceMetadata: true,
          },
        }),
      ]);

      const rehearsalIds = rehearsals.map((rehearsal) => rehearsal.id);

      let rehearsalParticipants = 0;
      let rehearsalAttendance = 0;

      if (rehearsalIds.length > 0) {
        [rehearsalParticipants, rehearsalAttendance] = await Promise.all([
          tx.rehearsalParticipant.count({
            where: {
              rehearsalId: {
                in: rehearsalIds,
              },
            },
          }),
          tx.rehearsalAttendance.count({
            where: {
              rehearsalId: {
                in: rehearsalIds,
              },
            },
          }),
        ]);
      }

      const counts: ResetCounts = {
        availabilityWindows,
        rehearsalAttendance,
        rehearsalAttendanceAudits,
        rehearsalParticipants,
        productionRehearsals: rehearsals.length,
        announcements,
        fileAssets: fileAssets.length,
        productionInvites,
        schedulingDrafts,
        conflictsSubmittedFlagsReset: productionMembers.filter(
          (member) => member.conflictsSubmittedAt !== null
        ).length,
        productionTimeZonesCleared: production.timeZone ? 1 : 0,
      };

      if (!DRY_RUN) {
        if (rehearsalIds.length > 0) {
          await tx.rehearsalAttendance.deleteMany({
            where: {
              rehearsalId: {
                in: rehearsalIds,
              },
            },
          });

          await tx.rehearsalParticipant.deleteMany({
            where: {
              rehearsalId: {
                in: rehearsalIds,
              },
            },
          });
        }

        await tx.rehearsalAttendanceAudit.deleteMany({
          where: { productionId },
        });

        await tx.productionRehearsal.deleteMany({
          where: { productionId },
        });

        await tx.availabilityWindow.deleteMany({
          where: { productionId },
        });

        await tx.announcement.deleteMany({
          where: { productionId },
        });

        await tx.fileAsset.deleteMany({
          where: { productionId },
        });

        await tx.productionInvite.deleteMany({
          where: { productionId },
        });

        await tx.schedulingDraft.deleteMany({
          where: { productionId },
        });

        await tx.productionMember.updateMany({
          where: {
            productionId,
            conflictsSubmittedAt: {
              not: null,
            },
          },
          data: {
            conflictsSubmittedAt: null,
          },
        });

        if (production.timeZone) {
          await tx.production.update({
            where: {
              id: productionId,
            },
            data: {
              timeZone: null,
            },
          });
        }
      }

      return {
        preservedProductionMembers: productionMembers.length,
        rehearsalDraftCount: rehearsals.filter(
          (rehearsal) => rehearsal.status === "DRAFT"
        ).length,
        rehearsalPublishedCount: rehearsals.filter(
          (rehearsal) => rehearsal.status === "PUBLISHED"
        ).length,
        rehearsalsWithSolveRunId: rehearsals.filter((rehearsal) =>
          Boolean(rehearsal.solveRunId)
        ).length,
        rehearsalsWithSourceMetadata: rehearsals.filter(
          (rehearsal) => rehearsal.sourceMetadata !== null
        ).length,
        fileStoragePaths: fileAssets.map((fileAsset) => fileAsset.storagePath),
        counts,
      };
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    }
  );

  return {
    kind: "processed",
    productionId: production.id,
    productionName: production.name,
    organisationId: production.organisationId,
    organisationName: production.organisation.name,
    productionTimeZone: production.timeZone,
    looksLikeDemo,
    ...result,
  };
}

async function main() {
  const requestedIds = PRODUCTION_IDS_TO_RESET.map((id) => id.trim()).filter(
    Boolean
  );
  const productionIds = Array.from(new Set(requestedIds));
  const duplicateCount = requestedIds.length - productionIds.length;

  const summary: Summary = {
    requested: productionIds.length,
    processed: 0,
    missing: 0,
    warnings: 0,
    errors: 0,
    totals: zeroCounts(),
  };

  console.log("Demo production reset");
  console.log(`Mode: ${DRY_RUN ? "DRY_RUN" : "APPLY"}`);
  console.log(
    "Preserving: productions, organisations, users, organisation memberships, production role assignments"
  );
  console.log(
    "Resetting: availability, rehearsal data, attendance, audits, announcements, file metadata, invites, scheduling drafts, production time zone"
  );

  if (duplicateCount > 0) {
    console.warn(
      `Duplicate production IDs were removed before execution: ${duplicateCount}`
    );
  }

  if (productionIds.length === 0) {
    console.warn(
      "No production IDs configured. Populate PRODUCTION_IDS_TO_RESET and rerun."
    );
    return;
  }

  for (const productionId of productionIds) {
    console.log("");
    console.log(`=== Production ${productionId} ===`);

    try {
      const result = await resetProduction(productionId);

      if (result.kind === "missing") {
        summary.missing += 1;
        console.warn("  Production not found. Skipping.");
        continue;
      }

      summary.processed += 1;

      console.log(`  Name: ${result.productionName}`);
      console.log(
        `  Organisation: ${result.organisationName} (${result.organisationId})`
      );

      if (!result.looksLikeDemo) {
        summary.warnings += 1;
        console.warn(
          "  Warning: this production is not obviously demo data based on production/organisation metadata. Continuing because the ID was explicitly listed."
        );
      }

      console.log(
        `  Preserving ${result.preservedProductionMembers} ProductionMember role assignment(s).`
      );

      if (result.productionTimeZone) {
        console.log(
          `  ${DRY_RUN ? "Would clear" : "Cleared"} production.timeZone: ${result.productionTimeZone}`
        );
      }

      console.log(
        `  Rehearsal breakdown: ${result.rehearsalDraftCount} draft, ${result.rehearsalPublishedCount} published, ${result.rehearsalsWithSolveRunId} with solveRunId, ${result.rehearsalsWithSourceMetadata} with sourceMetadata`
      );

      printCounts(result.counts, DRY_RUN ? "would reset" : "reset");

      if (result.fileStoragePaths.length > 0) {
        console.warn(
          `  Blob cleanup note: ${DRY_RUN ? "would delete" : "deleted"} ${result.fileStoragePaths.length} FileAsset row(s), but Azure blob objects are not removed by this script. Storage paths:`
        );
        printStoragePaths(result.fileStoragePaths);
      }

      addCounts(summary.totals, result.counts);
    } catch (error) {
      summary.errors += 1;
      process.exitCode = 1;
      console.error(
        `  Failed to reset production ${productionId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log("");
  console.log("=== Summary ===");
  console.log(`Mode: ${DRY_RUN ? "DRY_RUN" : "APPLY"}`);
  console.log(`Requested productions: ${summary.requested}`);
  console.log(`Processed productions: ${summary.processed}`);
  console.log(`Missing productions: ${summary.missing}`);
  console.log(`Warnings: ${summary.warnings}`);
  console.log(`Errors: ${summary.errors}`);
  printCounts(
    summary.totals,
    DRY_RUN ? "would reset across all productions" : "reset across all productions"
  );

  if (summary.totals.fileAssets > 0) {
    console.warn(
      `Blob cleanup still required outside the database for up to ${summary.totals.fileAssets} file object(s).`
    );
  }
}

void main()
  .catch((error) => {
    process.exitCode = 1;
    console.error(
      "Fatal error while resetting demo productions:",
      error instanceof Error ? error.stack ?? error.message : error
    );
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

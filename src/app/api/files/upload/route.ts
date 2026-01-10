import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildStoragePath, getUploadsContainerClient } from "@/lib/azure-blob";

export const runtime = "nodejs";

// Uploads a file to Azure Blob Storage, then records metadata in Prisma.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const organisationId = formData.get("organisationId");
  const productionId = formData.get("productionId");
  const rolesValue = formData.get("visibleToRoles");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (typeof organisationId !== "string" || organisationId.length === 0) {
    return NextResponse.json({ error: "Missing organisationId" }, { status: 400 });
  }

  if (typeof productionId !== "string" || productionId.length === 0) {
    return NextResponse.json({ error: "Missing productionId" }, { status: 400 });
  }

  // Only members of the production can upload files to it.
  const productionMember = await prisma.productionMember.findFirst({
    where: {
      userId,
      productionId,
      production: { organisationId },
    },
  });

  if (!productionMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibleToRoles =
    typeof rolesValue === "string" && rolesValue.length > 0
      ? rolesValue.split(",").map((role) => role.trim())
      : [];

  // Upload directly from the app to keep storage paths consistent.
  const containerClient = await getUploadsContainerClient();
  const storagePath = buildStoragePath(organisationId, file.name);
  const blobClient = containerClient.getBlockBlobClient(storagePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await blobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: file.type || "application/octet-stream",
    },
  });

  const created = await prisma.fileAsset.create({
    data: {
      originalName: file.name,
      storagePath,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      visibleToRoles,
      organisationId,
      productionId,
      uploadedById: userId,
    },
  });

  return NextResponse.json({
    id: created.id,
    storagePath: created.storagePath,
  });
}

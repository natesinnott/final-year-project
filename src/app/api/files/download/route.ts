import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUploadsContainerClient } from "@/lib/azure-blob";

export const runtime = "nodejs";

function parseId(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("id");
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseId(request);
  if (!id) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const file = await prisma.fileAsset.findUnique({
    where: { id },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, organisationId: file.organisationId },
  });

  const productionMember = await prisma.productionMember.findFirst({
    where: { userId, productionId: file.productionId },
  });

  if (!membership || !productionMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isOrgAdmin = membership.role === "ADMIN";
  const roleAllowed =
    file.visibleToRoles.length === 0 ||
    file.visibleToRoles.includes(productionMember.role);

  if (!isOrgAdmin && !roleAllowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const containerClient = await getUploadsContainerClient();
  const blobClient = containerClient.getBlockBlobClient(file.storagePath);
  const downloadResponse = await blobClient.download();
  const body = downloadResponse.readableStreamBody;

  if (!body) {
    return NextResponse.json({ error: "Unable to download file" }, { status: 500 });
  }

  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.originalName}"`,
    },
  });
}

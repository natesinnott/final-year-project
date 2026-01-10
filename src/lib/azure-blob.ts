import { BlobServiceClient } from "@azure/storage-blob";

const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "uploads";

export function getBlobServiceClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");
  }

  return BlobServiceClient.fromConnectionString(connectionString);
}

export async function getUploadsContainerClient() {
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(containerName);

  await containerClient.createIfNotExists();
  return containerClient;
}

export function buildStoragePath(organisationId: string, filename: string) {
  const safeName = filename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `organisations/${organisationId}/files/${timestamp}-${safeName}`;
}

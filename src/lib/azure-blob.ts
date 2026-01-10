import { BlobServiceClient } from "@azure/storage-blob";

// Default container used for uploads if not provided in env.
const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "uploads";

// Lazily create a service client from the connection string.
export function getBlobServiceClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");
  }

  return BlobServiceClient.fromConnectionString(connectionString);
}

// Ensure the uploads container exists and return its client.
export async function getUploadsContainerClient() {
  const serviceClient = getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(containerName);

  await containerClient.createIfNotExists();
  return containerClient;
}

// Build a deterministic storage path scoped by organisation.
export function buildStoragePath(organisationId: string, filename: string) {
  const safeName = filename
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `organisations/${organisationId}/files/${timestamp}-${safeName}`;
}

import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";

export function getVideoContainer() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "videos";
  if (!connectionString) throw new Error("Azure Blob Storage is not configured.");
  return BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName);
}

export function getFontBlob(blobName: string) {
  return getVideoContainer().getBlockBlobClient(blobName);
}

export async function uploadFontBlob(blobName: string, bytes: Uint8Array, contentType: string) {
  const container = getVideoContainer();
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(blobName);
  await blob.uploadData(bytes, {
    blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: "private, max-age=3600" },
  });
  return blob;
}

export function getFontReadUrl(blobName: string) {
  return getFontBlob(blobName).generateSasUrl({
    permissions: BlobSASPermissions.parse("r"),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  });
}
import { BlobServiceClient } from "@azure/storage-blob";

export function getVideoContainer() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER ?? "videos";
  if (!connectionString) throw new Error("Azure Blob Storage is not configured.");
  return BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName);
}
// Storage helpers with Cloudflare R2 support and local fallback
// Priority: R2 > Forge API > Local Storage

import { ENV } from './_core/env';
import { localStoragePut, localStorageGet, localStorageRead, localStorageExists } from './local-storage';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Storage provider type
type StorageProvider = 'r2' | 'forge' | 'local';

// Get the active storage provider
function getStorageProvider(): StorageProvider {
  // Check R2 configuration first
  if (ENV.r2AccountId && ENV.r2AccessKeyId && ENV.r2SecretAccessKey && ENV.r2BucketName) {
    return 'r2';
  }
  
  // Check Forge API configuration
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return 'forge';
  }
  
  // Fall back to local storage
  return 'local';
}

// Create R2 client
function createR2Client(): S3Client | null {
  if (!ENV.r2AccountId || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey) {
    return null;
  }
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });
}

// R2 storage functions
async function r2Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const client = createR2Client();
  if (!client) {
    throw new Error('R2 client not configured');
  }
  
  const key = relKey.replace(/^\/+/, '');
  const body = typeof data === 'string' ? Buffer.from(data) : data;
  
  await client.send(new PutObjectCommand({
    Bucket: ENV.r2BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  
  // Return public URL if configured, otherwise generate signed URL
  let url: string;
  if (ENV.r2PublicUrl) {
    url = `${ENV.r2PublicUrl.replace(/\/+$/, '')}/${key}`;
  } else {
    // Generate a signed URL valid for 7 days
    const command = new GetObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
    });
    url = await getSignedUrl(client, command, { expiresIn: 604800 });
  }
  
  return { key, url };
}

async function r2Get(relKey: string): Promise<{ key: string; url: string }> {
  const client = createR2Client();
  if (!client) {
    throw new Error('R2 client not configured');
  }
  
  const key = relKey.replace(/^\/+/, '');
  
  // Return public URL if configured, otherwise generate signed URL
  let url: string;
  if (ENV.r2PublicUrl) {
    url = `${ENV.r2PublicUrl.replace(/\/+$/, '')}/${key}`;
  } else {
    const command = new GetObjectCommand({
      Bucket: ENV.r2BucketName,
      Key: key,
    });
    url = await getSignedUrl(client, command, { expiresIn: 604800 });
  }
  
  return { key, url };
}

// Forge API storage functions
function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", relKey.replace(/^\/+/, ''));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", relKey.replace(/^\/+/, ''));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, '');
  const uploadUrl = buildUploadUrl(ENV.forgeApiUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function forgeGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, '');
  return {
    key,
    url: await buildDownloadUrl(ENV.forgeApiUrl, key, ENV.forgeApiKey),
  };
}

// Main storage functions
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const provider = getStorageProvider();
  
  console.log(`[Storage] Using ${provider} storage provider`);
  
  switch (provider) {
    case 'r2':
      return r2Put(relKey, data, contentType);
    case 'forge':
      return forgePut(relKey, data, contentType);
    case 'local':
    default:
      return localStoragePut(relKey, data, contentType);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const provider = getStorageProvider();
  
  switch (provider) {
    case 'r2':
      return r2Get(relKey);
    case 'forge':
      return forgeGet(relKey);
    case 'local':
    default:
      return localStorageGet(relKey);
  }
}

// Export storage provider info for debugging
export function getStorageInfo(): { provider: StorageProvider; configured: boolean } {
  const provider = getStorageProvider();
  return {
    provider,
    configured: provider !== 'local',
  };
}

// Export local storage helpers for direct access
export { localStorageRead, localStorageExists } from './local-storage';

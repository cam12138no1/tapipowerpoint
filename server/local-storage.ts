// Local temporary storage for demo purposes
// Files are stored in /tmp directory and will be lost on server restart

import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';

const STORAGE_DIR = '/tmp/tapipowerpoint-storage';

// Ensure storage directory exists
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

// Generate a unique file key
function generateKey(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  return `${nanoid(12)}-${baseName}${ext}`;
}

// Store a file locally
export async function localStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  ensureStorageDir();
  
  const key = relKey.replace(/^\/+/, '');
  const filePath = path.join(STORAGE_DIR, key);
  
  // Ensure subdirectory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write file
  if (typeof data === 'string') {
    fs.writeFileSync(filePath, data, 'utf-8');
  } else {
    fs.writeFileSync(filePath, Buffer.from(data));
  }
  
  // Return a local URL that can be served
  const url = `/api/storage/${key}`;
  
  console.log(`[LocalStorage] Stored file: ${key} -> ${filePath}`);
  
  return { key, url };
}

// Get file URL (for local storage, we serve it through an API endpoint)
export async function localStorageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, '');
  const url = `/api/storage/${key}`;
  return { key, url };
}

// Read file content
export function localStorageRead(relKey: string): Buffer | null {
  const key = relKey.replace(/^\/+/, '');
  const filePath = path.join(STORAGE_DIR, key);
  
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  
  return null;
}

// Check if file exists
export function localStorageExists(relKey: string): boolean {
  const key = relKey.replace(/^\/+/, '');
  const filePath = path.join(STORAGE_DIR, key);
  return fs.existsSync(filePath);
}

// Delete file
export function localStorageDelete(relKey: string): boolean {
  const key = relKey.replace(/^\/+/, '');
  const filePath = path.join(STORAGE_DIR, key);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  
  return false;
}

// Get storage directory path
export function getStorageDir(): string {
  ensureStorageDir();
  return STORAGE_DIR;
}

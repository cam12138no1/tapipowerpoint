/**
 * File Operations Library
 * Standalone, reusable file download and validation utilities
 * Following SDD Library-First Principle
 */

export interface DownloadOptions {
  url: string;
  timeout?: number;
  maxRetries?: number;
}

export interface DownloadResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
  attempts: number;
}

/**
 * Download file with retry and timeout
 * 
 * @param options - Download configuration
 * @returns Download result with buffer or error
 */
export async function downloadFileWithRetry(
  options: DownloadOptions
): Promise<DownloadResult> {
  const { url, timeout = 30000, maxRetries = 3 } = options;
  
  console.log(`[FileOps] Downloading file from: ${url.substring(0, 100)}...`);
  console.log(`[FileOps] Config: timeout=${timeout}ms, maxRetries=${maxRetries}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[FileOps] Attempt ${attempt}/${maxRetries}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[FileOps] Request timeout after ${timeout}ms`);
        controller.abort();
      }, timeout);
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'TapiPowerPoint/1.0',
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      console.log(`[FileOps] ✓ Download successful: ${sizeMB}MB`);
      
      return {
        success: true,
        buffer,
        attempts: attempt,
      };
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const errorMsg = error.message || 'Unknown error';
      
      console.warn(`[FileOps] Attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);
      
      if (isLastAttempt) {
        return {
          success: false,
          error: errorMsg,
          attempts: attempt,
        };
      }
      
      // Exponential backoff: 1s, 2s, 4s...
      const delayMs = 1000 * Math.pow(2, attempt - 1);
      console.log(`[FileOps] Retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  return {
    success: false,
    error: 'Max retries exceeded',
    attempts: maxRetries,
  };
}

/**
 * Validate file buffer
 */
export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFileBuffer(
  buffer: Buffer,
  filename: string,
  options: FileValidationOptions = {}
): ValidationResult {
  const { maxSizeMB = 50, allowedTypes } = options;
  
  // Check size
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File size ${sizeMB.toFixed(1)}MB exceeds limit of ${maxSizeMB}MB`,
    };
  }
  
  // Check file type by extension
  if (allowedTypes) {
    const ext = filename.toLowerCase().split('.').pop();
    if (!ext || !allowedTypes.includes(`.${ext}`)) {
      return {
        valid: false,
        error: `File type .${ext} is not allowed`,
      };
    }
  }
  
  // Validate PPTX magic number (if it's a PPTX file)
  if (filename.toLowerCase().endsWith('.pptx')) {
    // PPTX files are ZIP archives (PK\x03\x04)
    if (buffer.length < 4 || 
        buffer[0] !== 0x50 || 
        buffer[1] !== 0x4B || 
        buffer[2] !== 0x03 || 
        buffer[3] !== 0x04) {
      return {
        valid: false,
        error: 'File does not appear to be a valid PPTX (invalid magic number)',
      };
    }
  }
  
  // Validate PDF magic number
  if (filename.toLowerCase().endsWith('.pdf')) {
    // PDF files start with %PDF
    const header = buffer.toString('ascii', 0, 4);
    if (header !== '%PDF') {
      return {
        valid: false,
        error: 'File does not appear to be a valid PDF',
      };
    }
  }
  
  return { valid: true };
}

/**
 * Safe filename sanitization
 */
export function sanitizeFilename(filename: string, maxLength: number = 50): string {
  return filename
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_.-]/g, '_')
    .substring(0, maxLength);
}

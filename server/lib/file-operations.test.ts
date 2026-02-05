/**
 * File Operations Tests
 * TDD: Tests written before implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  downloadFileWithRetry, 
  validateFileBuffer, 
  sanitizeFilename 
} from './file-operations';

describe('File Operations Library', () => {
  describe('validateFileBuffer', () => {
    it('should accept valid PPTX file', () => {
      // PPTX magic number: PK\x03\x04 (ZIP archive)
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
      
      const result = validateFileBuffer(buffer, 'test.pptx');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid PPTX file', () => {
      const buffer = Buffer.from('not a valid pptx file');
      
      const result = validateFileBuffer(buffer, 'test.pptx');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid magic number');
    });

    it('should accept valid PDF file', () => {
      const buffer = Buffer.from('%PDF-1.4\nrest of pdf...');
      
      const result = validateFileBuffer(buffer, 'test.pdf');
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid PDF file', () => {
      const buffer = Buffer.from('not a pdf');
      
      const result = validateFileBuffer(buffer, 'test.pdf');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('valid PDF');
    });

    it('should reject files exceeding size limit', () => {
      // Create 51MB buffer
      const buffer = Buffer.alloc(51 * 1024 * 1024);
      
      const result = validateFileBuffer(buffer, 'large.pptx', { maxSizeMB: 50 });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds limit');
    });

    it('should accept files under size limit', () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(1000).fill(0)]);
      
      const result = validateFileBuffer(buffer, 'small.pptx', { maxSizeMB: 50 });
      
      expect(result.valid).toBe(true);
    });

    it('should validate allowed file types', () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      
      const result = validateFileBuffer(buffer, 'test.exe', {
        allowedTypes: ['.pptx', '.pdf'],
      });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove special characters', () => {
      const result = sanitizeFilename('file@#$%name.pptx');
      expect(result).toBe('file____name.pptx');
    });

    it('should preserve Chinese characters', () => {
      const result = sanitizeFilename('2026年报告.pptx');
      expect(result).toBe('2026年报告.pptx');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(100) + '.pptx';
      const result = sanitizeFilename(longName, 20);
      expect(result.length).toBe(20);
    });

    it('should preserve extension', () => {
      const result = sanitizeFilename('my file.pptx');
      expect(result).toContain('.pptx');
    });
  });

  describe('downloadFileWithRetry', () => {
    it('should return success on successful download', async () => {
      // Mock successful fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
      });

      const result = await downloadFileWithRetry({
        url: 'https://example.com/file.pptx',
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.buffer).toBeDefined();
      expect(result.attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attemptCount = 0;
      
      global.fetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
        });
      });

      const result = await downloadFileWithRetry({
        url: 'https://example.com/file.pptx',
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should return error after max retries', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await downloadFileWithRetry({
        url: 'https://example.com/file.pptx',
        maxRetries: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toBe(2);
    });

    it('should handle timeout and abort signal', async () => {
      let abortCalled = false;
      
      // Mock fetch that respects abort signal
      global.fetch = vi.fn().mockImplementation((url, options: any) => {
        return new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            abortCalled = true;
            reject(new Error('Request aborted'));
          });
          
          // Simulate slow response that will be aborted
          setTimeout(() => {
            resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
            });
          }, 10000);
        });
      });

      const result = await downloadFileWithRetry({
        url: 'https://example.com/file.pptx',
        timeout: 100, // Very short timeout
        maxRetries: 1,
      });

      expect(result.success).toBe(false);
      expect(abortCalled).toBe(true);
    }, 5000); // 5 second timeout for this test
  });
});

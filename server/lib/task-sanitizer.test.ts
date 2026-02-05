/**
 * Task Sanitizer Tests
 * Ensures internal debug info is never exposed to users
 */

import { describe, it, expect } from 'vitest';
import { 
  sanitizeTaskForFrontend, 
  sanitizeTasksForFrontend,
  extractInternalDebugUrl,
  type PptTask 
} from './task-sanitizer';

describe('Task Sanitizer', () => {
  const mockTask: PptTask = {
    id: 1,
    userId: 1,
    projectId: 1,
    title: 'Test Task',
    status: 'failed',
    progress: 100,
    currentStep: 'Failed',
    errorMessage: 'Generation failed',
    resultPptxUrl: null,
    resultPdfUrl: null,
    outputContent: null,
    interactionData: JSON.stringify({
      error: 'file_not_found',
      retries: 10,
      _internalDebugUrl: 'https://app.manus.ai/tasks/abc123',
      _note: 'For debugging only',
    }),
  };

  describe('sanitizeTaskForFrontend', () => {
    it('should remove internal debug URL', () => {
      const sanitized = sanitizeTaskForFrontend(mockTask);
      
      expect(sanitized.interactionData).toBeDefined();
      const data = JSON.parse(sanitized.interactionData!);
      
      expect(data._internalDebugUrl).toBeUndefined();
      expect(data._note).toBeUndefined();
      expect(data.error).toBe('file_not_found');
      expect(data.retries).toBe(10);
    });

    it('should preserve user-facing data', () => {
      const sanitized = sanitizeTaskForFrontend(mockTask);
      
      expect(sanitized.id).toBe(mockTask.id);
      expect(sanitized.title).toBe(mockTask.title);
      expect(sanitized.status).toBe(mockTask.status);
      expect(sanitized.errorMessage).toBe(mockTask.errorMessage);
    });

    it('should handle task without interactionData', () => {
      const task = { ...mockTask, interactionData: null };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      expect(sanitized.interactionData).toBeNull();
    });

    it('should handle invalid JSON in interactionData', () => {
      const task = { ...mockTask, interactionData: 'invalid json{' };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      expect(sanitized.interactionData).toBeNull();
    });

    it('should set interactionData to null if only internal fields exist', () => {
      const task = {
        ...mockTask,
        interactionData: JSON.stringify({
          _internalDebugUrl: 'https://app.manus.ai/tasks/abc',
          _note: 'Internal only',
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      expect(sanitized.interactionData).toBeNull();
    });

    it('should remove all underscore-prefixed fields', () => {
      const task = {
        ...mockTask,
        interactionData: JSON.stringify({
          publicData: 'visible',
          _privateData: 'hidden',
          _secret: 'hidden',
          _internal: 'hidden',
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      const data = JSON.parse(sanitized.interactionData!);
      
      expect(data.publicData).toBe('visible');
      expect(data._privateData).toBeUndefined();
      expect(data._secret).toBeUndefined();
      expect(data._internal).toBeUndefined();
    });
  });

  describe('sanitizeTasksForFrontend', () => {
    it('should sanitize multiple tasks', () => {
      const tasks = [
        mockTask,
        { ...mockTask, id: 2 },
        { ...mockTask, id: 3, interactionData: null },
      ];
      
      const sanitized = sanitizeTasksForFrontend(tasks);
      
      expect(sanitized.length).toBe(3);
      sanitized.forEach(task => {
        if (task.interactionData) {
          const data = JSON.parse(task.interactionData);
          expect(data._internalDebugUrl).toBeUndefined();
        }
      });
    });
  });

  describe('extractInternalDebugUrl', () => {
    it('should extract debug URL for tech support', () => {
      const url = extractInternalDebugUrl(mockTask);
      
      expect(url).toBe('https://app.manus.ai/tasks/abc123');
    });

    it('should return null for task without interactionData', () => {
      const task = { ...mockTask, interactionData: null };
      const url = extractInternalDebugUrl(task);
      
      expect(url).toBeNull();
    });

    it('should return null if no debug URL exists', () => {
      const task = {
        ...mockTask,
        interactionData: JSON.stringify({ error: 'some_error' }),
      };
      
      const url = extractInternalDebugUrl(task);
      
      expect(url).toBeNull();
    });
  });

  describe('Security - No Data Leakage', () => {
    it('should never expose Manus URLs to frontend', () => {
      const sanitized = sanitizeTaskForFrontend(mockTask);
      const json = JSON.stringify(sanitized);
      
      // Verify no Manus URLs in sanitized data
      expect(json).not.toContain('app.manus.ai');
      expect(json).not.toContain('manus.ai');
    });

    it('should remove all internal debug fields', () => {
      const task = {
        ...mockTask,
        interactionData: JSON.stringify({
          _internalDebugUrl: 'https://app.manus.ai/...',
          _rawResponse: { huge: 'data' },
          _techSupportInfo: 'sensitive',
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      // All underscore fields should be gone
      if (sanitized.interactionData) {
        const data = JSON.parse(sanitized.interactionData);
        const keys = Object.keys(data);
        keys.forEach(key => {
          expect(key.startsWith('_')).toBe(false);
        });
      }
    });
  });
});

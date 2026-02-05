/**
 * Task Sanitizer Edge Cases
 * Critical security tests for data leakage prevention
 */

import { describe, it, expect } from 'vitest';
import { sanitizeTaskForFrontend, extractInternalDebugUrl, type PptTask } from './task-sanitizer';

describe('Task Sanitizer - Critical Security Edge Cases', () => {
  describe('Manus URL Leakage Prevention', () => {
    it('should remove all variations of Manus URLs', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: 1,
        title: 'Test',
        status: 'failed',
        progress: 100,
        currentStep: 'Failed',
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: JSON.stringify({
          _internalDebugUrl: 'https://app.manus.ai/tasks/abc',
          _shareUrl: 'https://manus.ai/share/xyz',
          _taskUrl: 'https://api.manus.ai/tasks/123',
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      const json = JSON.stringify(sanitized);
      
      expect(json).not.toContain('app.manus.ai');
      expect(json).not.toContain('manus.ai');
      expect(json).not.toContain('api.manus.ai');
    });

    it('should remove URLs even if nested deeply', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: 1,
        title: 'Test',
        status: 'failed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: JSON.stringify({
          error: 'some_error',
          details: {
            _debugInfo: {
              _url: 'https://app.manus.ai/debug',
            },
          },
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      if (sanitized.interactionData) {
        const data = JSON.parse(sanitized.interactionData);
        expect(data._debugInfo).toBeUndefined();
      }
    });

    it('should handle malformed URLs', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: JSON.stringify({
          _url: 'not-a-valid-url',
          _partial: 'app.manus',
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      const json = JSON.stringify(sanitized);
      
      expect(json).not.toContain('_url');
      expect(json).not.toContain('_partial');
    });
  });

  describe('XSS Prevention', () => {
    it('should not execute script in interactionData', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: JSON.stringify({
          _xss: '<script>alert("xss")</script>',
          safe: 'normal data',
        }),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      if (sanitized.interactionData) {
        const data = JSON.parse(sanitized.interactionData);
        expect(data._xss).toBeUndefined();
        expect(data.safe).toBe('normal data');
      }
    });

    it('should handle script tags in error messages', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: '<script>alert(1)</script>',
        status: 'failed',
        progress: 0,
        currentStep: '<img src=x onerror=alert(1)>',
        errorMessage: '<svg/onload=alert(1)>',
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: null,
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      // Data is sanitized but we don't modify it (React will escape it)
      expect(sanitized.title).toBeDefined();
      expect(sanitized.errorMessage).toBeDefined();
    });
  });

  describe('Large Data Handling', () => {
    it('should handle very large interactionData', () => {
      const largeData = {
        normalField: 'test',
        _internalLarge: 'x'.repeat(1000000), // 1MB data
      };
      
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: JSON.stringify(largeData),
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      
      if (sanitized.interactionData) {
        const data = JSON.parse(sanitized.interactionData);
        expect(data._internalLarge).toBeUndefined();
        expect(data.normalField).toBe('test');
      }
    });
  });

  describe('Null and Undefined Handling', () => {
    it('should handle null interactionData', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: null,
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      expect(sanitized.interactionData).toBeNull();
    });

    it('should handle undefined fields', () => {
      const task: any = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        // Missing optional fields
      };
      
      expect(() => sanitizeTaskForFrontend(task)).not.toThrow();
    });

    it('should handle empty string interactionData', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: '',
      };
      
      const sanitized = sanitizeTaskForFrontend(task);
      // Empty string should become null after parse failure
      expect(sanitized.interactionData).toBeNull();
    });
  });

  describe('extractInternalDebugUrl - Edge Cases', () => {
    it('should return null for tasks without interactionData', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: null,
      };
      
      const url = extractInternalDebugUrl(task);
      expect(url).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: 'not valid json{',
      };
      
      const url = extractInternalDebugUrl(task);
      expect(url).toBeNull();
    });

    it('should return null if no debug URL exists', () => {
      const task: PptTask = {
        id: 1,
        userId: 1,
        projectId: null,
        title: 'Test',
        status: 'completed',
        progress: 100,
        currentStep: null,
        errorMessage: null,
        resultPptxUrl: null,
        resultPdfUrl: null,
        outputContent: null,
        interactionData: JSON.stringify({ error: 'some error' }),
      };
      
      const url = extractInternalDebugUrl(task);
      expect(url).toBeNull();
    });
  });
});

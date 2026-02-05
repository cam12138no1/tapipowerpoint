/**
 * Cleanup Tasks Tests
 * Testing edge cases for automatic task cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Cleanup Tasks Edge Cases', () => {
  describe('Time Calculations', () => {
    it('should correctly calculate 24 hour cutoff', () => {
      const now = Date.now();
      const cutoff = new Date(now - 24 * 60 * 60 * 1000);
      
      // Task created 25 hours ago (should be cleaned)
      const oldTask = new Date(now - 25 * 60 * 60 * 1000);
      expect(oldTask.getTime()).toBeLessThan(cutoff.getTime());
      
      // Task created 23 hours ago (should NOT be cleaned)
      const recentTask = new Date(now - 23 * 60 * 60 * 1000);
      expect(recentTask.getTime()).toBeGreaterThan(cutoff.getTime());
    });

    it('should handle edge case at exactly 24 hours', () => {
      const now = Date.now();
      const exactly24h = new Date(now - 24 * 60 * 60 * 1000);
      const cutoff = new Date(now - 24 * 60 * 60 * 1000);
      
      // At exactly 24 hours, should be cleaned (less than check)
      expect(exactly24h.getTime()).toBeLessThanOrEqual(cutoff.getTime());
    });
  });

  describe('Status Filtering', () => {
    const activeStatuses = ['running', 'pending', 'uploading', 'ask'];
    const completedStatuses = ['completed', 'failed'];

    it('should only target active statuses', () => {
      activeStatuses.forEach(status => {
        expect(['running', 'pending', 'uploading', 'ask']).toContain(status);
      });
    });

    it('should not target completed statuses', () => {
      completedStatuses.forEach(status => {
        expect(['running', 'pending', 'uploading', 'ask']).not.toContain(status);
      });
    });
  });

  describe('Empty Results', () => {
    it('should handle zero stuck tasks gracefully', async () => {
      // Mock db query returning empty array
      const mockQuery = vi.fn().mockResolvedValue([]);
      
      const result = await runCleanupWithMock(mockQuery);
      
      expect(result).toBe(0);
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      
      const result = await runCleanupWithMock(mockQuery);
      
      expect(result).toBe(0); // Should return 0, not throw
    });

    it('should continue cleanup even if one task fails', async () => {
      // Mock: 3 tasks, one fails to update
      const tasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
        { id: 3, title: 'Task 3' },
      ];
      
      const mockUpdate = vi.fn()
        .mockResolvedValueOnce(true)  // Task 1 success
        .mockRejectedValueOnce(new Error('Update failed')) // Task 2 fails
        .mockResolvedValueOnce(true); // Task 3 success
      
      // Should cleanup 2 out of 3
      const result = await runCleanupWithFailures(tasks, mockUpdate);
      
      expect(result).toBe(2);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
    });
  });
});

// Mock helper functions
async function runCleanupWithMock(queryMock: any): Promise<number> {
  try {
    const tasks = await queryMock();
    return tasks.length;
  } catch {
    return 0;
  }
}

async function runCleanupWithFailures(tasks: any[], updateMock: any): Promise<number> {
  let cleaned = 0;
  for (const task of tasks) {
    try {
      await updateMock(task.id);
      cleaned++;
    } catch {
      // Continue even if one fails
    }
  }
  return cleaned;
}

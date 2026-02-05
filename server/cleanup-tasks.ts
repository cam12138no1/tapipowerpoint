/**
 * Task Cleanup Utilities
 * Auto-cleanup stuck tasks
 */

import * as db from './db';

/**
 * Clean up tasks stuck in active states for too long
 * @param hoursOld - Tasks older than this many hours will be cleaned
 * @returns Number of tasks cleaned up
 */
export async function cleanupStuckTasks(hoursOld: number = 24): Promise<number> {
  const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  
  console.log(`[Cleanup] Checking for tasks stuck before ${cutoffDate.toISOString()}`);
  
  try {
    // Get all active tasks
    const allTasks = await db.query.pptTasks?.findMany?.({
      where: (tasks: any, { inArray, and, lt }: any) => and(
        inArray(tasks.status, ['running', 'pending', 'uploading', 'ask']),
        lt(tasks.createdAt, cutoffDate)
      ),
    });
    
    if (!allTasks || allTasks.length === 0) {
      console.log('[Cleanup] No stuck tasks found');
      return 0;
    }
    
    console.log(`[Cleanup] Found ${allTasks.length} stuck tasks to cleanup`);
    
    // Mark each as failed
    let cleanedCount = 0;
    for (const task of allTasks) {
      try {
        await db.updatePptTask(task.id, {
          status: 'failed',
          errorMessage: '任务超时（超过 24 小时未完成，已自动清理）',
          currentStep: '任务已超时',
        });
        
        await db.addTimelineEvent(task.id, '任务自动清理（超时）', 'failed');
        
        console.log(`[Cleanup] ✓ Cleaned task ${task.id}: ${task.title}`);
        cleanedCount++;
      } catch (error) {
        console.error(`[Cleanup] Failed to clean task ${task.id}:`, error);
      }
    }
    
    console.log(`[Cleanup] Cleanup completed: ${cleanedCount}/${allTasks.length} tasks cleaned`);
    return cleanedCount;
    
  } catch (error) {
    console.error('[Cleanup] Failed to fetch stuck tasks:', error);
    return 0;
  }
}

/**
 * Run cleanup on server startup
 */
export async function runStartupCleanup(): Promise<void> {
  try {
    console.log('[Cleanup] Starting automatic cleanup of stuck tasks...');
    const count = await cleanupStuckTasks(24);
    
    if (count > 0) {
      console.log(`[Cleanup] ✓ Startup cleanup successful: ${count} tasks cleaned`);
    } else {
      console.log('[Cleanup] ✓ No cleanup needed, all tasks are current');
    }
  } catch (error) {
    console.error('[Cleanup] Startup cleanup failed:', error);
  }
}

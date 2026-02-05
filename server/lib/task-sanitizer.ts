/**
 * Task Data Sanitizer
 * Removes internal debugging information before sending to frontend
 * Prevents exposing Manus share_url to end users
 */

export interface PptTask {
  id: number;
  userId: number;
  projectId: number | null;
  title: string;
  status: string;
  progress: number;
  currentStep: string | null;
  errorMessage: string | null;
  resultPptxUrl: string | null;
  resultPdfUrl: string | null;
  interactionData: string | null;
  outputContent: string | null;
  [key: string]: any;
}

/**
 * Sanitize task data for frontend consumption
 * Removes all internal debugging information
 * 
 * @param task - Raw task from database
 * @returns Sanitized task safe to send to frontend
 */
export function sanitizeTaskForFrontend(task: PptTask): PptTask {
  const sanitized = { ...task };
  
  // Parse and clean interactionData
  if (task.interactionData) {
    try {
      const data = JSON.parse(task.interactionData);
      
      // Remove any fields starting with underscore (internal use)
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (!key.startsWith('_')) {
          cleanedData[key] = value;
        } else {
          console.log(`[Sanitizer] Removed internal field: ${key}`);
        }
      }
      
      // Only include if there's useful data for frontend
      sanitized.interactionData = Object.keys(cleanedData).length > 0
        ? JSON.stringify(cleanedData)
        : null;
    } catch (error) {
      console.warn('[Sanitizer] Failed to parse interactionData:', error);
      sanitized.interactionData = null;
    }
  }
  
  // Remove any other internal fields
  const internalFields = ['_internalDebugUrl', '_debugInfo', '_rawResponse'];
  for (const field of internalFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }
  
  return sanitized;
}

/**
 * Sanitize multiple tasks
 */
export function sanitizeTasksForFrontend(tasks: PptTask[]): PptTask[] {
  return tasks.map(sanitizeTaskForFrontend);
}

/**
 * Extract internal debug URL for tech support
 * Only use in backend admin tools, never expose to end users
 */
export function extractInternalDebugUrl(task: PptTask): string | null {
  if (!task.interactionData) return null;
  
  try {
    const data = JSON.parse(task.interactionData);
    return data._internalDebugUrl || null;
  } catch {
    return null;
  }
}

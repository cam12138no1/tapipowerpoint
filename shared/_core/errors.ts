/**
 * Unified Error Handling
 * Provides consistent error types across frontend and backend
 */

// ============ Error Codes ============

export const ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  
  // API
  API_ERROR: 'API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============ Error Messages (Chinese) ============

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.UNAUTHORIZED]: '请先登录',
  [ERROR_CODES.FORBIDDEN]: '没有权限执行此操作',
  [ERROR_CODES.NOT_FOUND]: '资源不存在',
  [ERROR_CODES.CONFLICT]: '资源冲突',
  [ERROR_CODES.VALIDATION_ERROR]: '输入数据无效',
  [ERROR_CODES.PAYLOAD_TOO_LARGE]: '文件太大',
  [ERROR_CODES.INTERNAL_ERROR]: '系统错误，请稍后重试',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [ERROR_CODES.TIMEOUT]: '请求超时',
  [ERROR_CODES.API_ERROR]: 'API调用失败',
  [ERROR_CODES.RATE_LIMITED]: '请求过于频繁，请稍后再试',
};

// ============ App Error Class ============

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: Record<string, any>
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============ Helper Functions ============

/**
 * Check if an error is a specific type
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extract user-friendly message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return '网络连接失败，请检查网络';
    }
    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES[ERROR_CODES.TIMEOUT];
    }
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
}

/**
 * Create an AppError from any error
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
  }
  
  return new AppError(ERROR_CODES.INTERNAL_ERROR);
}

/**
 * Create a forbidden error (403)
 */
export function ForbiddenError(
  message?: string,
  details?: Record<string, any>
): AppError {
  return new AppError(ERROR_CODES.FORBIDDEN, message, details);
}

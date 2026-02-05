/**
 * Secure Password Hashing Library
 * Using bcrypt for production-grade password security
 * Following SDD Security Standards
 */

import bcrypt from 'bcrypt';

// Configuration
const SALT_ROUNDS = 10; // bcrypt work factor

/**
 * Hash a password using bcrypt
 * 
 * @param password - Plain text password
 * @returns Bcrypt hash
 * @throws Error if password is empty or hashing fails
 * 
 * @example
 * const hash = await hashPassword('user123');
 * // Returns: $2b$10$...
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }
  
  if (password.length > 72) {
    // bcrypt has a 72 character limit
    throw new Error('Password must be 72 characters or less');
  }
  
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify a password against a bcrypt hash
 * 
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns True if password matches, false otherwise
 * 
 * @example
 * const isValid = await verifyPassword('user123', storedHash);
 * if (isValid) {
 *   // Login successful
 * }
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('[Password] Verification error:', error);
    return false;
  }
}

/**
 * Check if a password needs rehashing
 * (e.g., if salt rounds have been increased)
 * 
 * @param hash - Existing bcrypt hash
 * @returns True if hash needs to be regenerated
 */
export function needsRehash(hash: string): boolean {
  try {
    const rounds = bcrypt.getRounds(hash);
    return rounds < SALT_ROUNDS;
  } catch (error) {
    // Invalid hash format
    return true;
  }
}

/**
 * Validate password strength
 * 
 * @param password - Password to validate
 * @returns Validation result
 */
export interface PasswordStrengthResult {
  valid: boolean;
  score: number; // 0-5
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;
  
  if (!password) {
    return { valid: false, score: 0, feedback: ['密码不能为空'] };
  }
  
  // Length check
  if (password.length < 8) {
    feedback.push('密码至少需要 8 个字符');
  } else if (password.length >= 8) {
    score += 1;
  }
  
  if (password.length >= 12) {
    score += 1;
  }
  
  // Complexity checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  // Feedback
  if (!/[a-z]/.test(password)) {
    feedback.push('建议包含小写字母');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('建议包含大写字母');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('建议包含数字');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push('建议包含特殊字符');
  }
  
  // Minimum score of 3 required
  const valid = score >= 3 && password.length >= 8;
  
  return { valid, score, feedback };
}

/**
 * Legacy simple hash function (DEPRECATED)
 * 
 * @deprecated Use hashPassword with bcrypt instead
 * This function is kept for backward compatibility only
 * DO NOT use for new code
 */
export function simpleHash(input: string): string {
  console.warn('[Password] simpleHash is DEPRECATED and INSECURE. Use hashPassword instead.');
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

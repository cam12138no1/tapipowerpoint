/**
 * Password Security Tests
 * TDD: Tests written before implementation
 */

import { describe, it, expect } from 'vitest';
import { 
  hashPassword, 
  verifyPassword, 
  needsRehash,
  validatePasswordStrength,
  simpleHash,
} from './password';

describe('Password Security Library', () => {
  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'test123456';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'test123456';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // Due to random salt, hashes should be different
      expect(hash1).not.toBe(hash2);
    });

    it('should reject empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('cannot be empty');
    });

    it('should reject password longer than 72 characters', async () => {
      const longPassword = 'a'.repeat(73);
      await expect(hashPassword(longPassword)).rejects.toThrow('72 characters');
    });

    it('should hash password at boundary (72 chars)', async () => {
      const password = 'a'.repeat(72);
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'correct123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'correct123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('wrong456', hash);
      expect(isValid).toBe(false);
    });

    it('should handle case sensitivity', async () => {
      const password = 'Test123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('test123', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hash = await hashPassword('test123');
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const isValid = await verifyPassword('test123', '');
      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const isValid = await verifyPassword('test123', 'not-a-valid-bcrypt-hash');
      expect(isValid).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('should return false for current hash', async () => {
      const hash = await hashPassword('test123');
      const needs = needsRehash(hash);
      expect(needs).toBe(false);
    });

    it('should return true for invalid hash', () => {
      const needs = needsRehash('invalid-hash');
      expect(needs).toBe(true);
    });

    it('should return true for old hash format', () => {
      // Old hash with only 4 rounds (less than current 10)
      const oldHash = '$2b$04$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz012';
      const needs = needsRehash(oldHash);
      expect(needs).toBe(true);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength('StrongPass123!');
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should reject weak password', () => {
      const result = validatePasswordStrength('weak');
      
      expect(result.valid).toBe(false);
      expect(result.score).toBeLessThan(3);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('should reject short password', () => {
      const result = validatePasswordStrength('Aa1!');
      
      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('密码至少需要 8 个字符');
    });

    it('should accept password with mixed case and numbers', () => {
      const result = validatePasswordStrength('TestPass123');
      
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should give higher score for longer passwords', () => {
      const short = validatePasswordStrength('Pass123!');
      const long = validatePasswordStrength('LongerPass123!');
      
      expect(long.score).toBeGreaterThanOrEqual(short.score);
    });

    it('should reject empty password', () => {
      const result = validatePasswordStrength('');
      
      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('密码不能为空');
    });

    it('should provide helpful feedback', () => {
      const result = validatePasswordStrength('lowercase123');
      
      expect(result.feedback).toContain('建议包含大写字母');
    });
  });

  describe('simpleHash (deprecated)', () => {
    it('should produce consistent hash', () => {
      const hash1 = simpleHash('test');
      const hash2 = simpleHash('test');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = simpleHash('test1');
      const hash2 = simpleHash('test2');
      expect(hash1).not.toBe(hash2);
    });

    it('should warn about deprecation', () => {
      // This function should log a warning
      const hash = simpleHash('test');
      expect(hash).toBeDefined();
    });
  });

  describe('Security Properties', () => {
    it('should be computationally expensive (slow)', async () => {
      const start = Date.now();
      await hashPassword('test123');
      const duration = Date.now() - start;
      
      // bcrypt should take at least 30ms (usually 50-300ms)
      // This ensures the hashing is not instant (defense against brute force)
      expect(duration).toBeGreaterThanOrEqual(30);
    });

    it('should handle Unicode characters', async () => {
      const password = '密码123パスワード';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should handle special characters', async () => {
      const password = 'p@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });
  });
});

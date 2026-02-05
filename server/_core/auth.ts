/**
 * JWT-based Authentication Module
 * Provides secure token-based authentication
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { ENV } from './env';

// ============ Types ============

export interface UserTokenPayload extends JWTPayload {
  userId: number;
  openId: string;
  name: string;
  role: 'user' | 'admin';
}

export interface TokenResult {
  token: string;
  expiresAt: Date;
}

// ============ Configuration ============

const TOKEN_EXPIRY = '7d'; // Token valid for 7 days
const ALGORITHM = 'HS256';

// ============ Utility Functions ============

/**
 * Get the secret key for JWT operations
 * Falls back to a default for development (NOT SECURE)
 */
function getSecretKey(): Uint8Array {
  const secret = ENV.cookieSecret;
  
  // Production environment MUST have JWT secret
  if (ENV.isProduction && !secret) {
    throw new Error(
      'JWT_SECRET environment variable must be set in production environment. ' +
      'Generate a secure secret: openssl rand -base64 32'
    );
  }
  
  // Validate secret length (minimum 32 characters for security)
  if (secret && secret.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters long. ` +
      `Current length: ${secret.length}. ` +
      `Generate a secure secret: openssl rand -base64 32`
    );
  }
  
  // Use provided secret or development-only fallback
  const effectiveSecret = secret || 'dev-secret-only-for-local-development';
  
  if (!secret && !ENV.isProduction) {
    console.warn('[Auth] WARNING: Using default JWT_SECRET for development. Set JWT_SECRET environment variable.');
  }
  
  return new TextEncoder().encode(effectiveSecret);
}

// ============ Token Operations ============

/**
 * Create a new JWT token for a user
 */
export async function createToken(payload: Omit<UserTokenPayload, 'iat' | 'exp'>): Promise<TokenResult> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const token = await new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecretKey());
  
  return { token, expiresAt };
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<UserTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    
    // Validate required fields
    if (!payload.userId || !payload.openId || !payload.name) {
      console.warn('[Auth] Token missing required fields');
      return null;
    }
    
    return payload as UserTokenPayload;
  } catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.log('[Auth] Token expired');
    } else {
      console.warn('[Auth] Token verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(headers: Record<string, string | string[] | undefined>, cookies?: Record<string, string>): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Try cookie
  if (cookies?.auth_token) {
    return cookies.auth_token;
  }
  
  return null;
}

/**
 * Generate a simple hash for password (DEPRECATED - DO NOT USE)
 * 
 * @deprecated This function is INSECURE and should not be used.
 * Use the password module instead: import { hashPassword, verifyPassword } from '../lib/password'
 * 
 * This function is kept only for backward compatibility with existing data.
 * All new code should use bcrypt via the password module.
 */
export function simpleHash(input: string): string {
  console.warn('[Auth] simpleHash is DEPRECATED and INSECURE. Use hashPassword from lib/password instead.');
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

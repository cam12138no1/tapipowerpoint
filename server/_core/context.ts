import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { verifyToken, extractToken } from "./auth";
import cookie from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Method 1: JWT token authentication (preferred)
    const cookies = cookie.parse(opts.req.headers.cookie || '');
    const token = extractToken(opts.req.headers as Record<string, string>, cookies);
    
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        // Get user from database using the verified token data
        const foundUser = await db.getUserByOpenId(payload.openId);
        if (foundUser) {
          user = foundUser as User;
        }
      }
    }
    
    // Method 2: Simple header authentication (backward compatibility)
    // Only used if JWT auth didn't work
    if (!user) {
      const rawUsername = opts.req.headers['x-username'] as string | undefined;
      const rawOpenId = opts.req.headers['x-user-openid'] as string | undefined;
      
      if (rawUsername && rawOpenId) {
        const username = decodeURIComponent(rawUsername);
        const userOpenId = decodeURIComponent(rawOpenId);
        
        // Create or get user
        const foundUser = await db.getOrCreateUser(userOpenId, username);
        if (foundUser) {
          user = foundUser as User;
        }
      }
    }
  } catch (error) {
    console.error("[Auth] Error in authentication:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

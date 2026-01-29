import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

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
    // Simple username authentication via header
    const rawUsername = opts.req.headers['x-username'] as string | undefined;
    const rawOpenId = opts.req.headers['x-user-openid'] as string | undefined;
    
    // Decode URL-encoded values
    const username = rawUsername ? decodeURIComponent(rawUsername) : undefined;
    const userOpenId = rawOpenId ? decodeURIComponent(rawOpenId) : undefined;
    
    if (username && userOpenId) {
      // Try to find existing user by openId
      const existingUser = await db.getUserByOpenId(userOpenId);
      
      // If not found, create new user
      if (!existingUser) {
        await db.upsertUser({
          openId: userOpenId,
          name: username,
          lastSignedIn: new Date(),
        });
        const newUser = await db.getUserByOpenId(userOpenId);
        
        // If database is not available, create a mock user
        if (!newUser) {
          user = {
            id: 1,
            openId: userOpenId,
            name: username,
            email: null,
            loginMethod: 'local',
            role: 'user',
            lastSignedIn: new Date(),
            createdAt: new Date(),
          } as User;
        } else {
          user = newUser;
        }
      } else {
        // Update last signed in
        await db.upsertUser({
          openId: userOpenId,
          lastSignedIn: new Date(),
        });
        user = existingUser;
      }
    }
  } catch (error) {
    console.error("[Auth] Error in simple auth:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

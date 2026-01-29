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
      // Use getOrCreateUser which handles both DB and memory store
      const foundUser = await db.getOrCreateUser(userOpenId, username);
      if (foundUser) {
        user = foundUser as User;
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

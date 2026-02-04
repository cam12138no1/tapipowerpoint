import { describe, expect, it, vi, beforeEach } from "vitest";
import { createContext } from "./_core/context";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

// Mock the db module
vi.mock("./db", () => ({
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getOrCreateUser: vi.fn(),
}));

// Mock the auth module
vi.mock("./_core/auth", () => ({
  verifyToken: vi.fn().mockResolvedValue(null),
  extractToken: vi.fn().mockReturnValue(null),
}));

import * as db from "./db";

describe("Simple Username Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null user when no headers provided", async () => {
    const mockReq = {
      headers: {},
    } as CreateExpressContextOptions["req"];
    
    const mockRes = {} as CreateExpressContextOptions["res"];

    const context = await createContext({ req: mockReq, res: mockRes });
    
    expect(context.user).toBeNull();
  });

  it("should return null user when only username header is provided", async () => {
    const mockReq = {
      headers: {
        'x-username': 'testuser',
        cookie: '',
      },
    } as CreateExpressContextOptions["req"];
    
    const mockRes = {} as CreateExpressContextOptions["res"];

    const context = await createContext({ req: mockReq, res: mockRes });
    
    expect(context.user).toBeNull();
  });

  it("should return null user when only openid header is provided", async () => {
    const mockReq = {
      headers: {
        'x-user-openid': 'test_openid_123',
        cookie: '',
      },
    } as CreateExpressContextOptions["req"];
    
    const mockRes = {} as CreateExpressContextOptions["res"];

    const context = await createContext({ req: mockReq, res: mockRes });
    
    expect(context.user).toBeNull();
  });

  it("should create new user when both headers provided and user not found", async () => {
    const mockUser = {
      id: 1,
      openId: 'test_openid_123',
      name: 'Test User',
      email: null,
      loginMethod: null,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    // getOrCreateUser returns the created user
    vi.mocked(db.getOrCreateUser).mockResolvedValue(mockUser);

    const mockReq = {
      headers: {
        'x-username': 'Test User',
        'x-user-openid': 'test_openid_123',
        cookie: '',
      },
    } as CreateExpressContextOptions["req"];
    
    const mockRes = {} as CreateExpressContextOptions["res"];

    const context = await createContext({ req: mockReq, res: mockRes });
    
    expect(db.getOrCreateUser).toHaveBeenCalledWith('test_openid_123', 'Test User');
    expect(context.user).toEqual(mockUser);
  });

  it("should return existing user when headers provided", async () => {
    const mockUser = {
      id: 1,
      openId: 'existing_openid',
      name: 'Existing User',
      email: 'test@example.com',
      loginMethod: null,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    vi.mocked(db.getOrCreateUser).mockResolvedValue(mockUser);

    const mockReq = {
      headers: {
        'x-username': 'Existing User',
        'x-user-openid': 'existing_openid',
        cookie: '',
      },
    } as CreateExpressContextOptions["req"];
    
    const mockRes = {} as CreateExpressContextOptions["res"];

    const context = await createContext({ req: mockReq, res: mockRes });
    
    expect(db.getOrCreateUser).toHaveBeenCalledWith('existing_openid', 'Existing User');
    expect(context.user).toEqual(mockUser);
  });

  it("should handle database errors gracefully", async () => {
    vi.mocked(db.getOrCreateUser).mockRejectedValue(new Error("Database error"));

    const mockReq = {
      headers: {
        'x-username': 'Test User',
        'x-user-openid': 'test_openid',
        cookie: '',
      },
    } as CreateExpressContextOptions["req"];
    
    const mockRes = {} as CreateExpressContextOptions["res"];

    const context = await createContext({ req: mockReq, res: mockRes });
    
    // Should return null user on error, not throw
    expect(context.user).toBeNull();
  });
});

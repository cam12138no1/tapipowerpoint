import { describe, expect, it, vi, beforeEach } from "vitest";
import { createToken, verifyToken, extractToken, simpleHash } from "./_core/auth";

describe("JWT Authentication", () => {
  describe("createToken", () => {
    it("should create a valid JWT token", async () => {
      const payload = {
        userId: 1,
        openId: "test_user_123",
        name: "Test User",
        role: "user" as const,
      };

      const result = await createToken(payload);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.split(".")).toHaveLength(3); // JWT has 3 parts
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should create different tokens for different payloads", async () => {
      const payload1 = {
        userId: 1,
        openId: "user_1",
        name: "User 1",
        role: "user" as const,
      };

      const payload2 = {
        userId: 2,
        openId: "user_2",
        name: "User 2",
        role: "admin" as const,
      };

      const result1 = await createToken(payload1);
      const result2 = await createToken(payload2);

      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe("verifyToken", () => {
    it("should verify a valid token and return payload", async () => {
      const originalPayload = {
        userId: 1,
        openId: "test_user_123",
        name: "Test User",
        role: "user" as const,
      };

      const { token } = await createToken(originalPayload);
      const verified = await verifyToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(originalPayload.userId);
      expect(verified?.openId).toBe(originalPayload.openId);
      expect(verified?.name).toBe(originalPayload.name);
      expect(verified?.role).toBe(originalPayload.role);
    });

    it("should return null for invalid token", async () => {
      const result = await verifyToken("invalid.token.here");
      expect(result).toBeNull();
    });

    it("should return null for empty token", async () => {
      const result = await verifyToken("");
      expect(result).toBeNull();
    });

    it("should return null for malformed token", async () => {
      const result = await verifyToken("not-a-jwt");
      expect(result).toBeNull();
    });

    it("should return null for tampered token", async () => {
      const { token } = await createToken({
        userId: 1,
        openId: "test",
        name: "Test",
        role: "user",
      });

      // Tamper with the token
      const parts = token.split(".");
      parts[1] = Buffer.from('{"userId":999,"openId":"hacked","name":"Hacker","role":"admin"}').toString("base64url");
      const tamperedToken = parts.join(".");

      const result = await verifyToken(tamperedToken);
      expect(result).toBeNull();
    });
  });

  describe("extractToken", () => {
    it("should extract token from Authorization header", () => {
      const headers = {
        authorization: "Bearer test-token-123",
      };

      const token = extractToken(headers);
      expect(token).toBe("test-token-123");
    });

    it("should extract token from capitalized Authorization header", () => {
      const headers = {
        Authorization: "Bearer test-token-456",
      };

      const token = extractToken(headers);
      expect(token).toBe("test-token-456");
    });

    it("should extract token from cookie", () => {
      const headers = {};
      const cookies = {
        auth_token: "cookie-token-789",
      };

      const token = extractToken(headers, cookies);
      expect(token).toBe("cookie-token-789");
    });

    it("should prefer Authorization header over cookie", () => {
      const headers = {
        authorization: "Bearer header-token",
      };
      const cookies = {
        auth_token: "cookie-token",
      };

      const token = extractToken(headers, cookies);
      expect(token).toBe("header-token");
    });

    it("should return null when no token found", () => {
      const token = extractToken({});
      expect(token).toBeNull();
    });

    it("should return null for non-Bearer auth header", () => {
      const headers = {
        authorization: "Basic dXNlcjpwYXNz",
      };

      const token = extractToken(headers);
      expect(token).toBeNull();
    });
  });

  describe("simpleHash", () => {
    it("should produce consistent hash for same input", () => {
      const hash1 = simpleHash("test-input");
      const hash2 = simpleHash("test-input");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different inputs", () => {
      const hash1 = simpleHash("input1");
      const hash2 = simpleHash("input2");
      expect(hash1).not.toBe(hash2);
    });

    it("should return string", () => {
      const hash = simpleHash("test");
      expect(typeof hash).toBe("string");
    });
  });
});

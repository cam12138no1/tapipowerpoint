import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock environment variables
vi.mock("./_core/env", () => ({
  ENV: {
    r2AccountId: "",
    r2AccessKeyId: "",
    r2SecretAccessKey: "",
    r2BucketName: "",
    r2PublicUrl: "",
    forgeApiUrl: "",
    forgeApiKey: "",
  },
}));

describe("Storage Module", () => {
  describe("getStorageProvider", () => {
    it("should fall back to local storage when no cloud storage configured", async () => {
      // Import after mocking
      const { storagePut } = await import("./storage");
      
      // With no cloud storage configured, it should use local storage
      const result = await storagePut("test/file.txt", "test content", "text/plain");
      
      expect(result.key).toBe("test/file.txt");
      expect(result.url).toContain("/api/storage/");
    });
  });

  describe("URL handling", () => {
    it("should strip leading slashes from keys", async () => {
      const { storagePut } = await import("./storage");
      
      const result = await storagePut("///path/to/file.txt", "content", "text/plain");
      
      // Key should not have leading slashes
      expect(result.key).not.toMatch(/^\/+/);
    });
  });
});

describe("Local Storage", () => {
  beforeEach(async () => {
    // Clear local storage before each test
    const localStorage = await import("./local-storage");
    localStorage.localStorageClear();
  });

  afterEach(async () => {
    // Clean up after tests
    const localStorage = await import("./local-storage");
    localStorage.localStorageClear();
  });

  describe("localStorageWrite", () => {
    it("should write and read back string data", async () => {
      const localStorage = await import("./local-storage");
      
      const key = "test/string.txt";
      const data = "Hello, World!";
      
      localStorage.localStorageWrite(key, data);
      const result = localStorage.localStorageRead(key);
      
      expect(result?.toString()).toBe(data);
    });

    it("should write and read back buffer data", async () => {
      const localStorage = await import("./local-storage");
      
      const key = "test/buffer.bin";
      const data = Buffer.from([1, 2, 3, 4, 5]);
      
      localStorage.localStorageWrite(key, data);
      const result = localStorage.localStorageRead(key);
      
      expect(result).toEqual(data);
    });
  });

  describe("localStorageExists", () => {
    it("should return true for existing file", async () => {
      const localStorage = await import("./local-storage");
      
      const key = "test/exists.txt";
      localStorage.localStorageWrite(key, "content");
      
      expect(localStorage.localStorageExists(key)).toBe(true);
    });

    it("should return false for non-existing file", async () => {
      const localStorage = await import("./local-storage");
      
      expect(localStorage.localStorageExists("nonexistent/file.txt")).toBe(false);
    });
  });

  describe("localStorageDelete", () => {
    it("should delete existing file", async () => {
      const localStorage = await import("./local-storage");
      
      const key = "test/delete.txt";
      localStorage.localStorageWrite(key, "content");
      expect(localStorage.localStorageExists(key)).toBe(true);
      
      localStorage.localStorageDelete(key);
      expect(localStorage.localStorageExists(key)).toBe(false);
    });
  });
});

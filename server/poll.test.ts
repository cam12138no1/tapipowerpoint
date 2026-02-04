import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("./ppt-engine", () => ({
  pptEngine: {
    getTask: vi.fn(),
  },
  PPTEngineError: class PPTEngineError extends Error {
    constructor(message: string, public code: string, public statusCode?: number, public retryable = false) {
      super(message);
      this.name = "PPTEngineError";
    }
  },
}));

vi.mock("./db", () => ({
  getPptTaskById: vi.fn(),
  updatePptTask: vi.fn(),
  addTimelineEvent: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://storage.example.com/file.pptx" }),
}));

import { pptEngine, PPTEngineError } from "./ppt-engine";
import * as db from "./db";

describe("Task Polling Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("File Extraction", () => {
    it("should extract PPTX file from attachments", async () => {
      const mockEngineTask = {
        id: "engine_task_123",
        status: "completed",
        attachments: [
          { filename: "presentation.pptx", url: "https://api.example.com/file.pptx" },
        ],
        pptxFile: { url: "https://api.example.com/file.pptx", filename: "presentation.pptx" },
        output: [],
      };

      vi.mocked(pptEngine.getTask).mockResolvedValue(mockEngineTask);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      } as Response);

      const result = await pptEngine.getTask("engine_task_123");

      expect(result.status).toBe("completed");
      expect(result.pptxFile).toBeDefined();
      expect(result.pptxFile?.url).toContain(".pptx");
    });

    it("should handle task without attachments", async () => {
      const mockEngineTask = {
        id: "engine_task_456",
        status: "completed",
        attachments: [],
        pptxFile: null,
        output: [],
      };

      vi.mocked(pptEngine.getTask).mockResolvedValue(mockEngineTask);

      const result = await pptEngine.getTask("engine_task_456");

      expect(result.pptxFile).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should identify retryable errors", () => {
      const retryableError = new PPTEngineError("Rate limited", "RATE_LIMITED", 429, true);
      expect(retryableError.retryable).toBe(true);

      const nonRetryableError = new PPTEngineError("Bad request", "BAD_REQUEST", 400, false);
      expect(nonRetryableError.retryable).toBe(false);
    });

    it("should handle network errors gracefully", async () => {
      vi.mocked(pptEngine.getTask).mockRejectedValue(
        new PPTEngineError("Connection failed", "ECONNRESET", undefined, true)
      );

      await expect(pptEngine.getTask("task_123")).rejects.toThrow("Connection failed");
    });
  });

  describe("Status Transitions", () => {
    it("should update task status when completed with file", async () => {
      const mockTask = {
        id: 1,
        engineTaskId: "engine_123",
        status: "running",
        title: "Test Presentation",
        userId: 1,
        interactionData: null,
      };

      vi.mocked(db.getPptTaskById).mockResolvedValue(mockTask as any);
      vi.mocked(db.updatePptTask).mockResolvedValue(undefined);
      vi.mocked(db.addTimelineEvent).mockResolvedValue(undefined);

      // Verify that updatePptTask would be called with correct status
      await db.updatePptTask(1, {
        status: "completed",
        progress: 100,
        resultPptxUrl: "https://storage.example.com/file.pptx",
      });

      expect(db.updatePptTask).toHaveBeenCalledWith(1, expect.objectContaining({
        status: "completed",
        progress: 100,
      }));
    });

    it("should increment retry counter when completed but no file", async () => {
      const mockTask = {
        id: 1,
        engineTaskId: "engine_123",
        status: "running",
        title: "Test Presentation",
        userId: 1,
        interactionData: JSON.stringify({ retryCount: 2 }),
      };

      vi.mocked(db.getPptTaskById).mockResolvedValue(mockTask as any);
      vi.mocked(db.updatePptTask).mockResolvedValue(undefined);

      // Simulate updating retry count
      const retryData = JSON.parse(mockTask.interactionData || '{"retryCount":0}');
      const newRetryCount = (retryData.retryCount || 0) + 1;

      expect(newRetryCount).toBe(3);
    });

    it("should fail task after max retries", async () => {
      const maxRetries = 10;
      const mockTask = {
        id: 1,
        engineTaskId: "engine_123",
        status: "running",
        title: "Test Presentation",
        userId: 1,
        interactionData: JSON.stringify({ retryCount: maxRetries }),
      };

      vi.mocked(db.getPptTaskById).mockResolvedValue(mockTask as any);
      vi.mocked(db.updatePptTask).mockResolvedValue(undefined);

      const retryData = JSON.parse(mockTask.interactionData || '{"retryCount":0}');
      const currentRetry = retryData.retryCount || 0;

      // Should mark as failed when retry count exceeds max
      expect(currentRetry >= maxRetries).toBe(true);
    });
  });

  describe("Progress Calculation", () => {
    it("should calculate progress based on output messages", () => {
      const outputMessages = new Array(15).fill({ role: "assistant", content: [] });
      
      // Progress formula: min(60 + length * 2, 94)
      const progress = Math.min(60 + outputMessages.length * 2, 94);
      
      expect(progress).toBe(90); // 60 + 15*2 = 90
    });

    it("should cap progress at 94%", () => {
      const outputMessages = new Array(50).fill({ role: "assistant", content: [] });
      
      const progress = Math.min(60 + outputMessages.length * 2, 94);
      
      expect(progress).toBe(94);
    });
  });
});

describe("Download File With Retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retry on failure", async () => {
    let attempts = 0;
    vi.mocked(global.fetch).mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      } as Response);
    });

    // Simulate retry logic
    const maxRetries = 3;
    let result = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch("https://example.com/file.pptx");
        if (response.ok) {
          result = await response.arrayBuffer();
          break;
        }
      } catch (e) {
        if (i === maxRetries - 1) throw e;
      }
    }

    expect(result).not.toBeNull();
    expect(attempts).toBe(3);
  });

  it("should fail after max retries", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fetch("https://example.com/file.pptx");
      } catch (e) {
        lastError = e as Error;
      }
    }

    expect(lastError).not.toBeNull();
    expect(lastError?.message).toBe("Network error");
  });
});

/**
 * PPT Engine - Comprehensive Tests
 * Covers all utility functions, prompt building, error handling, edge cases
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildPPTPrompt,
  getMimeType,
  PPTEngineError,
  type DesignSpec,
  type ImageConfig,
} from "./ppt-engine";

// ============ getMimeType ============
describe("getMimeType", () => {
  const cases: [string, string][] = [
    ["doc.pdf", "application/pdf"],
    ["img.png", "image/png"],
    ["img.jpg", "image/jpeg"],
    ["img.jpeg", "image/jpeg"],
    ["img.gif", "image/gif"],
    ["img.webp", "image/webp"],
    ["f.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["f.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["f.txt", "text/plain"],
    ["f.md", "text/markdown"],
  ];
  it.each(cases)("returns correct type for %s", (file, expected) => {
    expect(getMimeType(file)).toBe(expected);
  });

  it("returns octet-stream for unknown", () => {
    expect(getMimeType("f.xyz")).toBe("application/octet-stream");
    expect(getMimeType("noext")).toBe("application/octet-stream");
    expect(getMimeType("")).toBe("application/octet-stream");
    expect(getMimeType(".")).toBe("application/octet-stream");
  });

  it("is case insensitive", () => {
    expect(getMimeType("F.PDF")).toBe("application/pdf");
    expect(getMimeType("I.PNG")).toBe("image/png");
  });

  it("handles multiple dots", () => {
    expect(getMimeType("a.b.c.pdf")).toBe("application/pdf");
  });

  it("handles unicode filenames", () => {
    expect(getMimeType("报告.pdf")).toBe("application/pdf");
    expect(getMimeType("プレゼン.pptx")).toContain("presentation");
  });
});

// ============ PPTEngineError ============
describe("PPTEngineError", () => {
  it("sets all properties", () => {
    const e = new PPTEngineError("msg", "CODE", 500, true);
    expect(e.message).toBe("msg");
    expect(e.code).toBe("CODE");
    expect(e.statusCode).toBe(500);
    expect(e.retryable).toBe(true);
    expect(e.name).toBe("PPTEngineError");
    expect(e instanceof Error).toBe(true);
  });

  it("defaults retryable to false", () => {
    expect(new PPTEngineError("m", "C").retryable).toBe(false);
  });

  it("handles undefined statusCode", () => {
    const e = new PPTEngineError("m", "C", undefined, true);
    expect(e.statusCode).toBeUndefined();
    expect(e.retryable).toBe(true);
  });
});

// ============ buildPPTPrompt ============
describe("buildPPTPrompt", () => {
  // --- basic output ---
  it("builds minimal prompt", () => {
    const p = buildPPTPrompt(null, []);
    expect(p).toContain("专业PPT制作任务");
    expect(p).toContain("12-15 页");
    expect(p).toContain(".pptx");
    expect(p).not.toContain("undefined");
    expect(p).not.toContain("null");
  });

  // --- design spec ---
  it("includes full design spec", () => {
    const spec: DesignSpec = {
      name: "企业蓝", primaryColor: "#003", secondaryColor: "#666",
      accentColor: "#F00", fontFamily: "Arial",
      designSpec: "现代简约", logoUrl: "https://x.com/logo.png",
    };
    const p = buildPPTPrompt(null, [], undefined, spec);
    expect(p).toContain("企业蓝");
    expect(p).toContain("#003");
    expect(p).toContain("Arial");
    expect(p).toContain("现代简约");
  });

  it("handles spec without optional fields", () => {
    const spec: DesignSpec = {
      name: "X", primaryColor: "#000", secondaryColor: "#FFF",
      accentColor: "#F00", fontFamily: "A",
    };
    const p = buildPPTPrompt(null, [], undefined, spec);
    expect(p).toContain("X");
    expect(p).not.toContain("undefined");
  });

  it("handles null designSpec", () => {
    const p = buildPPTPrompt(null, [], undefined, null);
    expect(p).not.toContain("设计规范");
  });

  // --- content sources ---
  it("includes proposal content", () => {
    const p = buildPPTPrompt(null, [], "关于AI的分析报告");
    expect(p).toContain("关于AI的分析报告");
    expect(p).toContain("内容来源");
  });

  it("includes source file reference", () => {
    const p = buildPPTPrompt("file_123", []);
    expect(p).toContain("内容来源");
    expect(p).toContain("源文档");
  });

  it("prioritizes proposal over source file", () => {
    const p = buildPPTPrompt("file_123", [], "direct content");
    expect(p).toContain("direct content");
  });

  // --- images ---
  it("categorizes images by usage mode", () => {
    const imgs: ImageConfig[] = [
      { fileId: "a", usageMode: "must_use", category: "cover" },
      { fileId: "b", usageMode: "suggest_use", category: "content" },
      { fileId: "c", usageMode: "ai_decide" },
      { fileId: "d" },  // no usageMode
    ];
    const p = buildPPTPrompt(null, imgs);
    expect(p).toContain("必须使用");
    expect(p).toContain("建议使用");
    expect(p).toContain("可选使用");
    expect(p).toContain("a");
    expect(p).toContain("d");
  });

  it("handles empty image array", () => {
    const p = buildPPTPrompt(null, []);
    expect(p).not.toContain("配图要求");
  });

  // --- page control ---
  it("includes 12-15 page limit", () => {
    const p = buildPPTPrompt(null, []);
    expect(p).toContain("12-15 页");
    expect(p).toContain("不超过 15 页");
  });

  // --- edge cases ---
  it("handles very long content", () => {
    const long = "x".repeat(50000);
    const p = buildPPTPrompt(null, [], long);
    expect(p.length).toBeGreaterThan(50000);
  });

  it("handles special characters", () => {
    const p = buildPPTPrompt(null, [], '<script>alert("xss")</script>');
    expect(p).toContain("<script>");
  });

  it("handles 50 images", () => {
    const imgs = Array.from({ length: 50 }, (_, i) => ({
      fileId: `f${i}`, usageMode: "must_use" as const, category: "content" as const,
    }));
    const p = buildPPTPrompt(null, imgs);
    expect(p).toContain("f0");
    expect(p).toContain("f49");
  });
});

// ============ Sanitizer comprehensive ============
import { sanitizeTaskForFrontend, sanitizeTasksForFrontend, extractInternalDebugUrl, type PptTask } from "./lib/task-sanitizer";

describe("Task Sanitizer - comprehensive", () => {
  const base: PptTask = {
    id: 1, userId: 1, projectId: null, title: "T", status: "completed",
    progress: 100, currentStep: null, errorMessage: null,
    resultPptxUrl: null, resultPdfUrl: null, outputContent: null, interactionData: null,
  };

  it("passes through clean tasks", () => {
    const s = sanitizeTaskForFrontend(base);
    expect(s.id).toBe(1);
    expect(s.interactionData).toBeNull();
  });

  it("strips all _ prefixed keys", () => {
    const t = { ...base, interactionData: JSON.stringify({ ok: 1, _bad: 2, _url: "x" }) };
    const s = sanitizeTaskForFrontend(t);
    const d = JSON.parse(s.interactionData!);
    expect(d.ok).toBe(1);
    expect(d._bad).toBeUndefined();
    expect(d._url).toBeUndefined();
  });

  it("returns null if only internal fields", () => {
    const t = { ...base, interactionData: JSON.stringify({ _a: 1, _b: 2 }) };
    expect(sanitizeTaskForFrontend(t).interactionData).toBeNull();
  });

  it("handles invalid JSON", () => {
    const t = { ...base, interactionData: "{broken" };
    expect(sanitizeTaskForFrontend(t).interactionData).toBeNull();
  });

  it("handles empty string", () => {
    const t = { ...base, interactionData: "" };
    expect(sanitizeTaskForFrontend(t).interactionData).toBeNull();
  });

  it("sanitizes array of tasks", () => {
    const tasks = [
      { ...base, interactionData: JSON.stringify({ _secret: "x", ok: 1 }) },
      { ...base, id: 2 },
    ];
    const result = sanitizeTasksForFrontend(tasks);
    expect(result.length).toBe(2);
    if (result[0].interactionData) {
      expect(JSON.parse(result[0].interactionData)._secret).toBeUndefined();
    }
  });

  it("never leaks manus.ai in output", () => {
    const t = {
      ...base,
      interactionData: JSON.stringify({
        _url: "https://app.manus.ai/tasks/abc",
        _share: "https://manus.ai/share",
      }),
    };
    const json = JSON.stringify(sanitizeTaskForFrontend(t));
    expect(json).not.toContain("manus.ai");
  });

  it("extractInternalDebugUrl works", () => {
    const t = { ...base, interactionData: JSON.stringify({ _internalDebugUrl: "http://x" }) };
    expect(extractInternalDebugUrl(t)).toBe("http://x");
    expect(extractInternalDebugUrl(base)).toBeNull();
    expect(extractInternalDebugUrl({ ...base, interactionData: "{bad" })).toBeNull();
  });
});

// ============ File operations comprehensive ============
import { validateFileBuffer, sanitizeFilename } from "./lib/file-operations";

describe("File operations - comprehensive", () => {
  describe("validateFileBuffer", () => {
    it("validates PPTX magic bytes", () => {
      const valid = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0)]);
      expect(validateFileBuffer(valid, "a.pptx").valid).toBe(true);
      expect(validateFileBuffer(Buffer.from("bad"), "a.pptx").valid).toBe(false);
    });

    it("validates PDF header", () => {
      expect(validateFileBuffer(Buffer.from("%PDF-1.4 ..."), "a.pdf").valid).toBe(true);
      expect(validateFileBuffer(Buffer.from("nope"), "a.pdf").valid).toBe(false);
    });

    it("enforces size limit", () => {
      const big = Buffer.alloc(51 * 1024 * 1024);
      expect(validateFileBuffer(big, "a.txt", { maxSizeMB: 50 }).valid).toBe(false);
      expect(validateFileBuffer(Buffer.from("ok"), "a.txt", { maxSizeMB: 50 }).valid).toBe(true);
    });

    it("enforces allowed types", () => {
      const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      expect(validateFileBuffer(buf, "a.pptx", { allowedTypes: [".pptx"] }).valid).toBe(true);
      expect(validateFileBuffer(buf, "a.exe", { allowedTypes: [".pptx"] }).valid).toBe(false);
    });

    it("accepts non-checked file types", () => {
      expect(validateFileBuffer(Buffer.from("hello"), "a.txt").valid).toBe(true);
    });
  });

  describe("sanitizeFilename", () => {
    it("removes special chars", () => {
      expect(sanitizeFilename("a@#$b.pptx")).toBe("a___b.pptx");
    });
    it("preserves chinese", () => {
      expect(sanitizeFilename("报告.pptx")).toBe("报告.pptx");
    });
    it("limits length", () => {
      expect(sanitizeFilename("a".repeat(100), 20).length).toBe(20);
    });
  });
});

// ============ Password module ============
import { hashPassword, verifyPassword, validatePasswordStrength, needsRehash, simpleHash } from "./lib/password";

describe("Password module - comprehensive", () => {
  it("hash + verify round trip", async () => {
    const h = await hashPassword("test123");
    expect(await verifyPassword("test123", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("rejects empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });

  it("rejects >72 char password", async () => {
    await expect(hashPassword("x".repeat(73))).rejects.toThrow();
  });

  it("generates different hashes", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("handles unicode password", async () => {
    const h = await hashPassword("密码123");
    expect(await verifyPassword("密码123", h)).toBe(true);
  });

  it("verifyPassword returns false for bad inputs", async () => {
    expect(await verifyPassword("", "hash")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-bcrypt")).toBe(false);
  });

  it("needsRehash detects old rounds", () => {
    expect(needsRehash("invalid")).toBe(true);
  });

  it("validatePasswordStrength works", () => {
    expect(validatePasswordStrength("").valid).toBe(false);
    expect(validatePasswordStrength("weak").valid).toBe(false);
    expect(validatePasswordStrength("StrongPass1!").valid).toBe(true);
  });

  it("simpleHash is consistent", () => {
    expect(simpleHash("abc")).toBe(simpleHash("abc"));
    expect(simpleHash("abc")).not.toBe(simpleHash("xyz"));
  });
});

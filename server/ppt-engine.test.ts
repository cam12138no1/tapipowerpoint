import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { 
  buildPPTPrompt, 
  getMimeType,
  PPTEngineError,
  type DesignSpec,
  type ImageConfig 
} from "./ppt-engine";

describe("PPT Engine Utilities", () => {
  describe("getMimeType", () => {
    it("should return correct MIME type for common file extensions", () => {
      expect(getMimeType("document.pdf")).toBe("application/pdf");
      expect(getMimeType("image.png")).toBe("image/png");
      expect(getMimeType("image.jpg")).toBe("image/jpeg");
      expect(getMimeType("image.jpeg")).toBe("image/jpeg");
      expect(getMimeType("presentation.pptx")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
      expect(getMimeType("text.txt")).toBe("text/plain");
      expect(getMimeType("document.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    });

    it("should return octet-stream for unknown extensions", () => {
      expect(getMimeType("file.xyz")).toBe("application/octet-stream");
      expect(getMimeType("noextension")).toBe("application/octet-stream");
    });

    it("should handle uppercase extensions", () => {
      expect(getMimeType("IMAGE.PNG")).toBe("image/png");
      expect(getMimeType("DOCUMENT.PDF")).toBe("application/pdf");
    });
  });

  describe("PPTEngineError", () => {
    it("should create error with correct properties", () => {
      const error = new PPTEngineError("Test error", "TEST_CODE", 500, true);
      
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
      expect(error.name).toBe("PPTEngineError");
    });

    it("should default retryable to false", () => {
      const error = new PPTEngineError("Test error", "TEST_CODE");
      expect(error.retryable).toBe(false);
    });
  });

  describe("buildPPTPrompt", () => {
    it("should build basic prompt without any options", () => {
      const prompt = buildPPTPrompt(null, []);
      
      expect(prompt).toContain("# 专业PPT制作任务");
      expect(prompt).toContain("## 质量要求");
      expect(prompt).toContain("## 输出要求");
      expect(prompt).toContain(".pptx");
    });

    it("should include design spec when provided", () => {
      const designSpec: DesignSpec = {
        name: "企业蓝",
        primaryColor: "#003366",
        secondaryColor: "#6699CC",
        accentColor: "#FF9900",
        fontFamily: "微软雅黑",
        designSpec: "现代简约风格",
        logoUrl: "https://example.com/logo.png",
      };

      const prompt = buildPPTPrompt(null, [], undefined, designSpec);
      
      expect(prompt).toContain("## 设计规范");
      expect(prompt).toContain("企业蓝");
      expect(prompt).toContain("#003366");
      expect(prompt).toContain("微软雅黑");
      expect(prompt).toContain("现代简约风格");
    });

    it("should include source file reference when provided", () => {
      const prompt = buildPPTPrompt("file_123", []);
      
      expect(prompt).toContain("## 内容来源");
      expect(prompt).toContain("源文档");
    });

    it("should include proposal content when provided", () => {
      const content = "这是一个关于人工智能的提案";
      const prompt = buildPPTPrompt(null, [], content);
      
      expect(prompt).toContain("## 内容来源");
      expect(prompt).toContain(content);
    });

    it("should categorize images by usage mode", () => {
      const images: ImageConfig[] = [
        { fileId: "img1", usageMode: "must_use", category: "cover", description: "封面图" },
        { fileId: "img2", usageMode: "suggest_use", category: "content" },
        { fileId: "img3", usageMode: "ai_decide", category: "other" },
      ];

      const prompt = buildPPTPrompt(null, images);
      
      expect(prompt).toContain("## 配图要求");
      expect(prompt).toContain("必须使用的图片");
      expect(prompt).toContain("建议使用的图片");
      expect(prompt).toContain("可选使用的图片");
      expect(prompt).toContain("img1");
      expect(prompt).toContain("封面图");
    });

    it("should include quality requirements", () => {
      const prompt = buildPPTPrompt(null, []);
      
      expect(prompt).toContain("金字塔原则");
      expect(prompt).toContain("数据驱动");
      expect(prompt).toContain("现代简约");
    });
  });
});

describe("PPT Engine API Client", () => {
  // Mock fetch globally
  const originalFetch = global.fetch;
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("API Error Handling", () => {
    it("should identify retryable errors correctly", () => {
      // Rate limited
      const rateLimitedError = new PPTEngineError("Rate limited", "429", 429, true);
      expect(rateLimitedError.retryable).toBe(true);
      
      // Server error
      const serverError = new PPTEngineError("Server error", "500", 500, false);
      expect(serverError.retryable).toBe(false);
      
      // Connection reset
      const connectionError = new PPTEngineError("Connection reset", "ECONNRESET", undefined, true);
      expect(connectionError.retryable).toBe(true);
    });
  });
});

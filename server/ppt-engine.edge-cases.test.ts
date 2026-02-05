/**
 * PPT Engine Edge Cases Tests
 * Testing boundary conditions and error scenarios
 */

import { describe, expect, it } from "vitest";
import { buildPPTPrompt, getMimeType, type DesignSpec, type ImageConfig } from "./ppt-engine";

describe("PPT Engine - Edge Cases", () => {
  describe("buildPPTPrompt - Boundary Conditions", () => {
    it("should handle empty inputs", () => {
      const prompt = buildPPTPrompt(null, []);
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain("专业PPT制作任务");
      expect(prompt).toContain("12-15 页");
    });

    it("should handle very long proposal content", () => {
      const longContent = "这是内容".repeat(10000); // 40KB+ text
      const prompt = buildPPTPrompt(null, [], longContent);
      
      expect(prompt).toContain(longContent);
      expect(prompt.length).toBeGreaterThan(40000);
    });

    it("should handle special characters in content", () => {
      const specialContent = "测试 <script>alert('xss')</script> & 特殊字符 \"quotes\" 'quotes' `backticks`";
      const prompt = buildPPTPrompt(null, [], specialContent);
      
      expect(prompt).toContain(specialContent);
    });

    it("should handle design spec with missing optional fields", () => {
      const minimalSpec: DesignSpec = {
        name: "最简设计",
        primaryColor: "#000000",
        secondaryColor: "#FFFFFF",
        accentColor: "#FF0000",
        fontFamily: "Arial",
        // designSpec and logoUrl are optional
      };
      
      const prompt = buildPPTPrompt(null, [], undefined, minimalSpec);
      
      expect(prompt).toContain("最简设计");
      expect(prompt).toContain("#000000");
      expect(prompt).not.toContain("undefined");
    });

    it("should handle very long design spec text", () => {
      const spec: DesignSpec = {
        name: "Test",
        primaryColor: "#000",
        secondaryColor: "#FFF",
        accentColor: "#F00",
        fontFamily: "Arial",
        designSpec: "x".repeat(10000), // 10KB design spec
      };
      
      const prompt = buildPPTPrompt(null, [], undefined, spec);
      
      expect(prompt).toContain("x".repeat(10000));
    });

    it("should handle maximum number of images", () => {
      const images: ImageConfig[] = Array.from({ length: 50 }, (_, i) => ({
        fileId: `file_${i}`,
        usageMode: 'must_use',
        category: 'content',
        description: `图片 ${i}`,
      }));
      
      const prompt = buildPPTPrompt(null, images);
      
      expect(prompt).toContain("必须使用的图片");
      expect(prompt).toContain("file_0");
      expect(prompt).toContain("file_49");
    });

    it("should handle images with no description", () => {
      const images: ImageConfig[] = [
        { fileId: "file1", usageMode: 'ai_decide' }, // No category, no description
      ];
      
      const prompt = buildPPTPrompt(null, images);
      
      expect(prompt).toContain("file1");
      expect(prompt).not.toContain("undefined");
    });

    it("should handle mixed usage modes", () => {
      const images: ImageConfig[] = [
        { fileId: "must1", usageMode: 'must_use', category: 'cover' },
        { fileId: "suggest1", usageMode: 'suggest_use', category: 'content' },
        { fileId: "ai1", usageMode: 'ai_decide', category: 'chart' },
        { fileId: "no_mode", category: 'other' }, // No usageMode
      ];
      
      const prompt = buildPPTPrompt(null, images);
      
      expect(prompt).toContain("必须使用");
      expect(prompt).toContain("建议使用");
      expect(prompt).toContain("可选使用");
      expect(prompt).toContain("must1");
      expect(prompt).toContain("ai1");
    });
  });

  describe("getMimeType - Edge Cases", () => {
    it("should handle filenames without extension", () => {
      expect(getMimeType("noextension")).toBe("application/octet-stream");
      expect(getMimeType("file")).toBe("application/octet-stream");
    });

    it("should handle multiple dots in filename", () => {
      expect(getMimeType("my.file.name.pdf")).toBe("application/pdf");
      expect(getMimeType("test.backup.old.pptx")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    });

    it("should handle very long filenames", () => {
      const longName = "a".repeat(500) + ".pdf";
      expect(getMimeType(longName)).toBe("application/pdf");
    });

    it("should handle unicode characters", () => {
      expect(getMimeType("文档.pdf")).toBe("application/pdf");
      expect(getMimeType("プレゼン.pptx")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
      expect(getMimeType("презентация.pdf")).toBe("application/pdf");
    });

    it("should handle mixed case extensions", () => {
      expect(getMimeType("File.PDF")).toBe("application/pdf");
      expect(getMimeType("File.PdF")).toBe("application/pdf");
      expect(getMimeType("File.pPtX")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    });

    it("should handle edge case extensions", () => {
      expect(getMimeType(".pdf")).toBe("application/pdf");
      expect(getMimeType("..pdf")).toBe("application/pdf");
      expect(getMimeType("...pdf")).toBe("application/pdf");
    });

    it("should handle empty string", () => {
      expect(getMimeType("")).toBe("application/octet-stream");
    });

    it("should handle just a dot", () => {
      expect(getMimeType(".")).toBe("application/octet-stream");
      expect(getMimeType("..")).toBe("application/octet-stream");
    });
  });

  describe("File Type Detection", () => {
    it("should correctly identify PPTX files", () => {
      expect(getMimeType("test.pptx")).toContain("presentation");
      expect(getMimeType("TEST.PPTX")).toContain("presentation");
    });

    it("should correctly identify PDF files", () => {
      expect(getMimeType("test.pdf")).toBe("application/pdf");
      expect(getMimeType("TEST.PDF")).toBe("application/pdf");
    });

    it("should correctly identify image files", () => {
      expect(getMimeType("test.png")).toBe("image/png");
      expect(getMimeType("test.jpg")).toBe("image/jpeg");
      expect(getMimeType("test.jpeg")).toBe("image/jpeg");
      expect(getMimeType("test.webp")).toBe("image/webp");
    });
  });
});

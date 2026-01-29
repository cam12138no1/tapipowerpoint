import { describe, expect, it } from "vitest";
import { PPT_TEMPLATES, getTemplateById, buildPromptFromTemplate, MCKINSEY_TEMPLATE } from "../shared/templates";

describe("PPT Templates", () => {
  describe("Template Data", () => {
    it("should have at least 5 templates", () => {
      expect(PPT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    });

    it("should have unique template IDs", () => {
      const ids = PPT_TEMPLATES.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have all required fields for each template", () => {
      PPT_TEMPLATES.forEach(template => {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.nameEn).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(template.category).toMatch(/^(consulting|corporate|creative)$/);
        expect(template.colors).toBeDefined();
        expect(template.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(template.typography).toBeDefined();
        expect(template.typography.headingFont).toBeTruthy();
        expect(template.typography.bodyFont).toBeTruthy();
        expect(template.layout).toBeDefined();
        expect(template.structure).toBeDefined();
        expect(template.designSpec).toBeTruthy();
      });
    });
  });

  describe("McKinsey Template", () => {
    it("should have correct McKinsey blue color", () => {
      expect(MCKINSEY_TEMPLATE.colors.primary).toBe("#0033A0");
    });

    it("should use Georgia for headings and Arial for body", () => {
      expect(MCKINSEY_TEMPLATE.typography.headingFont).toBe("Georgia");
      expect(MCKINSEY_TEMPLATE.typography.bodyFont).toBe("Arial");
    });

    it("should use pyramid framework", () => {
      expect(MCKINSEY_TEMPLATE.structure.framework).toBe("pyramid");
    });

    it("should require action titles", () => {
      expect(MCKINSEY_TEMPLATE.structure.actionTitles).toBe(true);
    });

    it("should include executive summary", () => {
      expect(MCKINSEY_TEMPLATE.structure.executiveSummary).toBe(true);
    });

    it("should have design spec with key McKinsey principles", () => {
      expect(MCKINSEY_TEMPLATE.designSpec).toContain("金字塔原理");
      expect(MCKINSEY_TEMPLATE.designSpec).toContain("MECE");
      expect(MCKINSEY_TEMPLATE.designSpec).toContain("SCR");
      expect(MCKINSEY_TEMPLATE.designSpec).toContain("行动标题");
    });
  });

  describe("getTemplateById", () => {
    it("should return template when ID exists", () => {
      const template = getTemplateById("mckinsey");
      expect(template).toBeDefined();
      expect(template?.id).toBe("mckinsey");
      expect(template?.name).toBe("麦肯锡咨询风格");
    });

    it("should return undefined for non-existent ID", () => {
      const template = getTemplateById("non-existent");
      expect(template).toBeUndefined();
    });

    it("should find all templates by their IDs", () => {
      PPT_TEMPLATES.forEach(t => {
        const found = getTemplateById(t.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(t.id);
      });
    });
  });

  describe("buildPromptFromTemplate", () => {
    it("should include template name in prompt", () => {
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE);
      expect(prompt).toContain("麦肯锡咨询风格");
    });

    it("should include color specifications", () => {
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE);
      expect(prompt).toContain("#0033A0");
      expect(prompt).toContain("主色调");
    });

    it("should include typography specifications", () => {
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE);
      expect(prompt).toContain("Georgia");
      expect(prompt).toContain("Arial");
      expect(prompt).toContain("标题字体");
    });

    it("should include structure framework", () => {
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE);
      expect(prompt).toContain("金字塔原理");
    });

    it("should include design spec", () => {
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE);
      expect(prompt).toContain("详细设计规范");
    });

    it("should append user requirements when provided", () => {
      const userReq = "请使用公司Logo并调整配色为深蓝色";
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE, userReq);
      expect(prompt).toContain("用户特定要求");
      expect(prompt).toContain(userReq);
    });

    it("should not include user requirements section when not provided", () => {
      const prompt = buildPromptFromTemplate(MCKINSEY_TEMPLATE);
      expect(prompt).not.toContain("用户特定要求");
    });
  });

  describe("Template Categories", () => {
    it("should have consulting templates", () => {
      const consulting = PPT_TEMPLATES.filter(t => t.category === "consulting");
      expect(consulting.length).toBeGreaterThanOrEqual(3);
    });

    it("should have corporate templates", () => {
      const corporate = PPT_TEMPLATES.filter(t => t.category === "corporate");
      expect(corporate.length).toBeGreaterThanOrEqual(1);
    });

    it("should have creative templates", () => {
      const creative = PPT_TEMPLATES.filter(t => t.category === "creative");
      expect(creative.length).toBeGreaterThanOrEqual(1);
    });
  });
});

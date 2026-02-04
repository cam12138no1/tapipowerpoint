import { describe, expect, it } from "vitest";
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
  isAppError,
  getErrorMessage,
  toAppError,
} from "../shared/_core/errors";

describe("Error Handling Utilities", () => {
  describe("AppError", () => {
    it("should create error with code and default message", () => {
      const error = new AppError(ERROR_CODES.NOT_FOUND);

      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(error.message).toBe(ERROR_MESSAGES[ERROR_CODES.NOT_FOUND]);
      expect(error.name).toBe("AppError");
    });

    it("should create error with custom message", () => {
      const customMessage = "Custom error message";
      const error = new AppError(ERROR_CODES.INTERNAL_ERROR, customMessage);

      expect(error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.message).toBe(customMessage);
    });

    it("should include details when provided", () => {
      const details = { field: "username", reason: "too short" };
      const error = new AppError(ERROR_CODES.VALIDATION_ERROR, undefined, details);

      expect(error.details).toEqual(details);
    });

    it("should serialize to JSON correctly", () => {
      const error = new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Not logged in",
        { redirectTo: "/login" }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Not logged in",
        details: { redirectTo: "/login" },
      });
    });
  });

  describe("isAppError", () => {
    it("should return true for AppError instances", () => {
      const error = new AppError(ERROR_CODES.NOT_FOUND);
      expect(isAppError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Regular error");
      expect(isAppError(error)).toBe(false);
    });

    it("should return false for non-error values", () => {
      expect(isAppError("string")).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError({})).toBe(false);
    });
  });

  describe("getErrorMessage", () => {
    it("should return message from AppError", () => {
      const error = new AppError(ERROR_CODES.NOT_FOUND, "Resource not found");
      expect(getErrorMessage(error)).toBe("Resource not found");
    });

    it("should return message from regular Error", () => {
      const error = new Error("Something went wrong");
      expect(getErrorMessage(error)).toBe("Something went wrong");
    });

    it("should return string as-is", () => {
      expect(getErrorMessage("Error string")).toBe("Error string");
    });

    it("should return generic message for unknown error types", () => {
      expect(getErrorMessage({})).toBe(ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR]);
      expect(getErrorMessage(null)).toBe(ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR]);
    });

    it("should detect network errors", () => {
      const error = new Error("Failed to fetch");
      expect(getErrorMessage(error)).toContain("网络");
    });

    it("should detect timeout errors", () => {
      const error = new Error("Request timeout");
      expect(getErrorMessage(error)).toBe(ERROR_MESSAGES[ERROR_CODES.TIMEOUT]);
    });
  });

  describe("toAppError", () => {
    it("should return same AppError if already AppError", () => {
      const original = new AppError(ERROR_CODES.NOT_FOUND);
      const result = toAppError(original);

      expect(result).toBe(original);
    });

    it("should convert regular Error to AppError", () => {
      const original = new Error("Something failed");
      const result = toAppError(original);

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(result.message).toBe("Something failed");
    });

    it("should handle unknown error types", () => {
      const result = toAppError("string error");

      expect(isAppError(result)).toBe(true);
      expect(result.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });

  describe("ERROR_CODES", () => {
    it("should have matching messages for all codes", () => {
      const codes = Object.values(ERROR_CODES);

      codes.forEach((code) => {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(typeof ERROR_MESSAGES[code]).toBe("string");
        expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      });
    });
  });
});

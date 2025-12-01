/**
 * Unit tests for authentication module
 */

// Mock the fs and os modules BEFORE any imports
jest.mock("node:fs");
jest.mock("node:os", () => ({
  homedir: jest.fn().mockReturnValue("/home/testuser"),
}));

import {
  generateSubmissionNumber,
  generateMD5Hash,
  createAuthHeader,
  validateCredentialsFormat,
  loadCredentials,
} from "../../src/api/auth";
import type { QuickFileCredentials } from "../../src/types/quickfile";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;
const mockHomedir = homedir as jest.MockedFunction<typeof homedir>;

describe("Authentication Module", () => {
  describe("generateSubmissionNumber", () => {
    it("should generate a non-empty string", () => {
      const result = generateSubmissionNumber();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should generate unique values on successive calls", () => {
      const values = new Set<string>();
      for (let i = 0; i < 100; i++) {
        values.add(generateSubmissionNumber());
      }
      // All 100 should be unique
      expect(values.size).toBe(100);
    });

    it("should contain timestamp component", () => {
      const result = generateSubmissionNumber();
      // The submission number should be long enough to contain
      // both timestamp (base36) and counter components
      expect(result.length).toBeGreaterThan(8);
    });

    it("should contain padded counter", () => {
      const result = generateSubmissionNumber();
      // Should end with 4-digit padded counter
      expect(result).toMatch(/\d{4}$/);
    });
  });

  describe("generateMD5Hash", () => {
    it("should generate 32-character hex string", () => {
      const result = generateMD5Hash("12345", "api-key", "sub-001");
      expect(result).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should generate consistent hash for same input", () => {
      const hash1 = generateMD5Hash("12345", "api-key", "sub-001");
      const hash2 = generateMD5Hash("12345", "api-key", "sub-001");
      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different inputs", () => {
      const hash1 = generateMD5Hash("12345", "api-key", "sub-001");
      const hash2 = generateMD5Hash("12345", "api-key", "sub-002");
      expect(hash1).not.toBe(hash2);
    });

    it("should concatenate inputs correctly", () => {
      // MD5('123api456') should equal a known value
      const result = generateMD5Hash("123", "api", "456");
      // We can verify the hash is computed on concatenated string
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require("node:crypto");
      expect(result).toBe(
        crypto.createHash("md5").update("123api456").digest("hex"), // NOSONAR - testing QuickFile API requirement
      );
    });

    it("should handle empty strings", () => {
      const result = generateMD5Hash("", "", "");
      expect(result).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should handle special characters", () => {
      const result = generateMD5Hash("123!@#", "key-with-dashes", "sub_123");
      expect(result).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe("createAuthHeader", () => {
    const mockCredentials: QuickFileCredentials = {
      accountNumber: "12345678",
      apiKey: "XXXX-YYYY-ZZZZ",
      applicationId: "12345678-1234-1234-1234-123456789012",
    };

    it("should create header with correct MessageType", () => {
      const header = createAuthHeader(mockCredentials);
      expect(header.MessageType).toBe("Request");
    });

    it("should include SubmissionNumber", () => {
      const header = createAuthHeader(mockCredentials);
      expect(header.SubmissionNumber).toBeDefined();
      expect(typeof header.SubmissionNumber).toBe("string");
    });

    it("should include Authentication with AccNumber", () => {
      const header = createAuthHeader(mockCredentials);
      expect(header.Authentication.AccNumber).toBe("12345678");
    });

    it("should include Authentication with ApplicationID", () => {
      const header = createAuthHeader(mockCredentials);
      expect(header.Authentication.ApplicationID).toBe(
        "12345678-1234-1234-1234-123456789012",
      );
    });

    it("should include MD5Value hash", () => {
      const header = createAuthHeader(mockCredentials);
      expect(header.Authentication.MD5Value).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should not include TestMode by default", () => {
      const header = createAuthHeader(mockCredentials);
      expect(header.TestMode).toBeUndefined();
    });

    it("should include TestMode when enabled", () => {
      const header = createAuthHeader(mockCredentials, true);
      expect(header.TestMode).toBe(true);
    });

    it("should not include TestMode when explicitly false", () => {
      const header = createAuthHeader(mockCredentials, false);
      expect(header.TestMode).toBeUndefined();
    });

    it("should generate different MD5 for each call (due to submission number)", () => {
      const header1 = createAuthHeader(mockCredentials);
      const header2 = createAuthHeader(mockCredentials);
      expect(header1.Authentication.MD5Value).not.toBe(
        header2.Authentication.MD5Value,
      );
    });

    it("should generate different SubmissionNumber for each call", () => {
      const header1 = createAuthHeader(mockCredentials);
      const header2 = createAuthHeader(mockCredentials);
      expect(header1.SubmissionNumber).not.toBe(header2.SubmissionNumber);
    });
  });

  describe("validateCredentialsFormat", () => {
    it("should return true for valid credentials", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(true);
    });

    it("should return false for non-numeric account number", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "ABC12345",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });

    it("should return false for empty account number", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });

    it("should return false for short API key", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "SHORT",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });

    it("should return false for empty API key", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });

    it("should return false for invalid UUID format", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "not-a-valid-uuid",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });

    it("should return false for UUID without dashes", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "12345678123412341234123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });

    it("should accept lowercase UUID", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "abcdefab-abcd-abcd-abcd-abcdefabcdef",
      };
      expect(validateCredentialsFormat(credentials)).toBe(true);
    });

    it("should accept uppercase UUID", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "ABCDEFAB-ABCD-ABCD-ABCD-ABCDEFABCDEF",
      };
      expect(validateCredentialsFormat(credentials)).toBe(true);
    });

    it("should accept mixed case UUID", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "XXXX-YYYY-ZZZZ",
        applicationId: "AbCdEfAb-AbCd-AbCd-AbCd-AbCdEfAbCdEf",
      };
      expect(validateCredentialsFormat(credentials)).toBe(true);
    });

    it("should accept API key at minimum length (10)", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "1234567890",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(true);
    });

    it("should reject API key just under minimum length", () => {
      const credentials: QuickFileCredentials = {
        accountNumber: "12345678",
        apiKey: "123456789",
        applicationId: "12345678-1234-1234-1234-123456789012",
      };
      expect(validateCredentialsFormat(credentials)).toBe(false);
    });
  });

  describe("loadCredentials", () => {
    const validCredentials = {
      accountNumber: "12345678",
      apiKey: "XXXX-YYYY-ZZZZ",
      applicationId: "12345678-1234-1234-1234-123456789012",
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockHomedir.mockReturnValue("/home/testuser");
    });

    it("should load valid credentials from file", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(validCredentials));

      const result = loadCredentials();

      expect(result).toEqual(validCredentials);
      expect(mockExistsSync).toHaveBeenCalledWith(
        "/home/testuser/.config/.quickfile-mcp/credentials.json",
      );
    });

    it("should throw error if credentials file does not exist", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => loadCredentials()).toThrow(
        "QuickFile credentials not found",
      );
    });

    it("should throw error for invalid JSON", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue("{ invalid json }");

      expect(() => loadCredentials()).toThrow(
        "Invalid JSON in credentials file",
      );
    });

    it("should throw error if accountNumber is missing", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          apiKey: "XXXX-YYYY-ZZZZ",
          applicationId: "12345678-1234-1234-1234-123456789012",
        }),
      );

      expect(() => loadCredentials()).toThrow(
        "Missing required credential fields",
      );
    });

    it("should throw error if apiKey is missing", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          accountNumber: "12345678",
          applicationId: "12345678-1234-1234-1234-123456789012",
        }),
      );

      expect(() => loadCredentials()).toThrow(
        "Missing required credential fields",
      );
    });

    it("should throw error if applicationId is missing", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          accountNumber: "12345678",
          apiKey: "XXXX-YYYY-ZZZZ",
        }),
      );

      expect(() => loadCredentials()).toThrow(
        "Missing required credential fields",
      );
    });

    it("should throw error if all credentials are missing", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      expect(() => loadCredentials()).toThrow(
        "Missing required credential fields",
      );
    });

    it("should read file with utf-8 encoding", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(validCredentials));

      loadCredentials();

      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.any(String),
        "utf-8",
      );
    });

    it("should include path in error message when file not found", () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => loadCredentials()).toThrow(
        /\/home\/testuser\/.config\/.quickfile-mcp\/credentials.json/,
      );
    });

    it("should re-throw non-SyntaxError errors", () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => loadCredentials()).toThrow("Permission denied");
    });
  });
});

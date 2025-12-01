/**
 * Unit tests for API client module
 */

import { QuickFileApiError } from "../../src/api/client";

// Mock the auth module to prevent file system access
jest.mock("../../src/api/auth", () => ({
  loadCredentials: jest.fn().mockReturnValue({
    accountNumber: "12345678",
    apiKey: "TEST-API-KEY-1234",
    applicationId: "12345678-1234-1234-1234-123456789012",
  }),
  createAuthHeader: jest.fn().mockReturnValue({
    MessageType: "Request",
    SubmissionNumber: "test-submission",
    Authentication: {
      AccNumber: "12345678",
      MD5Value: "abc123def456",
      ApplicationID: "12345678-1234-1234-1234-123456789012",
    },
  }),
}));

describe("QuickFileApiError", () => {
  describe("constructor", () => {
    it("should create error with message and code", () => {
      const error = new QuickFileApiError("Not found", "NOT_FOUND");

      expect(error.message).toBe("Not found");
      expect(error.code).toBe("NOT_FOUND");
      expect(error.name).toBe("QuickFileApiError");
    });

    it("should be instanceof Error", () => {
      const error = new QuickFileApiError("Test error", "TEST");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(QuickFileApiError);
    });

    it("should preserve stack trace", () => {
      const error = new QuickFileApiError("Test", "CODE");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("QuickFileApiError");
    });

    it("should handle empty message", () => {
      const error = new QuickFileApiError("", "EMPTY");

      expect(error.message).toBe("");
      expect(error.code).toBe("EMPTY");
    });

    it("should handle special characters in message", () => {
      const message = 'Error: "Something" went wrong & failed < test >';
      const error = new QuickFileApiError(message, "SPECIAL");

      expect(error.message).toBe(message);
    });

    it("should handle HTTP status codes", () => {
      const error = new QuickFileApiError("HTTP 401: Unauthorized", "401");

      expect(error.code).toBe("401");
      expect(error.message).toBe("HTTP 401: Unauthorized");
    });

    it("should handle network error codes", () => {
      const error = new QuickFileApiError(
        "Connection refused",
        "NETWORK_ERROR",
      );

      expect(error.code).toBe("NETWORK_ERROR");
    });

    it("should handle timeout errors", () => {
      const error = new QuickFileApiError(
        "Request timeout after 30000ms",
        "TIMEOUT",
      );

      expect(error.code).toBe("TIMEOUT");
    });
  });

  describe("error code patterns", () => {
    it("should work with common QuickFile error codes", () => {
      const errorCodes = [
        "INVALID_AUTH",
        "CLIENT_404",
        "INVOICE_NOT_FOUND",
        "PARSE_ERROR",
        "NETWORK_ERROR",
        "TIMEOUT",
        "UNKNOWN",
        "VALIDATION_ERROR",
      ];

      errorCodes.forEach((code) => {
        const error = new QuickFileApiError(`Error with code ${code}`, code);
        expect(error.code).toBe(code);
      });
    });
  });
});

describe("QuickFileApiClient", () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // Import after mocking
  const getClient = async () => {
    const { QuickFileApiClient } = await import("../../src/api/client");
    return new QuickFileApiClient();
  };

  describe("constructor", () => {
    it("should create client with default options", async () => {
      const client = await getClient();

      expect(client.isTestMode()).toBe(false);
    });

    it("should create client with test mode enabled", async () => {
      const { QuickFileApiClient } = await import("../../src/api/client");
      const client = new QuickFileApiClient({ testMode: true });

      expect(client.isTestMode()).toBe(true);
    });

    it("should get account number", async () => {
      const client = await getClient();

      expect(client.getAccountNumber()).toBe("12345678");
    });
  });

  describe("setTestMode", () => {
    it("should toggle test mode on", async () => {
      const client = await getClient();

      client.setTestMode(true);

      expect(client.isTestMode()).toBe(true);
    });

    it("should toggle test mode off", async () => {
      const { QuickFileApiClient } = await import("../../src/api/client");
      const client = new QuickFileApiClient({ testMode: true });

      client.setTestMode(false);

      expect(client.isTestMode()).toBe(false);
    });
  });

  describe("request", () => {
    it("should make successful API request", async () => {
      const mockResponse = {
        Client_Search: {
          Header: { MessageType: "Response", SubmissionNumber: "test-123" },
          Body: { Clients: [{ ClientID: 1, CompanyName: "Test Corp" }] },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();
      const result = await client.request("Client_Search", {
        CompanyName: "Test",
      });

      expect(result).toEqual({
        Clients: [{ ClientID: 1, CompanyName: "Test Corp" }],
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw on HTTP error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const client = await getClient();

      await expect(client.request("Client_Search", {})).rejects.toThrow(
        QuickFileApiError,
      );

      // Need to mock again for the second assertion
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(client.request("Client_Search", {})).rejects.toThrow(
        "HTTP 500",
      );
    });

    it("should throw on API error response", async () => {
      const mockResponse = {
        Errors: [
          { ErrorCode: "AUTH_FAILED", ErrorMessage: "Invalid credentials" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();

      await expect(client.request("Client_Search", {})).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("should combine multiple API errors", async () => {
      const mockResponse = {
        Errors: [
          { ErrorCode: "ERROR_1", ErrorMessage: "First error" },
          { ErrorCode: "ERROR_2", ErrorMessage: "Second error" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();

      await expect(client.request("Client_Search", {})).rejects.toThrow(
        "First error; Second error",
      );
    });

    it("should throw on timeout", async () => {
      // Create a client with a very short timeout
      const { QuickFileApiClient } = await import("../../src/api/client");
      const client = new QuickFileApiClient({ timeout: 1 });

      // Mock a slow response - use AbortController signal handling
      mockFetch.mockImplementationOnce(
        (_, options: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timeoutId = setTimeout(resolve, 100);
            if (options?.signal) {
              options.signal.addEventListener("abort", () => {
                clearTimeout(timeoutId);
                const abortError = new Error("Aborted");
                abortError.name = "AbortError";
                reject(abortError);
              });
            }
          }),
      );

      await expect(client.request("Client_Search", {})).rejects.toMatchObject({
        code: "TIMEOUT",
      });
    });

    it("should throw on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const client = await getClient();

      await expect(client.request("Client_Search", {})).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });
    });

    it("should throw on invalid response structure", async () => {
      const mockResponse = {
        // Missing method key and Body
        SomeOtherKey: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();

      await expect(client.request("Client_Search", {})).rejects.toMatchObject({
        code: "PARSE_ERROR",
      });
    });

    it("should build correct URL for simple method names", async () => {
      const mockResponse = {
        Client_Search: {
          Header: { MessageType: "Response", SubmissionNumber: "test" },
          Body: { Clients: [] },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();
      await client.request("Client_Search", {});

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.quickfile.co.uk/1_2/client/search",
        expect.any(Object),
      );
    });

    it("should build correct URL for compound method names", async () => {
      const mockResponse = {
        System_GetAccountDetails: {
          Header: { MessageType: "Response", SubmissionNumber: "test" },
          Body: {},
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();
      await client.request("System_GetAccountDetails", {});

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.quickfile.co.uk/1_2/system/getaccountdetails",
        expect.any(Object),
      );
    });

    it("should send correct headers", async () => {
      const mockResponse = {
        Client_Search: {
          Header: { MessageType: "Response", SubmissionNumber: "test" },
          Body: {},
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();
      await client.request("Client_Search", {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }),
      );
    });

    it("should handle response with alternative key structure", async () => {
      // Some responses might have a different structure
      const mockResponse = {
        AnotherMethod_Response: {
          Header: { MessageType: "Response", SubmissionNumber: "test" },
          Body: { data: "test" },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = await getClient();
      const result = await client.request("SomeMethod_Call", {});

      expect(result).toEqual({ data: "test" });
    });
  });
});

describe("getApiClient", () => {
  beforeEach(() => {
    // Reset module to clear singleton
    jest.resetModules();
  });

  it("should return same instance on multiple calls", async () => {
    const { getApiClient } = await import("../../src/api/client");

    const client1 = getApiClient();
    const client2 = getApiClient();

    expect(client1).toBe(client2);
  });

  it("should create new instance when options provided", async () => {
    const { getApiClient } = await import("../../src/api/client");

    // First call creates default instance
    getApiClient();
    // Passing options creates new instance with those options
    const clientWithOptions = getApiClient({ testMode: true });

    // New options should create a new instance
    expect(clientWithOptions.isTestMode()).toBe(true);
  });
});

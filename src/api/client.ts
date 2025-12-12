/**
 * QuickFile API Client
 * Handles all HTTP communication with QuickFile API
 * https://api.quickfile.co.uk/
 */

import type {
  QuickFileCredentials,
  QuickFileRequest,
  QuickFileResponse,
  QuickFileError,
  QuickFileHeader,
} from "../types/quickfile.js";
import { loadCredentials, createAuthHeader } from "./auth.js";

// API Configuration
const API_BASE_URL = "https://api.quickfile.co.uk";
const API_VERSION = "1_2";

export interface ApiClientOptions {
  testMode?: boolean;
  timeout?: number;
}

// =============================================================================
// Helper Functions (extracted to reduce cognitive complexity)
// =============================================================================

function logDebugRequest(
  url: string,
  request: { payload: { Header: QuickFileHeader; Body?: unknown } },
): void {
  console.error(`[DEBUG] URL: ${url}`);
  const safeRequest = {
    payload: {
      Header: {
        ...request.payload.Header,
        Authentication: {
          AccNumber: "***REDACTED***",
          MD5Value: "***REDACTED***",
          ApplicationID: request.payload.Header.Authentication.ApplicationID,
        },
      },
      Body: request.payload.Body,
    },
  };
  console.error(`[DEBUG] Request: ${JSON.stringify(safeRequest, null, 2)}`);
}

async function logDebugResponse(response: Response): Promise<void> {
  const responseText = await response.clone().text();
  console.error(`[DEBUG] Response Status: ${response.status}`);
  console.error(`[DEBUG] Response: ${responseText}`);
}

function extractResponseBody<TResponse>(
  data: QuickFileResponse<TResponse>,
  methodName: string,
): TResponse {
  const methodResponse = data[methodName];
  if (methodResponse && !Array.isArray(methodResponse)) {
    return (methodResponse as { Body: TResponse }).Body;
  }

  // Try to find any response key
  const responseKey = Object.keys(data).find(
    (key) =>
      key !== "Errors" &&
      typeof data[key] === "object" &&
      !Array.isArray(data[key]),
  );
  if (responseKey) {
    const response = data[responseKey] as { Body: TResponse };
    return response.Body;
  }
  throw new QuickFileApiError("Invalid API response structure", "PARSE_ERROR");
}

function handleRequestError(error: unknown, timeout: number): never {
  if (error instanceof QuickFileApiError) {
    throw error;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      throw new QuickFileApiError(
        `Request timeout after ${timeout}ms`,
        "TIMEOUT",
      );
    }
    throw new QuickFileApiError(error.message, "NETWORK_ERROR");
  }
  throw new QuickFileApiError("Unknown error occurred", "UNKNOWN");
}

export class QuickFileApiClient {
  private readonly credentials: QuickFileCredentials;
  private testMode: boolean;
  private readonly timeout: number;

  constructor(options: ApiClientOptions = {}) {
    this.credentials = loadCredentials();
    this.testMode = options.testMode ?? false;
    this.timeout = options.timeout ?? 30000; // 30 second default
  }

  /**
   * Make an API request to QuickFile
   * @param methodName - API method name (e.g., 'Client_Search', 'Invoice_Get')
   * @param body - Request body parameters
   * @returns Parsed response body
   */
  async request<TRequest, TResponse>(
    methodName: string,
    body: TRequest,
    options?: { noBody?: boolean },
  ): Promise<TResponse> {
    const url = this.buildUrl(methodName);
    const header = createAuthHeader(this.credentials, this.testMode);

    // Some QuickFile endpoints don't accept a Body element at all
    const request: QuickFileRequest<TRequest> | { payload: { Header: typeof header } } = 
      options?.noBody
        ? { payload: { Header: header } }
        : { payload: { Header: header, Body: body } };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (process.env.QUICKFILE_DEBUG) {
        logDebugRequest(url, request);
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (process.env.QUICKFILE_DEBUG) {
        await logDebugResponse(response);
      }

      if (!response.ok) {
        throw new QuickFileApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status.toString(),
        );
      }

      const data = (await response.json()) as QuickFileResponse<TResponse>;

      if (data.Errors && data.Errors.length > 0) {
        const errors = data.Errors;
        throw new QuickFileApiError(
          errors.map((e: QuickFileError) => e.ErrorMessage).join("; "),
          errors[0].ErrorCode,
        );
      }

      return extractResponseBody(data, methodName);
    } catch (error) {
      clearTimeout(timeoutId);
      return handleRequestError(error, this.timeout);
    }
  }

  /**
   * Build the API URL for a method
   */
  private buildUrl(methodName: string): string {
    // Convert method name to URL path
    // e.g., 'System_GetAccountDetails' -> 'system/getaccountdetails'
    const [category, ...methodParts] = methodName.split("_");
    const method = methodParts.join("").toLowerCase();
    const path = `${category.toLowerCase()}/${method}`;
    return `${API_BASE_URL}/${API_VERSION}/${path}`;
  }

  /**
   * Enable/disable test mode
   */
  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
  }

  /**
   * Get current test mode status
   */
  isTestMode(): boolean {
    return this.testMode;
  }

  /**
   * Get account number (for display/logging)
   */
  getAccountNumber(): string {
    return this.credentials.accountNumber;
  }
}

/**
 * Custom error class for QuickFile API errors
 */
export class QuickFileApiError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "QuickFileApiError";
    this.code = code;
  }
}

// Singleton instance for convenience
let defaultClient: QuickFileApiClient | null = null;

/**
 * Get or create the default API client
 */
export function getApiClient(options?: ApiClientOptions): QuickFileApiClient {
  if (!defaultClient || options) {
    defaultClient = new QuickFileApiClient(options);
  }
  return defaultClient;
}

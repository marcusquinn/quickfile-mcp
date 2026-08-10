/** QuickFile beta REST API client. */

import type {
  BusinessProfile,
  QuickFileCredentials,
} from "../types/quickfile.js";
import { loadCredentials } from "./auth.js";

const API_BASE_URL = "https://api-beta.quickfile.co.uk";

export interface ApiClientOptions {
  account: string;
  timeout?: number;
}

export interface RestRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, unknown>;
  body?: unknown;
  form?: FormData;
}

function appendQuery(url: URL, query: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

function safeErrorCode(status: number): string {
  if (status === 401 || status === 403) {
    return "INVALID_AUTH";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  return String(status);
}

function handleRequestError(error: unknown, timeout: number): never {
  if (error instanceof QuickFileApiError) {
    throw error;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new QuickFileApiError(
        `Request timeout after ${timeout}ms`,
        "TIMEOUT",
      );
    }
    throw new QuickFileApiError("QuickFile network request failed", "NETWORK_ERROR");
  }
  throw new QuickFileApiError("Unknown error occurred", "UNKNOWN");
}

export class QuickFileApiClient {
  private readonly credentials: QuickFileCredentials;
  private readonly timeout: number;

  constructor(options: ApiClientOptions) {
    this.credentials = loadCredentials(options.account);
    this.timeout = options.timeout ?? 30000;
  }

  async request<TResponse>(
    path: string,
    options: RestRequestOptions = {},
  ): Promise<TResponse> {
    if (!path.startsWith("/")) {
      throw new QuickFileApiError(
        `Legacy QuickFile method "${path}" is not supported by REST mode`,
        "LEGACY_UNSUPPORTED",
      );
    }

    const url = new URL(path, API_BASE_URL);
    if (url.origin !== API_BASE_URL) {
      throw new QuickFileApiError(
        "QuickFile REST path must remain on the configured API origin",
        "INVALID_PATH",
      );
    }
    appendQuery(url, options.query ?? {});
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.credentials.bearerToken}`,
    };
    let body: RequestInit["body"];
    if (options.form) {
      body = options.form;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      if (process.env.QUICKFILE_DEBUG) {
        console.error(
          `[DEBUG] QuickFile ${options.method ?? "GET"} ${url.pathname} account=${this.credentials.account}`,
        );
      }
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new QuickFileApiError(
          `QuickFile REST request failed with HTTP ${response.status}`,
          safeErrorCode(response.status),
        );
      }
      if (response.status === 204) {
        return {} as TResponse;
      }
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as TResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      return handleRequestError(error, this.timeout);
    }
  }

  getAccount(): string {
    return this.credentials.account;
  }

  getBusinessProfile(): BusinessProfile | undefined {
    return this.credentials.businessProfile;
  }
}

export class QuickFileApiError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "QuickFileApiError";
    this.code = code;
  }
}

const clients = new Map<string, QuickFileApiClient>();

export function getApiClient(
  account: string,
  options?: Omit<ApiClientOptions, "account">,
): QuickFileApiClient {
  const key = account.trim().toLowerCase();
  if (options) {
    return new QuickFileApiClient({ account: key, ...options });
  }
  const existing = clients.get(key);
  if (existing) {
    return existing;
  }
  const client = new QuickFileApiClient({ account: key });
  clients.set(key, client);
  return client;
}

export function _clearClientCache(): void {
  clients.clear();
}

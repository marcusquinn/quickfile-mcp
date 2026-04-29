/**
 * QuickFile API Authentication
 * Implements MD5 hash-based authentication as per QuickFile API docs
 * https://api.quickfile.co.uk/#4
 *
 * SECURITY NOTE: This module uses MD5 hashing for API authentication.
 * MD5 is cryptographically weak and would not be recommended for new systems.
 * However, this is REQUIRED by the QuickFile API specification and cannot
 * be changed without QuickFile updating their authentication mechanism.
 *
 * The authentication flow:
 * 1. Generate a unique submission number for each request
 * 2. Create MD5 hash of: AccountNumber + APIKey + SubmissionNumber
 * 3. Include the hash in the request header for server-side verification
 *
 * The API key itself is never transmitted directly - only the hash is sent.
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  QuickFileCredentials,
  QuickFileHeader,
} from "../types/quickfile.js";

// Credential cache (file read once per process)
let _cachedCredentials: QuickFileCredentials | null = null;

// Credential storage location following project pattern
const CREDENTIALS_PATH = join(
  homedir(),
  ".config",
  ".quickfile-mcp",
  "credentials.json",
);

// Submission number counter (auto-increments per session)
let submissionCounter = 0;

/**
 * Load credentials from secure storage.
 * Reads the file once per process and caches the result.
 * Pass `forceReload = true` in tests to bypass the cache.
 */
export function loadCredentials(forceReload = false): QuickFileCredentials {
  if (_cachedCredentials && !forceReload) {
    return _cachedCredentials;
  }

  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `QuickFile credentials not found at ${CREDENTIALS_PATH}\n` +
        "Please create the file with: accountNumber, apiKey, applicationId",
    );
  }

  try {
    const content = readFileSync(CREDENTIALS_PATH, "utf-8");
    const credentials = JSON.parse(content) as QuickFileCredentials;

    // Validate required fields
    if (
      !credentials.accountNumber ||
      !credentials.apiKey ||
      !credentials.applicationId
    ) {
      throw new Error(
        "Missing required credential fields: accountNumber, apiKey, applicationId",
      );
    }

    // Validate optional businessProfile block when present
    if (credentials.businessProfile !== undefined) {
      const bp = credentials.businessProfile;
      if (typeof bp !== "object" || bp === null || Array.isArray(bp)) {
        throw new Error(
          "Invalid businessProfile in credentials file: must be an object",
        );
      }
      if (typeof bp.vatRegistered !== "boolean") {
        throw new Error(
          "Invalid businessProfile in credentials file: vatRegistered must be true or false",
        );
      }
    }

    _cachedCredentials = credentials;
    return credentials;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in credentials file: ${CREDENTIALS_PATH}`);
    }
    throw error;
  }
}

/**
 * Clear the credentials cache.
 * Intended for tests only — not for production use.
 * @internal
 */
export function _clearCredentialsCache(): void {
  _cachedCredentials = null;
}

/**
 * Generate a unique submission number
 * Format: Timestamp + Counter (ensures uniqueness)
 */
export function generateSubmissionNumber(): string {
  submissionCounter++;
  const timestamp = Date.now().toString(36);
  const counter = submissionCounter.toString().padStart(4, "0");
  return `${timestamp}${counter}`;
}

/**
 * Generate MD5 hash for authentication
 * Formula: MD5(AccountNumber + APIKey + SubmissionNumber)
 *
 * NOTE: MD5 is used here because it is REQUIRED by the QuickFile API.
 * This is an API constraint, not a design choice. See module documentation.
 */
export function generateMD5Hash(
  accountNumber: string,
  apiKey: string,
  submissionNumber: string,
): string {
  const input = `${accountNumber}${apiKey}${submissionNumber}`;
  return createHash("md5").update(input).digest("hex"); // NOSONAR - MD5 required by QuickFile API specification
}

/**
 * Create authentication header for API requests
 */
export function createAuthHeader(
  credentials: QuickFileCredentials,
  testMode = false,
): QuickFileHeader {
  const submissionNumber = generateSubmissionNumber();
  const md5Value = generateMD5Hash(
    credentials.accountNumber,
    credentials.apiKey,
    submissionNumber,
  );

  const header: QuickFileHeader = {
    MessageType: "Request",
    SubmissionNumber: submissionNumber,
    Authentication: {
      AccNumber: credentials.accountNumber,
      MD5Value: md5Value,
      ApplicationID: credentials.applicationId,
    },
  };

  if (testMode) {
    header.TestMode = true;
  }

  return header;
}

/**
 * Validate credentials by checking format (does not call API)
 */
export function validateCredentialsFormat(
  credentials: QuickFileCredentials,
): boolean {
  // Account number should be numeric
  if (!/^\d+$/.test(credentials.accountNumber)) {
    return false;
  }

  // API key should be in format XXXX-XXXX-XXXX (may vary)
  if (!credentials.apiKey || credentials.apiKey.length < 10) {
    return false;
  }

  // Application ID should be UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(credentials.applicationId)) {
    return false;
  }

  return true;
}

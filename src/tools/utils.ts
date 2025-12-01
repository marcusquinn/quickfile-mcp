/**
 * QuickFile Tool Utilities
 * Shared utilities for tool handlers including error handling and logging
 */

import { QuickFileApiError } from "../api/client.js";

// Re-export validation helpers and schemas
export { validateArgs, validateArgsSafe } from "./schemas.js";
export * as schemas from "./schemas.js";

// =============================================================================
// Types
// =============================================================================

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Standardized error handler for all tool operations
 * Formats errors consistently and distinguishes API errors from other errors
 */
export function handleToolError(error: unknown): ToolResult {
  let message: string;

  if (error instanceof QuickFileApiError) {
    message = `QuickFile API Error [${error.code}]: ${error.message}`;
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = "Error: Unknown error";
  }

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Create a successful tool result with JSON data
 */
export function successResult(data: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create an error tool result
 */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// =============================================================================
// Logging
// =============================================================================

/**
 * Structured logger that writes to stderr (required for MCP servers)
 * stdout is reserved for protocol communication
 */
export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    const log = context
      ? `[INFO] ${message} ${JSON.stringify(context)}`
      : `[INFO] ${message}`;
    console.error(log);
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    const log = context
      ? `[WARN] ${message} ${JSON.stringify(context)}`
      : `[WARN] ${message}`;
    console.error(log);
  },

  error: (message: string, context?: Record<string, unknown>) => {
    const log = context
      ? `[ERROR] ${message} ${JSON.stringify(context)}`
      : `[ERROR] ${message}`;
    console.error(log);
  },

  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.QUICKFILE_DEBUG) {
      const log = context
        ? `[DEBUG] ${message} ${JSON.stringify(context)}`
        : `[DEBUG] ${message}`;
      console.error(log);
    }
  },
};

// =============================================================================
// Data Cleaning
// =============================================================================

/**
 * Remove undefined values from an object
 * Useful for building API request parameters
 */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

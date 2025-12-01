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

// =============================================================================
// Shared Entity Builders (Client/Supplier)
// =============================================================================

import type { ClientAddress } from "../types/quickfile.js";

/**
 * Common entity data structure for clients and suppliers
 */
export interface EntityData {
  CompanyName?: string;
  Title?: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Telephone?: string;
  Mobile?: string;
  Website?: string;
  VatNumber?: string;
  CompanyRegNo?: string;
  Currency?: string;
  TermDays?: number;
  Notes?: string;
  Address?: ClientAddress;
}

/**
 * Build address object from tool arguments
 * Shared between client and supplier tools
 */
export function buildAddressFromArgs(
  args: Record<string, unknown>,
): ClientAddress {
  const address: ClientAddress = {};
  if (args.address1) {
    address.Address1 = args.address1 as string;
  }
  if (args.address2) {
    address.Address2 = args.address2 as string;
  }
  if (args.town) {
    address.Town = args.town as string;
  }
  if (args.county) {
    address.County = args.county as string;
  }
  if (args.postcode) {
    address.Postcode = args.postcode as string;
  }
  if (args.country) {
    address.Country = args.country as string;
  }
  return address;
}

/**
 * Build entity data from tool arguments
 * Shared between client and supplier create/update operations
 */
export function buildEntityData(
  args: Record<string, unknown>,
  address: ClientAddress,
  defaults: { currency?: string; termDays?: number } = {},
): EntityData {
  const { currency = "GBP", termDays = 30 } = defaults;
  return {
    CompanyName: args.companyName as string | undefined,
    Title: args.title as string | undefined,
    FirstName: args.firstName as string | undefined,
    LastName: args.lastName as string | undefined,
    Email: args.email as string | undefined,
    Telephone: args.telephone as string | undefined,
    Mobile: args.mobile as string | undefined,
    Website: args.website as string | undefined,
    VatNumber: args.vatNumber as string | undefined,
    CompanyRegNo: args.companyRegNo as string | undefined,
    Currency: (args.currency as string) ?? currency,
    TermDays: (args.termDays as number) ?? termDays,
    Notes: args.notes as string | undefined,
    Address: Object.keys(address).length > 0 ? address : undefined,
  };
}

/**
 * Build entity update data (preserves undefined for partial updates)
 */
export function buildEntityUpdateData(
  args: Record<string, unknown>,
  address: ClientAddress,
): EntityData {
  return {
    CompanyName: args.companyName as string | undefined,
    Title: args.title as string | undefined,
    FirstName: args.firstName as string | undefined,
    LastName: args.lastName as string | undefined,
    Email: args.email as string | undefined,
    Telephone: args.telephone as string | undefined,
    Mobile: args.mobile as string | undefined,
    Website: args.website as string | undefined,
    VatNumber: args.vatNumber as string | undefined,
    CompanyRegNo: args.companyRegNo as string | undefined,
    Currency: args.currency as string | undefined,
    TermDays: args.termDays as number | undefined,
    Notes: args.notes as string | undefined,
    Address: Object.keys(address).length > 0 ? address : undefined,
  };
}

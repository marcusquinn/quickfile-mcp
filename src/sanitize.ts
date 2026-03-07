/**
 * Output Sanitization for MCP Server Responses
 *
 * Prevents prompt injection attacks via user-controlled content in QuickFile API
 * responses. When the QuickFile API returns free-text fields (invoice descriptions,
 * contact names, notes, etc.), those fields could contain payloads designed to
 * manipulate the consuming AI assistant.
 *
 * This module provides:
 * 1. HTML/script tag stripping from free-text fields
 * 2. Prompt injection pattern detection and flagging
 * 3. Metadata annotation of user-controlled fields
 *
 * @see https://github.com/marcusquinn/quickfile-mcp/issues/38
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Fields known to contain user-controlled free-text content in QuickFile API
 * responses. These are the primary injection vectors.
 *
 * Keys are field names (case-insensitive matching applied at runtime).
 * Values describe the field's origin for metadata purposes.
 */
const USER_CONTROLLED_FIELDS: ReadonlyMap<string, string> = new Map([
  // Entity names and descriptions
  ["companyname", "user-provided company/client name"],
  ["clientname", "user-provided client name"],
  ["suppliername", "user-provided supplier name"],
  ["firstname", "user-provided first name"],
  ["lastname", "user-provided last name"],
  ["surname", "user-provided surname"],
  ["contactname", "user-provided contact name"],
  ["name", "user-provided name"],

  // Free-text content fields
  ["notes", "user-provided notes"],
  ["notetext", "user-provided note content"],
  ["description", "user-provided description"],
  ["itemdescription", "user-provided line item description"],
  ["itemname", "user-provided item name"],
  ["emailsubject", "user-provided email subject"],
  ["emailbody", "user-provided email body"],

  // Reference fields (partially user-controlled)
  ["reference", "user-provided reference"],
  ["ponumber", "user-provided purchase order number"],
  ["supplierref", "user-provided supplier reference"],
  ["payeepayer", "user-provided payee/payer name"],

  // Address fields
  ["address1", "user-provided address line 1"],
  ["address2", "user-provided address line 2"],
  ["town", "user-provided town"],
  ["county", "user-provided county"],
  ["postcode", "user-provided postcode"],

  // Web/contact fields
  ["website", "user-provided website URL"],
  ["email", "user-provided email address"],
]);

/**
 * Patterns that indicate potential prompt injection attempts.
 * These are checked against string values in API responses.
 */
const INJECTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  description: string;
}> = [
  {
    pattern:
      /(?:^|\s)(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?|context)/i,
    description: "instruction override attempt",
  },
  {
    pattern:
      /(?:^|\s)you\s+(?:are|must|should|will)\s+(?:now|henceforth|from\s+now)/i,
    description: "role reassignment attempt",
  },
  {
    pattern: /(?:^|\s)(?:system|assistant|user)\s*(?:prompt|message|role)\s*:/i,
    description: "prompt role injection",
  },
  {
    pattern: /\[(?:SYSTEM|INST|ASSISTANT)\]/i,
    description: "chat template injection",
  },
  {
    pattern: /<\/?(?:system|prompt|instruction|message|role|context)>/i,
    description: "XML tag injection",
  },
  {
    pattern:
      /(?:^|\s)(?:execute|run|perform|do)\s+(?:the\s+following|this)\s*:/i,
    description: "command injection attempt",
  },
  {
    pattern:
      /(?:^|\s)(?:new|updated?|revised?|override)\s+(?:system\s+)?instructions?\s*:/i,
    description: "instruction replacement attempt",
  },
];

// =============================================================================
// HTML Sanitization
// =============================================================================

/**
 * Strip HTML tags from a string value.
 * Removes all HTML elements including script, style, and event handlers.
 * Preserves the text content within tags.
 */
export function stripHtmlTags(value: string): string {
  // Remove script and style elements entirely (including content)
  let cleaned = value.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  cleaned = cleaned.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    "",
  );

  // Remove all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return cleaned.trim();
}

// =============================================================================
// Injection Detection
// =============================================================================

/**
 * Check a string value for prompt injection patterns.
 * Returns an array of detected pattern descriptions, or empty array if clean.
 */
export function detectInjectionPatterns(value: string): string[] {
  const detections: string[] = [];

  for (const { pattern, description } of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      detections.push(description);
    }
  }

  return detections;
}

// =============================================================================
// Field Classification
// =============================================================================

/**
 * Check if a field name corresponds to a known user-controlled field.
 */
export function isUserControlledField(fieldName: string): boolean {
  return USER_CONTROLLED_FIELDS.has(fieldName.toLowerCase());
}

/**
 * Get the description of a user-controlled field, if known.
 */
export function getUserControlledFieldDescription(
  fieldName: string,
): string | undefined {
  return USER_CONTROLLED_FIELDS.get(fieldName.toLowerCase());
}

// =============================================================================
// Deep Sanitization
// =============================================================================

/**
 * Sanitization result metadata, appended to sanitized responses.
 */
export interface SanitizationMetadata {
  /** Whether any content was modified during sanitization */
  sanitized: boolean;
  /** Number of fields that had HTML stripped */
  htmlStripped: number;
  /** Prompt injection warnings, if any patterns were detected */
  injectionWarnings: string[];
  /** List of user-controlled field names found in the response */
  userControlledFields: string[];
}

/**
 * Recursively sanitize an object's string values.
 *
 * - Strips HTML tags from all user-controlled string fields
 * - Detects prompt injection patterns in all string values
 * - Tracks which user-controlled fields were found
 *
 * Returns the sanitized data and metadata about what was found/changed.
 */
export function sanitizeOutput(data: unknown): {
  data: unknown;
  metadata: SanitizationMetadata;
} {
  const metadata: SanitizationMetadata = {
    sanitized: false,
    htmlStripped: 0,
    injectionWarnings: [],
    userControlledFields: [],
  };

  const sanitized = sanitizeValue(data, "", metadata);

  return { data: sanitized, metadata };
}

/**
 * Recursively process a value, sanitizing strings in user-controlled fields.
 */
function sanitizeValue(
  value: unknown,
  fieldName: string,
  metadata: SanitizationMetadata,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeStringValue(value, fieldName, metadata);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeValue(item, `${fieldName}[${index}]`, metadata),
    );
  }

  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, metadata);
  }

  // Numbers, booleans, etc. pass through unchanged
  return value;
}

/**
 * Sanitize a string value based on its field name.
 */
function sanitizeStringValue(
  value: string,
  fieldName: string,
  metadata: SanitizationMetadata,
): string {
  // Extract the leaf field name (e.g., "Notes" from "InvoiceDetails.Notes")
  const leafName = fieldName.split(".").pop() ?? fieldName;
  const isUserField = isUserControlledField(leafName);

  if (isUserField && !metadata.userControlledFields.includes(leafName)) {
    metadata.userControlledFields.push(leafName);
  }

  // Check all string values for injection patterns (not just user-controlled)
  const injections = detectInjectionPatterns(value);
  if (injections.length > 0) {
    const fieldLabel = fieldName || "unknown";
    for (const injection of injections) {
      const warning = `Potential prompt injection in field "${fieldLabel}": ${injection}`;
      if (!metadata.injectionWarnings.includes(warning)) {
        metadata.injectionWarnings.push(warning);
      }
    }
  }

  // Strip HTML only from user-controlled fields
  if (isUserField && /<[^>]+>/.test(value)) {
    const stripped = stripHtmlTags(value);
    if (stripped !== value) {
      metadata.htmlStripped++;
      metadata.sanitized = true;
      return stripped;
    }
  }

  return value;
}

/**
 * Sanitize all values in an object, tracking field paths.
 */
function sanitizeObject(
  obj: Record<string, unknown>,
  metadata: SanitizationMetadata,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeValue(value, key, metadata);
  }

  return result;
}

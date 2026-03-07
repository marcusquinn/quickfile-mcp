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
 * HTML entity map for decoding. Covers the most common entities found in
 * QuickFile API responses. Order matters: &amp; must be decoded last to
 * avoid double-decoding (e.g., `&amp;lt;` → `&lt;` → `<`).
 */
const HTML_ENTITY_MAP: ReadonlyArray<[string, string]> = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&nbsp;", " "],
  // &amp; decoded last to prevent double-decode chains
  ["&amp;", "&"],
];

/**
 * Decode common HTML entities in a string.
 * Applied before tag stripping to prevent encoded tags from bypassing
 * the filter (e.g., `&lt;script&gt;` → `<script>` → stripped).
 */
function decodeHtmlEntities(value: string): string {
  let result = value;
  for (const [entity, char] of HTML_ENTITY_MAP) {
    result = result.replaceAll(entity, char);
  }
  return result;
}

/**
 * Find the next occurrence of a tag marker in a string (case-insensitive).
 * Returns -1 if not found. Centralises the indexOf logic used by both
 * stripTagWithContent and stripAllTags to eliminate duplication.
 */
function findTag(
  haystack: string,
  needle: string,
  fromIndex: number,
  caseInsensitive: boolean,
): number {
  const source = caseInsensitive ? haystack.toLowerCase() : haystack;
  return source.indexOf(needle, fromIndex);
}

/**
 * Remove a matched tag region from a string: everything from `start` to
 * `end` (exclusive). If `end` is -1, removes from `start` to end of string
 * (unclosed tag). Returns the resulting string.
 */
function excise(value: string, start: number, end: number): string {
  if (end === -1) return value.slice(0, start);
  return value.slice(0, start) + value.slice(end);
}

/**
 * Remove content between matched tag pairs (e.g., `<script>...</script>`).
 * Uses indexOf-based iteration instead of regex to avoid ReDoS risk
 * from backtracking on crafted input.
 */
function stripTagWithContent(input: string, tagName: string): string {
  let result = input;
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  // Loop terminates because `result` shrinks on each match (tag+content removed).
  for (;;) {
    const openIdx = findTag(result, openTag, 0, true);
    if (openIdx === -1) break;

    const closeIdx = findTag(result, closeTag, openIdx, true);
    result = excise(
      result,
      openIdx,
      closeIdx === -1 ? -1 : closeIdx + closeTag.length,
    );
    if (closeIdx === -1) break;
  }

  return result;
}

/**
 * Check whether a string contains any HTML tags, including encoded ones.
 * Checks for both literal tags (`<...>`) and HTML-entity-encoded tags
 * (`&lt;...&gt;`) to prevent encoded payloads from bypassing the guard.
 * Uses indexOf instead of regex to avoid SonarCloud S5852 (ReDoS) flags.
 */
function containsHtmlTags(value: string): boolean {
  // Check for literal HTML tags
  const openIdx = value.indexOf("<");
  if (openIdx !== -1 && value.indexOf(">", openIdx) !== -1) return true;

  // Check for HTML-entity-encoded tags (e.g., &lt;script&gt;)
  if (value.indexOf("&lt;") !== -1 && value.indexOf("&gt;") !== -1) return true;

  // Check for double-encoded entities (e.g., &amp;lt;)
  if (value.indexOf("&amp;lt;") !== -1) return true;

  return false;
}

/**
 * Remove all HTML tags from a string, preserving text content.
 * Uses indexOf-based iteration instead of regex to avoid ReDoS risk.
 */
function stripAllTags(input: string): string {
  let result = input;
  for (;;) {
    const openIdx = result.indexOf("<");
    if (openIdx === -1) break;

    const closeIdx = result.indexOf(">", openIdx);
    result = excise(result, openIdx, closeIdx === -1 ? -1 : closeIdx + 1);
    if (closeIdx === -1) break;
  }
  return result;
}

/**
 * Strip HTML tags from a string value.
 * Removes all HTML elements including script, style, and event handlers.
 * Preserves the text content within non-dangerous tags.
 *
 * Defence-in-depth approach:
 * 1. Decode HTML entities (catches `&lt;script&gt;` bypass)
 * 2. Strip dangerous elements with content (script, style) via indexOf
 * 3. Strip remaining HTML tags via indexOf (no regex, no ReDoS risk)
 * 4. Iterate decode+strip to catch double-encoded payloads
 */
export function stripHtmlTags(value: string): string {
  let cleaned = value;

  // Iterative decode-then-strip handles double-encoded payloads
  // (e.g., `&amp;lt;script&amp;gt;` → `&lt;script&gt;` → `<script>` → stripped)
  // Max 3 iterations is sufficient for any realistic encoding depth
  for (let i = 0; i < 3; i++) {
    const decoded = decodeHtmlEntities(cleaned);

    // Remove script and style elements entirely (including content)
    let stripped = stripTagWithContent(decoded, "script");
    stripped = stripTagWithContent(stripped, "style");

    // Remove all remaining HTML tags (indexOf-based, no regex)
    stripped = stripAllTags(stripped);

    if (stripped === cleaned) break; // Stable — no further changes
    cleaned = stripped;
  }

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
    return sanitizeObject(
      value as Record<string, unknown>,
      fieldName,
      metadata,
    );
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
    // Truncate value for logging context — enough to debug, short enough to
    // avoid exposing the full malicious payload in metadata/logs
    const maxContextLength = 80;
    const truncated =
      value.length > maxContextLength
        ? `${value.slice(0, maxContextLength)}...`
        : value;
    for (const injection of injections) {
      const warning = `Potential prompt injection in field "${fieldLabel}" (${injection}). Context: "${truncated}"`;
      if (!metadata.injectionWarnings.includes(warning)) {
        metadata.injectionWarnings.push(warning);
      }
    }
  }

  // Strip HTML only from user-controlled fields
  if (isUserField && containsHtmlTags(value)) {
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
 * The basePath is propagated so nested fields get full paths
 * (e.g., "InvoiceDetails.Notes" instead of just "Notes").
 */
function sanitizeObject(
  obj: Record<string, unknown>,
  basePath: string,
  metadata: SanitizationMetadata,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = basePath ? `${basePath}.${key}` : key;
    result[key] = sanitizeValue(value, fieldPath, metadata);
  }

  return result;
}

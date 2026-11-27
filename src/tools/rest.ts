/** Exact, generated coverage for the published QuickFile REST v2 operations. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import restManifestData from "../generated/rest-operations.json";
import { getApiClient, type RestRequestOptions } from "../api/client.js";
import {
  errorResult,
  handleToolError,
  successResult,
  type ToolResult,
} from "./utils.js";

type RestMethod = "GET" | "POST" | "PUT" | "DELETE";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BASE64_LENGTH = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3);

interface RestOperation {
  name: string;
  operationId: string;
  group: string;
  summary: string;
  method: RestMethod;
  path: string;
  inputSchema: Tool["inputSchema"];
}

interface RestManifest {
  source: string;
  schemaVersion: string;
  operationCount: number;
  operationsSha256: string;
  operations: RestOperation[];
}

interface UploadInput {
  fileName: string;
  fileData: string;
  mimeType?: string;
}

const restManifest = restManifestData as unknown as RestManifest;
const operationsByName = new Map(
  restManifest.operations.map((operation) => [operation.name, operation]),
);

export const restOperationCount = restManifest.operationCount;
export const restSchemaVersion = restManifest.schemaVersion;

const PAYMENT_TOOLS = new Set([
  "quickfile_rest_client_payment_post",
  "quickfile_rest_supplier_payment_post",
]);
const GUARD_WINDOW_DAYS = 7;
const GUARD_PAGE_SIZE = 100;
const GUARD_MAX_PAGES = 50;

const GUARD_NOTE =
  " With a bank nominal_code this always creates a NEW bank transaction: " +
  "REST v2 cannot tag an existing bank line, edit a payment, or delete a bank " +
  "transaction. The call is refused when an untagged bank line with the same " +
  "amount exists within 7 days; tag it in the web app (Bank > untagged > tag) " +
  "or pass allow_new_bank_line: true to override.";

function withGuardOverride(
  schema: Tool["inputSchema"],
): Tool["inputSchema"] {
  return {
    ...schema,
    properties: {
      ...(schema.properties ?? {}),
      allow_new_bank_line: {
        type: "boolean",
        description:
          "Override the duplicate bank line guard and create a new bank transaction",
      },
    },
  };
}

export const restTools: Tool[] = restManifest.operations.map((operation) => ({
  name: operation.name,
  description:
    `[REST ${restManifest.schemaVersion} ${operation.operationId}] ` +
    `${operation.summary} Uses the published snake_case request fields.` +
    (PAYMENT_TOOLS.has(operation.name) ? GUARD_NOTE : ""),
  inputSchema: PAYMENT_TOOLS.has(operation.name)
    ? withGuardOverride(operation.inputSchema)
    : operation.inputSchema,
}));

function dayShift(date: string, days: number): string | undefined {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Find untagged bank lines matching a payment about to create a new one.
 * Returns the matches (empty when the guard does not apply or finds none).
 */
export async function findMatchingUntaggedLines(
  client: ReturnType<typeof getApiClient>,
  body: Record<string, unknown>,
  direction: "in" | "out" = "in",
): Promise<unknown[]> {
  const nominal = body.nominal_code;
  const amount = Number(body.amount);
  const from = typeof body.date === "string" ? dayShift(body.date, -GUARD_WINDOW_DAYS) : undefined;
  const to = typeof body.date === "string" ? dayShift(body.date, GUARD_WINDOW_DAYS) : undefined;
  if (nominal === undefined || !Number.isFinite(amount) || !from || !to) {
    return [];
  }
  const accounts = await client.request<{ data?: Array<Record<string, unknown>> }>(
    "/bank_accounts",
    { query: { nominal_code: nominal } },
  );
  const accountId = accounts.data?.[0]?.id ?? nominal;
  const expected = direction === "in" ? Math.abs(amount) : -Math.abs(amount);
  const matches: unknown[] = [];
  for (let page = 0; page < GUARD_MAX_PAGES; page++) {
    const response = await client.request<{ data?: Array<Record<string, unknown>> }>(
      `/bank_accounts/${encodeURIComponent(String(accountId))}/transactions`,
      {
        query: {
          tag_status: "untagged",
          date_from: from,
          date_to: to,
          offset: page * GUARD_PAGE_SIZE,
          limit: GUARD_PAGE_SIZE,
        },
      },
    );
    const rows = response.data ?? [];
    for (const row of rows) {
      if (Math.abs(Number(row.amount) - expected) < 0.005) {
        matches.push(row);
      }
    }
    if (rows.length < GUARD_PAGE_SIZE) {
      return matches;
    }
  }
  throw new Error(
    `Duplicate bank line guard could not exhaust untagged transactions within ${GUARD_MAX_PAGES * GUARD_PAGE_SIZE} results; refusing to post. Narrow the date or retry with allow_new_bank_line: true.`,
  );
}

export function isRestReadOnlyTool(toolName: string): boolean {
  return operationsByName.get(toolName)?.method === "GET";
}

export function isRestDestructiveTool(toolName: string): boolean {
  return operationsByName.get(toolName)?.method === "DELETE";
}

function operationFor(toolName: string): RestOperation {
  const operation = operationsByName.get(toolName);
  if (!operation) {
    throw new Error(`Unknown generated REST tool: ${toolName}`);
  }
  return operation;
}

function renderPath(
  template: string,
  pathParams: Record<string, unknown>,
): string {
  let path = template;
  for (const [parameter, value] of Object.entries(pathParams)) {
    path = path.replaceAll(`{${parameter}}`, encodeURIComponent(String(value)));
  }
  return path;
}

function decodeUpload(value: UploadInput): Blob {
  const normalized = value.fileData.replace(/\s/g, "");
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    normalized.length > MAX_UPLOAD_BASE64_LENGTH ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalized,
    )
  ) {
    throw new Error("Uploaded fileData must be valid base64");
  }
  const paddingLength = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  const decodedByteLength = (normalized.length / 4) * 3 - paddingLength;
  if (decodedByteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Uploaded fileData must be no larger than ${MAX_UPLOAD_BYTES} bytes`,
    );
  }
  return new Blob([Buffer.from(normalized, "base64")], {
    type: value.mimeType ?? "application/octet-stream",
  });
}

function buildForm(formInput: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(formInput)) {
    if (
      typeof value === "object" &&
      value !== null &&
      "fileName" in value &&
      "fileData" in value
    ) {
      const upload = value as unknown as UploadInput;
      form.append(name, decodeUpload(upload), upload.fileName);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        form.append(name, String(item));
      }
    } else {
      form.append(name, String(value));
    }
  }
  return form;
}

export async function handleRestTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const operation = operationFor(toolName);
    if (PAYMENT_TOOLS.has(toolName) && args.allow_new_bank_line !== true) {
      const body = (args.body as Record<string, unknown> | undefined) ?? {};
      if (body.nominal_code !== undefined) {
        const matches = await findMatchingUntaggedLines(
          getApiClient(args.account as string),
          body,
          toolName === "quickfile_rest_supplier_payment_post" ? "out" : "in",
        );
        if (matches.length > 0) {
          return errorResult(
            `Refused: ${matches.length} untagged bank line(s) with the same amount exist within ${GUARD_WINDOW_DAYS} days of ${String(body.date)} on nominal ${String(body.nominal_code)}. ` +
              "Posting this payment would create a duplicate bank line. Tag the existing line in the QuickFile web app (Bank > untagged > tag), " +
              "or retry with allow_new_bank_line: true to create a new line. Matching lines: " +
              JSON.stringify(
                (matches as Array<Record<string, unknown>>).map((row) => ({
                  id: row.id,
                  date: row.date,
                  amount: row.amount,
                })),
              ),
          );
        }
      }
    }
    const path = renderPath(
      operation.path,
      (args.pathParams as Record<string, unknown> | undefined) ?? {},
    );
    const options: RestRequestOptions = { method: operation.method };
    if (args.query) {
      options.query = args.query as Record<string, unknown>;
    }
    if (args.body !== undefined) {
      options.body = args.body;
    }
    if (args.formData) {
      options.form = buildForm(args.formData as Record<string, unknown>);
    }

    const client = getApiClient(
      args.account as string,
      options.form ? { timeout: 60000 } : undefined,
    );
    return successResult(await client.request(path, options));
  } catch (error) {
    return handleToolError(error);
  }
}

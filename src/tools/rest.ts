/** Exact, generated coverage for the published QuickFile REST v2 operations. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import restManifestData from "../generated/rest-operations.json";
import { getApiClient, type RestRequestOptions } from "../api/client.js";
import { handleToolError, successResult, type ToolResult } from "./utils.js";

type RestMethod = "GET" | "POST" | "PUT" | "DELETE";

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

export const restTools: Tool[] = restManifest.operations.map((operation) => ({
  name: operation.name,
  description:
    `[REST ${restManifest.schemaVersion} ${operation.operationId}] ` +
    `${operation.summary} Uses the published snake_case request fields.`,
  inputSchema: operation.inputSchema,
}));

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
  return template.replace(/\{([^}]+)\}/g, (_match, parameter: string) =>
    encodeURIComponent(String(pathParams[parameter])),
  );
}

function decodeUpload(value: UploadInput): Blob {
  const normalized = value.fileData.replace(/\s/g, "");
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalized,
    )
  ) {
    throw new Error("Uploaded fileData must be valid base64");
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

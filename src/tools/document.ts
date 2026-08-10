/** QuickFile REST document upload tools. */

import { readFile } from "node:fs/promises";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import { handleToolError, successResult, type ToolResult } from "./utils.js";

const fileSourceProperties = {
  fileData: {
    type: "string" as const,
    description: "Base64-encoded file content (exclusive with filePath)",
  },
  filePath: {
    type: "string" as const,
    description: "Absolute local file path (exclusive with fileData)",
  },
};

export const documentTools: Tool[] = [
  {
    name: "quickfile_document_upload_receipt",
    description: "Upload a receipt and optionally attach it to a purchase",
    inputSchema: {
      type: "object",
      properties: {
        purchaseId: { type: "number" },
        fileName: { type: "string" },
        captureDate: { type: "string" },
        ...fileSourceProperties,
      },
      required: ["fileName"],
    },
  },
  {
    name: "quickfile_document_upload_sales_attachment",
    description: "Upload a document and attach it to a sales invoice",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "number" },
        fileName: { type: "string" },
        notes: { type: "string" },
        ...fileSourceProperties,
      },
      required: ["invoiceId", "fileName"],
    },
  },
];

async function resolveFile(args: Record<string, unknown>): Promise<Buffer> {
  const fileData = args.fileData as string | undefined;
  const filePath = args.filePath as string | undefined;
  if (fileData && filePath) {
    throw new Error("Provide either fileData or filePath, not both");
  }
  if (fileData) {
    return Buffer.from(fileData, "base64");
  }
  if (filePath) {
    return readFile(filePath);
  }
  throw new Error("Either fileData or filePath must be provided");
}

async function createForm(
  args: Record<string, unknown>,
): Promise<FormData> {
  const data = await resolveFile(args);
  const form = new FormData();
  form.append(
    "file",
    new Blob([data], { type: "application/octet-stream" }),
    args.fileName as string,
  );
  return form;
}

export async function handleDocumentTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = getApiClient(args.account as string, { timeout: 60000 });
  try {
    const form = await createForm(args);
    switch (toolName) {
      case "quickfile_document_upload_receipt":
        if (args.purchaseId !== undefined) {
          form.append("purchase_id", String(args.purchaseId));
        }
        form.append(
          "capture_date",
          (args.captureDate as string | undefined) ??
            new Date().toISOString().slice(0, 10),
        );
        form.append("receipt_name", args.fileName as string);
        return successResult(
          await client.request("/documents/receipt", { method: "POST", form }),
        );
      case "quickfile_document_upload_sales_attachment":
        form.append("invoice_id", String(args.invoiceId));
        if (args.notes) {
          form.append("notes", args.notes as string);
        }
        return successResult(
          await client.request("/documents/sales", { method: "POST", form }),
        );
      default:
        return {
          content: [{ type: "text", text: `Unknown document tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

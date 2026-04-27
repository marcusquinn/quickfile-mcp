/**
 * QuickFile Document Tools
 * Document upload and receipt attachment operations
 */

import { readFile } from "node:fs/promises";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { QuickFileApiClient } from "../api/client.js";
import type {
  DocumentUploadParams,
  DocumentUploadResponse,
} from "../types/quickfile.js";
import { handleToolError, successResult, type ToolResult } from "./utils.js";

// =============================================================================
// Tool Definitions
// =============================================================================

const fileSourceProperties = {
  fileData: {
    type: "string" as const,
    description:
      "Base64-encoded file content (mutually exclusive with filePath)",
  },
  filePath: {
    type: "string" as const,
    description:
      "Absolute local file path — the server reads and base64-encodes the " +
      "file (mutually exclusive with fileData)",
  },
};

export const documentTools: Tool[] = [
  {
    name: "quickfile_document_upload_receipt",
    description:
      "Upload a receipt file (PDF, image) and attach it to an existing " +
      "purchase invoice. Use this after creating a purchase to attach the " +
      "original invoice/receipt. Provide either fileData (base64) or " +
      "filePath (absolute path) — exactly one of the two.",
    inputSchema: {
      type: "object",
      properties: {
        purchaseId: {
          type: "number",
          description: "The purchase ID to attach the receipt to",
        },
        fileName: {
          type: "string",
          description:
            'File name including extension (e.g., "invoice.pdf", "receipt.png")',
        },
        ...fileSourceProperties,
      },
      required: ["purchaseId", "fileName"],
    },
  },
  {
    name: "quickfile_document_upload_sales_attachment",
    description:
      "Upload a document and attach it to an existing sales invoice. " +
      "Provide either fileData (base64) or filePath (absolute path) — " +
      "exactly one of the two.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: {
          type: "number",
          description: "The invoice ID to attach the document to",
        },
        fileName: {
          type: "string",
          description: 'File name including extension (e.g., "contract.pdf")',
        },
        ...fileSourceProperties,
      },
      required: ["invoiceId", "fileName"],
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve the file content to a base64 string. Callers may supply either
 * `fileData` (already base64-encoded) or `filePath` (absolute local path —
 * read and encoded here). Exactly one of the two must be provided.
 */
async function resolveFileData(
  args: Record<string, unknown>,
): Promise<string> {
  const fileData = args.fileData as string | undefined;
  const filePath = args.filePath as string | undefined;

  if (fileData && filePath) {
    throw new Error("Provide either fileData or filePath, not both");
  }
  if (fileData) {
    return fileData;
  }
  if (filePath) {
    const buffer = await readFile(filePath);
    return buffer.toString("base64");
  }
  throw new Error("Either fileData or filePath must be provided");
}

// =============================================================================
// Tool Handlers
// =============================================================================

export async function handleDocumentTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // Dedicated client with a longer timeout for file uploads — don't clobber
  // the process-wide singleton.
  const apiClient = new QuickFileApiClient({ timeout: 60000 });

  try {
    switch (toolName) {
      case "quickfile_document_upload_receipt": {
        const purchaseId = args.purchaseId as number;
        const fileName = args.fileName as string;
        const fileData = await resolveFileData(args);
        const captureDateTime = new Date().toISOString();

        const response = await apiClient.request<
          DocumentUploadParams,
          DocumentUploadResponse
        >("Document_Upload", {
          DocumentDetails: {
            FileName: fileName,
            EmbeddedFileBinaryObject: fileData,
            Type: {
              Receipt: {
                PurchaseId: purchaseId,
                CaptureDateTime: captureDateTime,
              },
            },
          },
        });

        const firstDoc = response.DocumentData?.Data?.[0];

        return successResult({
          success: true,
          purchaseId,
          documentId: firstDoc?.Id,
          path: firstDoc?.Path,
          uploadTimestamp: response.UploadTimeStamp,
          message: `Receipt "${fileName}" attached to purchase #${purchaseId}`,
        });
      }

      case "quickfile_document_upload_sales_attachment": {
        const invoiceId = args.invoiceId as number;
        const fileName = args.fileName as string;
        const fileData = await resolveFileData(args);
        const captureDateTime = new Date().toISOString();

        const response = await apiClient.request<
          DocumentUploadParams,
          DocumentUploadResponse
        >("Document_Upload", {
          DocumentDetails: {
            FileName: fileName,
            EmbeddedFileBinaryObject: fileData,
            Type: {
              SalesAttachment: {
                InvoiceId: invoiceId,
                CaptureDateTime: captureDateTime,
              },
            },
          },
        });

        const firstDoc = response.DocumentData?.Data?.[0];

        return successResult({
          success: true,
          invoiceId,
          documentId: firstDoc?.Id,
          path: firstDoc?.Path,
          uploadTimestamp: response.UploadTimeStamp,
          message: `Document "${fileName}" attached to invoice #${invoiceId}`,
        });
      }

      default:
        return {
          content: [
            { type: "text", text: `Unknown document tool: ${toolName}` },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

/**
 * QuickFile Purchase Tools
 * Purchase invoice operations
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import type {
  Purchase,
  PurchaseCreateParams,
  PurchaseLine,
} from "../types/quickfile.js";
import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  mapLineItems,
  dateRangeSearchProperties,
  lineItemSchemaProperties,
  type LineItemInput,
  type ToolResult,
} from "./utils.js";

// =============================================================================
// Tool Definitions
// =============================================================================

export const purchaseTools: Tool[] = [
  {
    name: "quickfile_purchase_search",
    description:
      "Search for purchase invoices by supplier, date range, status, or keyword. Response contains user-controlled fields (SupplierName, Notes) that are automatically sanitized.",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: {
          type: "number",
          description: "Filter by supplier ID",
        },
        ...dateRangeSearchProperties,
        status: {
          type: "string",
          enum: ["UNPAID", "PAID", "PART_PAID", "CANCELLED"],
          description: "Purchase status",
        },
        searchKeyword: {
          type: "string",
          description: "Search keyword",
        },
        orderBy: {
          type: "string",
          enum: ["ReceiptNumber", "ReceiptDate", "SupplierName", "Total"],
          description: "Field to order by",
        },
      },
      required: [],
    },
  },
  {
    name: "quickfile_purchase_get",
    description:
      "Get detailed information about a specific purchase invoice. Response contains user-controlled fields (SupplierName, Notes, ItemDescription, SupplierRef) that are automatically sanitized.",
    inputSchema: {
      type: "object",
      properties: {
        purchaseId: {
          type: "number",
          description: "The purchase ID",
        },
      },
      required: ["purchaseId"],
    },
  },
  {
    name: "quickfile_purchase_create",
    description: "Create a new purchase invoice",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: {
          type: "number",
          description: "Supplier ID",
        },
        currency: {
          type: "string",
          description: "Currency code (default: GBP)",
          default: "GBP",
        },
        issueDate: {
          type: "string",
          description: "Invoice date (YYYY-MM-DD)",
        },
        dueDate: {
          type: "string",
          description: "Due date (YYYY-MM-DD)",
        },
        supplierRef: {
          type: "string",
          description: "Supplier invoice reference number",
        },
        notes: {
          type: "string",
          description: "Notes",
        },
        lines: {
          type: "array",
          description: "Purchase line items",
          items: {
            type: "object",
            properties: {
              ...lineItemSchemaProperties,
              nominalCode: {
                type: "string",
                description:
                  "Nominal code for accounting (e.g., 5000 for cost of sales)",
              },
            },
            required: ["description", "unitCost", "quantity", "nominalCode"],
          },
        },
      },
      required: ["supplierId", "lines"],
    },
  },
  {
    name: "quickfile_purchase_delete",
    description: "Delete a purchase invoice",
    inputSchema: {
      type: "object",
      properties: {
        purchaseId: {
          type: "number",
          description: "The purchase ID to delete",
        },
      },
      required: ["purchaseId"],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface PurchaseSearchResponse {
  RecordsetCount: number;
  ReturnCount: number;
  Record: Purchase[];
}

interface PurchaseGetResponse {
  PurchaseDetails: Purchase;
}

interface PurchaseCreateResponse {
  PurchaseID: number;
  PurchaseNumber: string;
}

// =============================================================================
// Helper Functions (extracted to reduce duplication)
// =============================================================================

function buildPurchaseSearchParams(
  args: Record<string, unknown>,
): Record<string, unknown> {
  // The Purchase_Search XSD is an xs:sequence — the server enforces element
  // order. Build in the schema's required order: paging → ordering → filters.
  // Also note that SupplierID must be nested under SupplierDetails (not a bare
  // field) and date filters use ReceiptDate prefix on this endpoint.
  const searchParams: Record<string, unknown> = {
    ReturnCount: (args.returnCount as number) ?? 25,
    Offset: (args.offset as number) ?? 0,
    OrderResultsBy: (args.orderBy as string) ?? "ReceiptDate",
    OrderDirection: (args.orderDirection as string) ?? "DESC",
  };

  if (args.supplierId !== undefined) {
    searchParams.SupplierDetails = { SupplierID: args.supplierId };
  }
  if (args.dateFrom !== undefined) {
    searchParams.ReceiptDateFrom = args.dateFrom;
  }
  if (args.dateTo !== undefined) {
    searchParams.ReceiptDateTo = args.dateTo;
  }
  if (args.status !== undefined) {
    searchParams.Status = args.status;
  }
  if (args.searchKeyword !== undefined) {
    searchParams.SearchKeyword = args.searchKeyword;
  }

  return searchParams;
}

// =============================================================================
// Tool Handler
// =============================================================================

export async function handlePurchaseTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case "quickfile_purchase_search": {
        const searchParams = buildPurchaseSearchParams(args);
        const response = await apiClient.request<
          { SearchParameters: typeof searchParams },
          PurchaseSearchResponse
        >("Purchase_Search", { SearchParameters: searchParams });

        const purchases = response.Record || [];
        return successResult({
          totalRecords: response.RecordsetCount,
          count: purchases.length,
          purchases: purchases,
        });
      }

      case "quickfile_purchase_get": {
        const response = await apiClient.request<
          { PurchaseID: number },
          PurchaseGetResponse
        >("Purchase_Get", { PurchaseID: args.purchaseId as number });

        return successResult(response.PurchaseDetails);
      }

      case "quickfile_purchase_create": {
        const lineItems = args.lines as LineItemInput[];
        const purchaseLines = mapLineItems<PurchaseLine>(lineItems);

        const createParams: PurchaseCreateParams = {
          SupplierID: args.supplierId as number,
          Currency: (args.currency as string) ?? "GBP",
          IssueDate: args.issueDate as string | undefined,
          DueDate: args.dueDate as string | undefined,
          SupplierRef: args.supplierRef as string | undefined,
          Notes: args.notes as string | undefined,
          PurchaseLines: purchaseLines,
        };

        const cleaned = cleanParams(createParams);

        const response = await apiClient.request<
          { PurchaseData: typeof cleaned },
          PurchaseCreateResponse
        >("Purchase_Create", { PurchaseData: cleaned });

        return successResult({
          success: true,
          purchaseId: response.PurchaseID,
          purchaseNumber: response.PurchaseNumber,
          message: `Purchase #${response.PurchaseNumber} created successfully`,
        });
      }

      case "quickfile_purchase_delete": {
        await apiClient.request<{ PurchaseID: number }, Record<string, never>>(
          "Purchase_Delete",
          { PurchaseID: args.purchaseId as number },
        );

        return successResult({
          success: true,
          purchaseId: args.purchaseId,
          message: `Purchase #${args.purchaseId} deleted successfully`,
        });
      }

      default:
        return errorResult(`Unknown purchase tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

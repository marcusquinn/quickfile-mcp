/**
 * QuickFile Purchase Tools
 * Purchase invoice operations
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import type {
  Purchase,
  PurchaseCreateParams,
  PurchaseDeleteParams,
  PurchaseDeleteResponse,
  PurchaseItemLine,
} from "../types/quickfile.js";
import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  resolveVatPercentage,
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
          enum: ["UNPAID", "PAID", "PART_PAID", "CANCELLED", "DELETED"],
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
          description: "Receipt date on the supplier's document (YYYY-MM-DD)",
        },
        supplierRef: {
          type: "string",
          description: "Supplier invoice reference number",
        },
        termDays: {
          type: "number",
          description: "Payment terms in days from the receipt date (default: 30)",
          default: 30,
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
            // vatPercentage is intentionally not JSON-Schema-required: installs
            // configured with businessProfile.vatRegistered=false must omit it.
            // resolveVatPercentage enforces the conditional requirement at runtime.
            required: [
              "description",
              "unitCost",
              "quantity",
              "nominalCode",
            ],
          },
        },
      },
      required: ["supplierId", "lines"],
    },
  },
  {
    name: "quickfile_purchase_delete",
    description:
      "Delete one or more purchase invoices. The QuickFile API soft-deletes the records — they remain visible via Purchase_Get with Status='DELETED' but are excluded from default Purchase_Search results.",
    inputSchema: {
      type: "object",
      properties: {
        purchaseIds: {
          type: "array",
          items: { type: "integer", minimum: 1 },
          minItems: 1,
          uniqueItems: true,
          description: "One or more purchase IDs to delete",
        },
        deleteAssociatedPayments: {
          type: "boolean",
          default: true,
          description:
            "Whether to also delete payments associated with these purchases. Defaults to true to mirror the typical UI delete behaviour.",
        },
      },
      required: ["purchaseIds"],
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
  PurchaseTotal?: number;
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
        const businessProfile = apiClient.getBusinessProfile();

        // Purchase_Create's ItemLine schema differs from Invoice_Create's:
        // it expects pre-calculated SubTotal and VatTotal fields rather than
        // the raw UnitCost/Qty/Tax1 triple that mapLineItems produces. We
        // therefore build the line items inline rather than using that helper.
        const itemLines: PurchaseItemLine[] = lineItems.map((line) => {
          const subTotal =
            Math.round(line.unitCost * line.quantity * 100) / 100;
          const vatRate = resolveVatPercentage(
            line.vatPercentage,
            businessProfile,
          );
          const vatTotal = Math.round(subTotal * vatRate) / 100;
          return {
            ItemDescription: line.description,
            ItemNominalCode: line.nominalCode ?? "",
            SubTotal: subTotal,
            VatRate: vatRate,
            VatTotal: vatTotal,
          };
        });

        // Element order matches the XSD xs:sequence for PurchaseData.
        const createParams: PurchaseCreateParams = {
          SupplierID: args.supplierId as number,
          Currency: (args.currency as string) ?? "GBP",
          ReceiptDate: args.issueDate as string | undefined,
          SupplierReference: args.supplierRef as string | undefined,
          TermDays: (args.termDays as number) ?? 30,
          InvoiceLines: { ItemLine: itemLines },
        };

        const cleaned = cleanParams(createParams);

        const response = await apiClient.request<
          { PurchaseData: typeof cleaned },
          PurchaseCreateResponse
        >("Purchase_Create", { PurchaseData: cleaned });

        return successResult({
          success: true,
          purchaseId: response.PurchaseID,
          purchaseTotal: response.PurchaseTotal,
          message: `Purchase ${response.PurchaseID} created successfully`,
        });
      }

      case "quickfile_purchase_delete": {
        const purchaseIds = args.purchaseIds as number[];
        const deleteAssociatedPayments =
          (args.deleteAssociatedPayments as boolean | undefined) ?? true;

        const response = await apiClient.request<
          PurchaseDeleteParams,
          PurchaseDeleteResponse
        >("Purchase_Delete", {
          PurchaseDetails: {
            PurchaseIDs: { PurchaseID: purchaseIds },
            DeleteAssociatedPayments: deleteAssociatedPayments,
          },
        });

        return successResult({
          success: true,
          purchaseIds,
          purchasesDeleted: response.PurchasesDeleted,
          message: `${response.PurchasesDeleted} purchase(s) deleted`,
        });
      }

      default:
        return errorResult(`Unknown purchase tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

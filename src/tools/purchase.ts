/** QuickFile REST purchase tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  cleanParams,
  dateRangeSearchProperties,
  errorResult,
  handleToolError,
  lineItemSchemaProperties,
  resolveVatPercentage,
  successResult,
  type LineItemInput,
  type ToolResult,
} from "./utils.js";

export const purchaseTools: Tool[] = [
  {
    name: "quickfile_purchase_search",
    description: "Search purchase invoices",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "number" },
        ...dateRangeSearchProperties,
        status: { type: "string" },
        searchKeyword: { type: "string" },
        orderBy: { type: "string" },
        includeDeleted: { type: "boolean" },
      },
      required: [],
    },
  },
  {
    name: "quickfile_purchase_get",
    description: "Get a purchase invoice",
    inputSchema: {
      type: "object",
      properties: { purchaseId: { type: "number" } },
      required: ["purchaseId"],
    },
  },
  {
    name: "quickfile_purchase_create",
    description: "Create a purchase invoice",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "number" },
        currency: { type: "string", default: "GBP" },
        issueDate: { type: "string" },
        supplierRef: { type: "string" },
        termDays: { type: "number", default: 30 },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ...lineItemSchemaProperties,
              nominalCode: { type: "string" },
            },
            required: ["description", "unitCost", "quantity", "nominalCode"],
          },
        },
      },
      required: ["supplierId", "issueDate", "lines"],
    },
  },
  {
    name: "quickfile_purchase_delete",
    description: "Delete purchase invoices (destructive; confirmation required)",
    inputSchema: {
      type: "object",
      properties: {
        purchaseIds: {
          type: "array",
          items: { type: "integer", minimum: 1 },
          minItems: 1,
          uniqueItems: true,
        },
        deleteAssociatedPayments: { type: "boolean", default: true },
      },
      required: ["purchaseIds"],
    },
  },
];

interface PagingResponse<T> {
  count: number;
  data: T[];
}

interface PurchaseResponse {
  id: number;
  gross_total?: number;
}

export async function handlePurchaseTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = getApiClient(args.account as string);
  try {
    switch (toolName) {
      case "quickfile_purchase_search": {
        const response = await client.request<PagingResponse<unknown>>(
          "/purchases",
          {
            query: cleanParams({
              supplier_id: args.supplierId,
              date_from: args.dateFrom,
              date_to: args.dateTo,
              status: args.status
                ? String(args.status).toLowerCase()
                : undefined,
              item_desc: args.searchKeyword,
              include_deleted: args.includeDeleted,
              order_column: args.orderBy ?? "receipt_date",
              order_direction: String(
                args.orderDirection ?? "DESC",
              ).toLowerCase(),
              offset: args.offset ?? 0,
              limit: args.returnCount ?? 25,
            }),
          },
        );
        return successResult({
          totalRecords: response.count,
          count: response.data.length,
          purchases: response.data,
        });
      }
      case "quickfile_purchase_get":
        return successResult(await client.request(`/purchases/${args.purchaseId}`));
      case "quickfile_purchase_create": {
        const profile = client.getBusinessProfile();
        const itemLines = (args.lines as LineItemInput[]).map((line) => {
          const subTotal =
            Math.round(line.unitCost * line.quantity * 100) / 100;
          const vatRate = resolveVatPercentage(line.vatPercentage, profile);
          return {
            nominal_code: Number.parseInt(line.nominalCode ?? "", 10),
            description: line.description,
            sub_total: subTotal,
            vat_rate: vatRate,
            vat_amount: Math.round(subTotal * vatRate) / 100,
          };
        });
        const response = await client.request<PurchaseResponse>("/purchases", {
          method: "POST",
          body: cleanParams({
            supplier_id: args.supplierId,
            receipt_date: args.issueDate,
            currency: args.currency ?? "GBP",
            suppplier_reference: args.supplierRef,
            term_days: args.termDays ?? 30,
            item_lines: itemLines,
          }),
        });
        return successResult({
          success: true,
          purchaseId: response.id,
          purchaseTotal: response.gross_total,
        });
      }
      case "quickfile_purchase_delete": {
        const purchaseIds = args.purchaseIds as number[];
        for (const purchaseId of purchaseIds) {
          await client.request(`/purchases/${purchaseId}`, {
            method: "DELETE",
            body: {
              delete_associated_payments:
                args.deleteAssociatedPayments ?? true,
            },
          });
        }
        return successResult({
          success: true,
          purchaseIds,
          purchasesDeleted: purchaseIds.length,
        });
      }
      default:
        return errorResult(`Unknown purchase tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

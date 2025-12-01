/**
 * QuickFile Purchase Tools
 * Purchase invoice operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient } from '../api/client.js';
import type {
  Purchase,
  PurchaseCreateParams,
  PurchaseLine,
} from '../types/quickfile.js';
import { handleToolError, successResult, cleanParams, type ToolResult } from './utils.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const purchaseTools: Tool[] = [
  {
    name: 'quickfile_purchase_search',
    description: 'Search for purchase invoices by supplier, date range, status, or keyword',
    inputSchema: {
      type: 'object',
      properties: {
        supplierId: {
          type: 'number',
          description: 'Filter by supplier ID',
        },
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        status: {
          type: 'string',
          enum: ['UNPAID', 'PAID', 'PART_PAID', 'CANCELLED'],
          description: 'Purchase status',
        },
        searchKeyword: {
          type: 'string',
          description: 'Search keyword',
        },
        returnCount: {
          type: 'number',
          description: 'Number of results (default: 25)',
          default: 25,
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
          default: 0,
        },
        orderBy: {
          type: 'string',
          enum: ['ReceiptNumber', 'ReceiptDate', 'SupplierName', 'Total'],
          description: 'Field to order by',
        },
        orderDirection: {
          type: 'string',
          enum: ['ASC', 'DESC'],
          description: 'Order direction',
        },
      },
      required: [],
    },
  },
  {
    name: 'quickfile_purchase_get',
    description: 'Get detailed information about a specific purchase invoice',
    inputSchema: {
      type: 'object',
      properties: {
        purchaseId: {
          type: 'number',
          description: 'The purchase ID',
        },
      },
      required: ['purchaseId'],
    },
  },
  {
    name: 'quickfile_purchase_create',
    description: 'Create a new purchase invoice',
    inputSchema: {
      type: 'object',
      properties: {
        supplierId: {
          type: 'number',
          description: 'Supplier ID',
        },
        currency: {
          type: 'string',
          description: 'Currency code (default: GBP)',
          default: 'GBP',
        },
        issueDate: {
          type: 'string',
          description: 'Invoice date (YYYY-MM-DD)',
        },
        dueDate: {
          type: 'string',
          description: 'Due date (YYYY-MM-DD)',
        },
        supplierRef: {
          type: 'string',
          description: 'Supplier invoice reference number',
        },
        notes: {
          type: 'string',
          description: 'Notes',
        },
        lines: {
          type: 'array',
          description: 'Purchase line items',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Item description',
              },
              unitCost: {
                type: 'number',
                description: 'Unit cost',
              },
              quantity: {
                type: 'number',
                description: 'Quantity',
              },
              nominalCode: {
                type: 'string',
                description: 'Nominal code for accounting (e.g., 5000 for cost of sales)',
              },
              vatPercentage: {
                type: 'number',
                description: 'VAT percentage (default: 20)',
                default: 20,
              },
            },
            required: ['description', 'unitCost', 'quantity', 'nominalCode'],
          },
        },
      },
      required: ['supplierId', 'lines'],
    },
  },
  {
    name: 'quickfile_purchase_delete',
    description: 'Delete a purchase invoice',
    inputSchema: {
      type: 'object',
      properties: {
        purchaseId: {
          type: 'number',
          description: 'The purchase ID to delete',
        },
      },
      required: ['purchaseId'],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface PurchaseSearchResponse {
  Purchases: {
    Purchase: Purchase[];
  };
  TotalRecords: number;
}

interface PurchaseGetResponse {
  PurchaseDetails: Purchase;
}

interface PurchaseCreateResponse {
  PurchaseID: number;
  PurchaseNumber: string;
}

export async function handlePurchaseTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_purchase_search': {
        // Build search parameters - element order matters for QuickFile XML API
        // Order: ReturnCount, Offset, then optional filters, then OrderResultsBy (required)
        const searchParams: Record<string, unknown> = {
          ReturnCount: (args.returnCount as number) ?? 25,
          Offset: (args.offset as number) ?? 0,
        };
        
        if (args.supplierId) { searchParams.SupplierID = args.supplierId; }
        if (args.dateFrom) { searchParams.DateFrom = args.dateFrom; }
        if (args.dateTo) { searchParams.DateTo = args.dateTo; }
        if (args.status) { searchParams.Status = args.status; }
        if (args.searchKeyword) { searchParams.SearchKeyword = args.searchKeyword; }
        
        // OrderResultsBy and OrderDirection are both required
        // Valid OrderResultsBy values: ReceiptNumber, ReceiptDate, SupplierName, Total
        searchParams.OrderResultsBy = (args.orderBy as string) ?? 'ReceiptDate';
        searchParams.OrderDirection = (args.orderDirection as string) ?? 'DESC';

        const response = await apiClient.request<
          { SearchParameters: typeof searchParams },
          PurchaseSearchResponse
        >('Purchase_Search', { SearchParameters: searchParams });

        const purchases = response.Purchases?.Purchase || [];
        return successResult({
          totalRecords: response.TotalRecords,
          count: purchases.length,
          purchases: purchases,
        });
      }

      case 'quickfile_purchase_get': {
        const response = await apiClient.request<{ PurchaseID: number }, PurchaseGetResponse>(
          'Purchase_Get',
          { PurchaseID: args.purchaseId as number }
        );

        return successResult(response.PurchaseDetails);
      }

      case 'quickfile_purchase_create': {
        const lineItems = args.lines as Array<{
          description: string;
          unitCost: number;
          quantity: number;
          nominalCode: string;
          vatPercentage?: number;
        }>;

        const purchaseLines: PurchaseLine[] = lineItems.map((line) => ({
          ItemDescription: line.description,
          UnitCost: line.unitCost,
          Qty: line.quantity,
          NominalCode: line.nominalCode,
          Tax1: {
            TaxName: 'VAT',
            TaxPercentage: line.vatPercentage ?? 20,
          },
        }));

        const createParams: PurchaseCreateParams = {
          SupplierID: args.supplierId as number,
          Currency: (args.currency as string) ?? 'GBP',
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
        >('Purchase_Create', { PurchaseData: cleaned });

        return successResult({
          success: true,
          purchaseId: response.PurchaseID,
          purchaseNumber: response.PurchaseNumber,
          message: `Purchase #${response.PurchaseNumber} created successfully`,
        });
      }

      case 'quickfile_purchase_delete': {
        await apiClient.request<{ PurchaseID: number }, Record<string, never>>(
          'Purchase_Delete',
          { PurchaseID: args.purchaseId as number }
        );

        return successResult({
          success: true,
          purchaseId: args.purchaseId,
          message: `Purchase #${args.purchaseId} deleted successfully`,
        });
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown purchase tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

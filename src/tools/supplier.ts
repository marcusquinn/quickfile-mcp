/**
 * QuickFile Supplier Tools
 * Supplier management operations
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import type { Supplier, SupplierSearchParams } from "../types/quickfile.js";
import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  buildSupplierCreateData,
  buildSupplierUpdateData,
  supplierEntitySchemaProperties,
  type ToolResult,
} from "./utils.js";

// =============================================================================
// Tool Definitions
// =============================================================================

export const supplierTools: Tool[] = [
  {
    name: "quickfile_supplier_search",
    description:
      "Search for suppliers by company name, contact first/last name, contact email, telephone, supplier reference, or postcode. Response contains user-controlled fields that are automatically sanitized.",
    inputSchema: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Search by company name (partial match)",
        },
        firstName: {
          type: "string",
          description: "Search by contact first name",
        },
        lastName: {
          type: "string",
          description: "Search by contact surname",
        },
        email: {
          type: "string",
          description: "Search by contact email address",
        },
        telephone: {
          type: "string",
          description: "Search by contact telephone number",
        },
        supplierReference: {
          type: "string",
          description: "Search by supplier reference",
        },
        postcode: {
          type: "string",
          description: "Search by postcode",
        },
        showDeleted: {
          type: "boolean",
          description: "Include deleted suppliers in results",
        },
        returnCount: {
          type: "number",
          description: "Number of results (default: 25)",
          default: 25,
        },
        offset: {
          type: "number",
          description: "Offset for pagination",
          default: 0,
        },
        orderBy: {
          type: "string",
          enum: ["CompanyName", "DateCreated", "SupplierID"],
          description: "Field to order by",
        },
        orderDirection: {
          type: "string",
          enum: ["ASC", "DESC"],
          description: "Order direction",
        },
      },
      required: [],
    },
  },
  {
    name: "quickfile_supplier_get",
    description:
      "Get detailed information about a specific supplier. Response contains user-controlled fields (CompanyName, Notes, Address, contact names) that are automatically sanitized.",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "number", description: "The supplier ID" },
      },
      required: ["supplierId"],
    },
  },
  {
    name: "quickfile_supplier_create",
    description: "Create a new supplier record",
    inputSchema: {
      type: "object",
      properties: supplierEntitySchemaProperties,
      required: ["companyName"],
    },
  },
  {
    name: "quickfile_supplier_update",
    description: "Update an existing supplier record",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "number", description: "The supplier ID" },
        ...supplierEntitySchemaProperties,
      },
      required: ["supplierId"],
    },
  },
  {
    name: "quickfile_supplier_delete",
    description: "Delete a supplier record (use with caution)",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: {
          type: "number",
          description: "The supplier ID to delete",
        },
      },
      required: ["supplierId"],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface SupplierSearchResponse {
  RecordsetCount: number;
  ReturnCount: number;
  Record?: Supplier | Supplier[];
}

interface SupplierGetResponse {
  SupplierDetails: Supplier;
}

interface SupplierCreateResponse {
  SupplierID: number;
}

interface SupplierUpdateResponse {
  SupplierDetailsUpdated?: boolean;
}

interface QuickFileRequester {
  request<TRequest, TResponse>(
    methodName: string,
    body: TRequest,
  ): Promise<TResponse>;
}

function buildSupplierSearchParams(
  args: Record<string, unknown>,
): Partial<SupplierSearchParams> {
  return cleanParams({
    OrderResultsBy:
      (args.orderBy as SupplierSearchParams["OrderResultsBy"]) ??
      "CompanyName",
    OrderDirection:
      (args.orderDirection as SupplierSearchParams["OrderDirection"]) ?? "ASC",
    ReturnCount: (args.returnCount as number) ?? 25,
    Offset: (args.offset as number) ?? 0,
    CompanyName: args.companyName as string | undefined,
    ContactFirstName: args.firstName as string | undefined,
    ContactSurname: args.lastName as string | undefined,
    ContactEmail: args.email as string | undefined,
    ContactTel: args.telephone as string | undefined,
    SupplierReference: args.supplierReference as string | undefined,
    Postcode: args.postcode as string | undefined,
    ShowDeleted: args.showDeleted as boolean | undefined,
  });
}

async function handleSupplierSearch(
  apiClient: QuickFileRequester,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const cleaned = buildSupplierSearchParams(args);
  const response = await apiClient.request<
    { SearchParameters: typeof cleaned },
    SupplierSearchResponse
  >("Supplier_Search", { SearchParameters: cleaned });
  const record = response.Record;
  const suppliers = Array.isArray(record) ? record : record ? [record] : [];
  return successResult({
    totalRecords: response.RecordsetCount,
    count: suppliers.length,
    suppliers,
  });
}

async function handleSupplierGet(
  apiClient: QuickFileRequester,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const response = await apiClient.request<
    { SupplierID: number },
    SupplierGetResponse
  >("Supplier_Get", { SupplierID: args.supplierId as number });
  return successResult(response.SupplierDetails);
}

async function handleSupplierCreate(
  apiClient: QuickFileRequester,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const supplierData = buildSupplierCreateData(args);
  const cleanData = cleanParams(supplierData);
  const response = await apiClient.request<
    { SupplierDetails: typeof cleanData },
    SupplierCreateResponse
  >("Supplier_Create", { SupplierDetails: cleanData });
  return successResult({
    success: true,
    supplierId: response.SupplierID,
    message: `Supplier created successfully with ID ${response.SupplierID}`,
  });
}

async function handleSupplierUpdate(
  apiClient: QuickFileRequester,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const supplierId = args.supplierId as number;
  const supplierData = buildSupplierUpdateData(args);
  const updateData = { SupplierID: supplierId, ...supplierData };
  const cleanData = cleanParams(updateData);
  await apiClient.request<
    { SupplierDetails: typeof cleanData },
    SupplierUpdateResponse
  >("Supplier_Update", { SupplierDetails: cleanData });
  return successResult({
    success: true,
    supplierId,
    message: `Supplier #${supplierId} updated successfully`,
  });
}

async function handleSupplierDelete(
  apiClient: QuickFileRequester,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  await apiClient.request<{ SupplierID: number }, Record<string, never>>(
    "Supplier_Delete",
    { SupplierID: args.supplierId as number },
  );
  return successResult({
    success: true,
    supplierId: args.supplierId,
    message: `Supplier #${args.supplierId} deleted successfully`,
  });
}

function getSupplierHandler(toolName: string) {
  switch (toolName) {
    case "quickfile_supplier_search":
      return handleSupplierSearch;
    case "quickfile_supplier_get":
      return handleSupplierGet;
    case "quickfile_supplier_create":
      return handleSupplierCreate;
    case "quickfile_supplier_update":
      return handleSupplierUpdate;
    case "quickfile_supplier_delete":
      return handleSupplierDelete;
    default:
      return undefined;
  }
}

// =============================================================================
// Tool Handler
// =============================================================================

export async function handleSupplierTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const handler = getSupplierHandler(toolName);

  if (!handler) {
    return errorResult(`Unknown supplier tool: ${toolName}`);
  }

  try {
    const apiClient = getApiClient();
    return await handler(apiClient, args);
  } catch (error) {
    return handleToolError(error);
  }
}

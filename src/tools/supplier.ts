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
  cleanParams,
  buildAddressFromArgs,
  buildEntityData,
  type ToolResult,
} from "./utils.js";

// =============================================================================
// Tool Definitions
// =============================================================================

export const supplierTools: Tool[] = [
  {
    name: "quickfile_supplier_search",
    description:
      "Search for suppliers by company name, contact name, email, or postcode",
    inputSchema: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Search by company name (partial match)",
        },
        contactName: {
          type: "string",
          description: "Search by contact name",
        },
        email: {
          type: "string",
          description: "Search by email address",
        },
        postcode: {
          type: "string",
          description: "Search by postcode",
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
    description: "Get detailed information about a specific supplier",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: {
          type: "number",
          description: "The supplier ID",
        },
      },
      required: ["supplierId"],
    },
  },
  {
    name: "quickfile_supplier_create",
    description: "Create a new supplier record",
    inputSchema: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          description: "Company or organisation name",
        },
        title: {
          type: "string",
          description: "Contact title (Mr, Mrs, etc.)",
        },
        firstName: {
          type: "string",
          description: "Contact first name",
        },
        lastName: {
          type: "string",
          description: "Contact last name",
        },
        email: {
          type: "string",
          description: "Email address",
        },
        telephone: {
          type: "string",
          description: "Telephone number",
        },
        mobile: {
          type: "string",
          description: "Mobile number",
        },
        website: {
          type: "string",
          description: "Website URL",
        },
        address1: {
          type: "string",
          description: "Address line 1",
        },
        address2: {
          type: "string",
          description: "Address line 2",
        },
        town: {
          type: "string",
          description: "Town/City",
        },
        county: {
          type: "string",
          description: "County/Region",
        },
        postcode: {
          type: "string",
          description: "Postcode",
        },
        country: {
          type: "string",
          description: "Country",
        },
        vatNumber: {
          type: "string",
          description: "VAT registration number",
        },
        companyRegNo: {
          type: "string",
          description: "Company registration number",
        },
        currency: {
          type: "string",
          description: "Default currency (e.g., GBP)",
          default: "GBP",
        },
        termDays: {
          type: "number",
          description: "Payment terms in days",
          default: 30,
        },
        notes: {
          type: "string",
          description: "Internal notes about the supplier",
        },
      },
      required: [],
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
  Suppliers: {
    Supplier: Supplier[];
  };
  TotalRecords: number;
}

interface SupplierGetResponse {
  SupplierDetails: Supplier;
}

interface SupplierCreateResponse {
  SupplierID: number;
}

// =============================================================================
// Tool Handler
// =============================================================================

export async function handleSupplierTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case "quickfile_supplier_search": {
        const params: SupplierSearchParams = {
          OrderResultsBy:
            (args.orderBy as SupplierSearchParams["OrderResultsBy"]) ??
            "CompanyName",
          OrderDirection:
            (args.orderDirection as SupplierSearchParams["OrderDirection"]) ??
            "ASC",
          ReturnCount: (args.returnCount as number) ?? 25,
          Offset: (args.offset as number) ?? 0,
          CompanyName: args.companyName as string | undefined,
          ContactName: args.contactName as string | undefined,
          Email: args.email as string | undefined,
          Postcode: args.postcode as string | undefined,
        };
        const cleaned = cleanParams(params);
        const response = await apiClient.request<
          { SearchParameters: typeof cleaned },
          SupplierSearchResponse
        >("Supplier_Search", { SearchParameters: cleaned });
        const suppliers = response.Suppliers?.Supplier || [];
        return successResult({
          totalRecords: response.TotalRecords,
          count: suppliers.length,
          suppliers,
        });
      }

      case "quickfile_supplier_get": {
        const response = await apiClient.request<
          { SupplierID: number },
          SupplierGetResponse
        >("Supplier_Get", { SupplierID: args.supplierId as number });
        return successResult(response.SupplierDetails);
      }

      case "quickfile_supplier_create": {
        const address = buildAddressFromArgs(args);
        const supplierData = buildEntityData(args, address);
        const cleanData = cleanParams(supplierData);
        const response = await apiClient.request<
          { SupplierData: typeof cleanData },
          SupplierCreateResponse
        >("Supplier_Create", { SupplierData: cleanData });
        return successResult({
          success: true,
          supplierId: response.SupplierID,
          message: `Supplier created successfully with ID ${response.SupplierID}`,
        });
      }

      case "quickfile_supplier_delete": {
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

      default:
        return {
          content: [
            { type: "text", text: `Unknown supplier tool: ${toolName}` },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

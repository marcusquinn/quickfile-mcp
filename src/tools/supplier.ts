/** QuickFile REST supplier tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  cleanParams,
  errorResult,
  handleToolError,
  logger,
  successResult,
  supplierEntitySchemaProperties,
  type ToolResult,
} from "./utils.js";

export const supplierTools: Tool[] = [
  {
    name: "quickfile_supplier_search",
    description: "Search suppliers",
    inputSchema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        supplierReference: { type: "string" },
        showDeleted: { type: "boolean" },
        returnCount: { type: "number", default: 25 },
        offset: { type: "number", default: 0 },
        orderBy: { type: "string" },
        orderDirection: { type: "string", enum: ["ASC", "DESC"] },
      },
      required: [],
    },
  },
  {
    name: "quickfile_supplier_get",
    description: "Get a supplier",
    inputSchema: {
      type: "object",
      properties: { supplierId: { type: "number" } },
      required: ["supplierId"],
    },
  },
  {
    name: "quickfile_supplier_create",
    description: "Create a supplier",
    inputSchema: {
      type: "object",
      properties: supplierEntitySchemaProperties,
      required: ["companyName"],
    },
  },
  {
    name: "quickfile_supplier_update",
    description: "Update a supplier",
    inputSchema: {
      type: "object",
      properties: {
        supplierId: { type: "number" },
        companyName: supplierEntitySchemaProperties.companyName,
        companyNumber: supplierEntitySchemaProperties.companyNumber,
        supplierReference: supplierEntitySchemaProperties.supplierReference,
        website: supplierEntitySchemaProperties.website,
        address1: supplierEntitySchemaProperties.address1,
        address2: supplierEntitySchemaProperties.address2,
        address3: supplierEntitySchemaProperties.address3,
        town: supplierEntitySchemaProperties.town,
        postcode: supplierEntitySchemaProperties.postcode,
        countryIso: supplierEntitySchemaProperties.countryIso,
        country: supplierEntitySchemaProperties.country,
        vatNumber: supplierEntitySchemaProperties.vatNumber,
        currency: supplierEntitySchemaProperties.currency,
        termDays: supplierEntitySchemaProperties.termDays,
        defaultVatRate: supplierEntitySchemaProperties.defaultVatRate,
        defaultNominalCode: supplierEntitySchemaProperties.defaultNominalCode,
      },
      required: ["supplierId"],
    },
  },
  {
    name: "quickfile_supplier_delete",
    description: "Delete a supplier (destructive; confirmation required)",
    inputSchema: {
      type: "object",
      properties: { supplierId: { type: "number" } },
      required: ["supplierId"],
    },
  },
];

interface PagingResponse<T> {
  count: number;
  data: T[];
}

interface SupplierResponse {
  id: number;
}

function countryIso(args: Record<string, unknown>): string | undefined {
  const raw = args.countryIso ?? args.country;
  if (!raw) {
    return undefined;
  }
  const normalized = String(raw).toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }
  logger.warn("Ignored unrecognised country code", { country: normalized });
  return undefined;
}

function supplierBody(
  args: Record<string, unknown>,
  includeContact: boolean,
): Record<string, unknown> {
  return cleanParams({
    company_name: args.companyName,
    contact_first_name: includeContact ? args.firstName : undefined,
    contact_surname: includeContact ? args.lastName : undefined,
    contact_telephone: includeContact ? args.telephone : undefined,
    contact_email: includeContact ? args.email : undefined,
    company_number: args.companyNumber,
    supplier_reference: args.supplierReference,
    address_line1: args.address1,
    address_line2: args.address2,
    address_line3: args.address3,
    town: args.town,
    country_iso: countryIso(args),
    post_code: args.postcode,
    website: args.website,
    vat_number: args.vatNumber,
    default_currency: args.currency,
    default_term: args.termDays,
    default_vatrate: args.defaultVatRate,
    default_nominalcode: args.defaultNominalCode,
  });
}

export async function handleSupplierTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  if (!supplierTools.some((tool) => tool.name === toolName)) {
    return errorResult(`Unknown supplier tool: ${toolName}`);
  }
  try {
    const client = getApiClient(args.account as string);
    switch (toolName) {
      case "quickfile_supplier_search": {
        const response = await client.request<PagingResponse<unknown>>(
          "/suppliers",
          {
            query: cleanParams({
              company_name: args.companyName,
              first_name: args.firstName,
              surname: args.lastName,
              email: args.email,
              telephone: args.telephone,
              supplier_reference: args.supplierReference,
              include_deleted: args.showDeleted,
              order_column: args.orderBy ?? "company_name",
              order_direction: String(
                args.orderDirection ?? "ASC",
              ).toLowerCase(),
              offset: args.offset ?? 0,
              limit: args.returnCount ?? 25,
            }),
          },
        );
        return successResult({
          totalRecords: response.count,
          count: response.data.length,
          suppliers: response.data,
        });
      }
      case "quickfile_supplier_get":
        return successResult(await client.request(`/suppliers/${args.supplierId}`));
      case "quickfile_supplier_create": {
        const response = await client.request<SupplierResponse>("/suppliers", {
          method: "POST",
          body: supplierBody(args, true),
        });
        return successResult({ success: true, supplierId: response.id });
      }
      case "quickfile_supplier_update":
        return successResult({
          success: true,
          supplier: await client.request(`/suppliers/${args.supplierId}`, {
            method: "PUT",
            body: supplierBody(args, false),
          }),
        });
      case "quickfile_supplier_delete":
        await client.request(`/suppliers/${args.supplierId}`, {
          method: "DELETE",
        });
        return successResult({ success: true, supplierId: args.supplierId });
      default:
        return errorResult(`Unknown supplier tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

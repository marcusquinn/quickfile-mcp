/** QuickFile REST client/customer tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  searchSchemaProperties,
  entitySchemaProperties,
  type ToolResult,
} from "./utils.js";

export const clientTools: Tool[] = [
  {
    name: "quickfile_client_search",
    description:
      "Search clients. Returned names, contacts, and addresses are sanitized as untrusted content.",
    inputSchema: {
      type: "object",
      properties: {
        ...searchSchemaProperties,
        includeDeleted: { type: "boolean" },
        orderBy: {
          type: "string",
          enum: ["company_name", "created_date"],
        },
      },
      required: [],
    },
  },
  {
    name: "quickfile_client_get",
    description: "Get a client, including contacts and financial summary",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "number" } },
      required: ["clientId"],
    },
  },
  {
    name: "quickfile_client_create",
    description: "Create a client and optionally its first contact",
    inputSchema: {
      type: "object",
      properties: {
        ...entitySchemaProperties,
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        mobile: { type: "string" },
      },
      required: ["companyName"],
    },
  },
  {
    name: "quickfile_client_update",
    description: "Update a client",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "number" }, ...entitySchemaProperties },
      required: ["clientId"],
    },
  },
  {
    name: "quickfile_client_delete",
    description: "Delete a client (destructive; confirmation required)",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "number" } },
      required: ["clientId"],
    },
  },
  {
    name: "quickfile_client_insert_contacts",
    description: "Add a contact to a client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "number" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        mobile: { type: "string" },
        isPrimary: { type: "boolean", default: false },
      },
      required: ["clientId", "firstName", "lastName", "email"],
    },
  },
  {
    name: "quickfile_client_login_url",
    description: "Generate a time-limited client dashboard login URL",
    inputSchema: {
      type: "object",
      properties: { clientId: { type: "number" } },
      required: ["clientId"],
    },
  },
];

interface PagingResponse<T> {
  count: number;
  data: T[];
}

interface EntityResponse {
  id: number;
}

interface LoginResponse {
  redirect_url: string;
}

function clientBody(
  args: Record<string, unknown>,
  includeDefaults: boolean,
): Record<string, unknown> {
  return cleanParams({
    company_name: args.companyName,
    company_number: args.companyRegNo,
    address_line1: args.address1,
    address_line2: args.address2,
    address_line3: args.county,
    town: args.town,
    country_iso: normalizeCountryIso(args.countryIso ?? args.country),
    post_code: args.postcode,
    vat_number: args.vatNumber,
    default_currency: args.currency ?? (includeDefaults ? "GBP" : undefined),
    default_term: args.termDays ?? (includeDefaults ? 30 : undefined),
  });
}

function normalizeCountryIso(value: unknown): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const normalized = String(value).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error("countryIso must be an ISO 3166-1 alpha-2 code");
  }
  return normalized;
}

function contactBody(args: Record<string, unknown>): Record<string, unknown> {
  return cleanParams({
    first_name: args.firstName,
    surname: args.lastName,
    email: args.email,
    telephone1: args.telephone,
    telephone2: args.mobile,
    is_default: args.isPrimary ?? false,
  });
}

function hasContactInput(args: Record<string, unknown>): boolean {
  return ["firstName", "lastName", "email", "telephone", "mobile"].some(
    (field) => args[field] !== undefined,
  );
}

export async function handleClientTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = getApiClient(args.account as string);
  try {
    switch (toolName) {
      case "quickfile_client_search": {
        const response = await client.request<PagingResponse<unknown>>("/clients", {
          query: cleanParams({
            company_name: args.companyName,
            first_name: args.firstName,
            surname: args.lastName,
            email: args.email,
            telephone: args.telephone,
            include_deleted: args.includeDeleted,
            order_column: args.orderBy ?? "company_name",
            order_direction: String(args.orderDirection ?? "ASC").toLowerCase(),
            offset: args.offset ?? 0,
            limit: args.returnCount ?? 25,
          }),
        });
        return successResult({
          totalRecords: response.count,
          count: response.data.length,
          clients: response.data,
        });
      }
      case "quickfile_client_get":
        return successResult(
          await client.request(`/clients/${args.clientId}`, {
            query: { contacts: true, financials: true },
          }),
        );
      case "quickfile_client_create": {
        if (
          hasContactInput(args) &&
          (!args.firstName || !args.lastName || !args.email)
        ) {
          return errorResult(
            "firstName, lastName, and email are all required when creating a client contact",
          );
        }
        const created = await client.request<EntityResponse>("/clients", {
          method: "POST",
          body: clientBody(args, true),
        });
        let contactId: number | undefined;
        if (hasContactInput(args)) {
          const contact = await client.request<EntityResponse>(
            `/clients/${created.id}/contacts`,
            { method: "POST", body: contactBody(args) },
          );
          contactId = contact.id;
        }
        return successResult({ success: true, clientId: created.id, contactId });
      }
      case "quickfile_client_update":
        return successResult({
          success: true,
          client: await client.request(`/clients/${args.clientId}`, {
            method: "PUT",
            body: clientBody(args, false),
          }),
        });
      case "quickfile_client_delete":
        await client.request(`/clients/${args.clientId}`, { method: "DELETE" });
        return successResult({ success: true, clientId: args.clientId });
      case "quickfile_client_insert_contacts": {
        const contact = await client.request<EntityResponse>(
          `/clients/${args.clientId}/contacts`,
          { method: "POST", body: contactBody(args) },
        );
        return successResult({
          success: true,
          clientId: args.clientId,
          contactId: contact.id,
        });
      }
      case "quickfile_client_login_url": {
        const response = await client.request<LoginResponse>(
          `/clients/${args.clientId}/login`,
          {
            method: "POST",
            body: { landing_page: { dashboard: true } },
          },
        );
        return successResult({
          clientId: args.clientId,
          loginUrl: response.redirect_url,
        });
      }
      default:
        return errorResult(`Unknown client tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

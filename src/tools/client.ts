/**
 * QuickFile Client Tools
 * Client/customer management operations
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import type { Client, ClientContact } from "../types/quickfile.js";
import {
  handleToolError,
  successResult,
  cleanParams,
  buildAddressFromArgs,
  buildEntityData,
  buildEntityUpdateData,
  searchSchemaProperties,
  entitySchemaProperties,
  type ToolResult,
} from "./utils.js";

// =============================================================================
// Tool Definitions
// =============================================================================

export const clientTools: Tool[] = [
  {
    name: "quickfile_client_search",
    description:
      "Search for clients by company name, contact name, email, or postcode",
    inputSchema: {
      type: "object",
      properties: {
        ...searchSchemaProperties,
        orderBy: {
          type: "string",
          enum: ["CompanyName", "DateCreated", "ClientID"],
          description: "Field to order results by",
        },
      },
      required: [],
    },
  },
  {
    name: "quickfile_client_get",
    description: "Get detailed information about a specific client by ID",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "number", description: "The client ID" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "quickfile_client_create",
    description: "Create a new client record",
    inputSchema: {
      type: "object",
      properties: entitySchemaProperties,
      required: [],
    },
  },
  {
    name: "quickfile_client_update",
    description: "Update an existing client record",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "number", description: "The client ID to update" },
        ...entitySchemaProperties,
      },
      required: ["clientId"],
    },
  },
  {
    name: "quickfile_client_delete",
    description: "Delete a client record (use with caution)",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "number", description: "The client ID to delete" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "quickfile_client_insert_contacts",
    description: "Add a new contact to an existing client",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "number", description: "The client ID" },
        firstName: { type: "string", description: "Contact first name" },
        lastName: { type: "string", description: "Contact last name" },
        email: { type: "string", description: "Contact email" },
        telephone: { type: "string", description: "Contact telephone" },
        mobile: { type: "string", description: "Contact mobile" },
        isPrimary: {
          type: "boolean",
          description: "Set as primary contact",
          default: false,
        },
      },
      required: ["clientId", "firstName", "lastName"],
    },
  },
  {
    name: "quickfile_client_login_url",
    description:
      "Get a passwordless login URL for a client to view their invoices",
    inputSchema: {
      type: "object",
      properties: {
        clientId: { type: "number", description: "The client ID" },
      },
      required: ["clientId"],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface ClientSearchResponse {
  RecordsetCount: number;
  ReturnCount: number;
  Record: Array<{
    ClientID: number;
    ClientCreatedDate: string;
    CompanyName: string;
    Status: string;
    PrimaryContact?: {
      FirstName?: string;
      Surname?: string;
      Telephone?: string;
      Email?: string;
    };
    AccountBalance?: string;
  }>;
}

interface ClientGetResponse {
  ClientDetails: Client;
}

interface ClientCreateResponse {
  ClientID: number;
}

interface ClientLoginResponse {
  LoginURL: string;
}

interface ContactInsertResponse {
  ContactID: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function buildSearchParams(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const searchParams: Record<string, unknown> = {
    ReturnCount: (args.returnCount as number) ?? 25,
    Offset: (args.offset as number) ?? 0,
    OrderResultsBy: (args.orderBy as string) ?? "CompanyName",
    OrderDirection: (args.orderDirection as string) ?? "ASC",
  };

  if (args.companyName) {
    searchParams.CompanyName = args.companyName;
  }
  if (args.firstName) {
    searchParams.FirstName = args.firstName;
  }
  if (args.lastName) {
    searchParams.Surname = args.lastName;
  }
  if (args.email) {
    searchParams.Email = args.email;
  }
  if (args.telephone) {
    searchParams.Telephone = args.telephone;
  }

  return searchParams;
}

// =============================================================================
// Tool Handler
// =============================================================================

export async function handleClientTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case "quickfile_client_search": {
        const searchParams = buildSearchParams(args);
        const response = await apiClient.request<
          { SearchParameters: typeof searchParams },
          ClientSearchResponse
        >("Client_Search", { SearchParameters: searchParams });
        const clients = response.Record || [];
        return successResult({
          totalRecords: response.RecordsetCount,
          returnedCount: response.ReturnCount,
          clients: clients,
        });
      }

      case "quickfile_client_get": {
        const response = await apiClient.request<
          { ClientID: number },
          ClientGetResponse
        >("Client_Get", { ClientID: args.clientId as number });
        return successResult(response.ClientDetails);
      }

      case "quickfile_client_create": {
        const address = buildAddressFromArgs(args);
        const clientData = buildEntityData(args, address);
        const cleanData = cleanParams(clientData);
        const response = await apiClient.request<
          { ClientData: typeof cleanData },
          ClientCreateResponse
        >("Client_Create", { ClientData: cleanData });
        return successResult({
          success: true,
          clientId: response.ClientID,
          message: `Client created successfully with ID ${response.ClientID}`,
        });
      }

      case "quickfile_client_update": {
        const clientId = args.clientId as number;
        const address = buildAddressFromArgs(args);
        const entityData = buildEntityUpdateData(args, address);
        const updateData = { ClientID: clientId, ...entityData };
        const cleanData = cleanParams(updateData);
        await apiClient.request<
          { ClientData: typeof cleanData },
          Record<string, never>
        >("Client_Update", { ClientData: cleanData });
        return successResult({
          success: true,
          clientId,
          message: `Client #${clientId} updated successfully`,
        });
      }

      case "quickfile_client_delete": {
        const clientId = args.clientId as number;
        await apiClient.request<{ ClientID: number }, Record<string, never>>(
          "Client_Delete",
          { ClientID: clientId },
        );
        return successResult({
          success: true,
          clientId,
          message: `Client #${clientId} deleted successfully`,
        });
      }

      case "quickfile_client_insert_contacts": {
        const contact: ClientContact = {
          FirstName: args.firstName as string,
          LastName: args.lastName as string,
          Email: args.email as string | undefined,
          Telephone: args.telephone as string | undefined,
          Mobile: args.mobile as string | undefined,
          IsPrimary: (args.isPrimary as boolean) ?? false,
        };
        const response = await apiClient.request<
          { ClientID: number; Contact: ClientContact },
          ContactInsertResponse
        >("Client_InsertContacts", {
          ClientID: args.clientId as number,
          Contact: contact,
        });
        return successResult({
          success: true,
          contactId: response.ContactID,
          message: `Contact added to client #${args.clientId}`,
        });
      }

      case "quickfile_client_login_url": {
        const response = await apiClient.request<
          { ClientID: number },
          ClientLoginResponse
        >("Client_LogIn", { ClientID: args.clientId as number });
        return successResult({
          clientId: args.clientId,
          loginUrl: response.LoginURL,
          message: "Passwordless login URL generated (valid for limited time)",
        });
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown client tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

/**
 * QuickFile Client Tools
 * Client/customer management operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient } from '../api/client.js';
import type {
  Client,
  ClientContact,
  ClientAddress,
} from '../types/quickfile.js';
import { handleToolError, successResult, cleanParams, type ToolResult } from './utils.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const clientTools: Tool[] = [
  {
    name: 'quickfile_client_search',
    description: 'Search for clients by company name, contact name, email, or postcode',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Search by company name (partial match)',
        },
        contactName: {
          type: 'string',
          description: 'Search by contact name',
        },
        email: {
          type: 'string',
          description: 'Search by email address',
        },
        postcode: {
          type: 'string',
          description: 'Search by postcode',
        },
        returnCount: {
          type: 'number',
          description: 'Number of results to return (default: 25)',
          default: 25,
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
          default: 0,
        },
        orderBy: {
          type: 'string',
          enum: ['CompanyName', 'DateCreated', 'ClientID'],
          description: 'Field to order results by',
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
    name: 'quickfile_client_get',
    description: 'Get detailed information about a specific client by ID',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'number',
          description: 'The client ID',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'quickfile_client_create',
    description: 'Create a new client record',
    inputSchema: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Company or organisation name',
        },
        title: {
          type: 'string',
          description: 'Contact title (Mr, Mrs, etc.)',
        },
        firstName: {
          type: 'string',
          description: 'Contact first name',
        },
        lastName: {
          type: 'string',
          description: 'Contact last name',
        },
        email: {
          type: 'string',
          description: 'Email address',
        },
        telephone: {
          type: 'string',
          description: 'Telephone number',
        },
        mobile: {
          type: 'string',
          description: 'Mobile number',
        },
        website: {
          type: 'string',
          description: 'Website URL',
        },
        address1: {
          type: 'string',
          description: 'Address line 1',
        },
        address2: {
          type: 'string',
          description: 'Address line 2',
        },
        town: {
          type: 'string',
          description: 'Town/City',
        },
        county: {
          type: 'string',
          description: 'County/Region',
        },
        postcode: {
          type: 'string',
          description: 'Postcode',
        },
        country: {
          type: 'string',
          description: 'Country',
        },
        vatNumber: {
          type: 'string',
          description: 'VAT registration number',
        },
        companyRegNo: {
          type: 'string',
          description: 'Company registration number',
        },
        currency: {
          type: 'string',
          description: 'Default currency (e.g., GBP, EUR, USD)',
          default: 'GBP',
        },
        termDays: {
          type: 'number',
          description: 'Payment terms in days',
          default: 30,
        },
        notes: {
          type: 'string',
          description: 'Internal notes about the client',
        },
      },
      required: [],
    },
  },
  {
    name: 'quickfile_client_update',
    description: 'Update an existing client record',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'number',
          description: 'The client ID to update',
        },
        companyName: { type: 'string' },
        title: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        telephone: { type: 'string' },
        mobile: { type: 'string' },
        website: { type: 'string' },
        address1: { type: 'string' },
        address2: { type: 'string' },
        town: { type: 'string' },
        county: { type: 'string' },
        postcode: { type: 'string' },
        country: { type: 'string' },
        vatNumber: { type: 'string' },
        companyRegNo: { type: 'string' },
        currency: { type: 'string' },
        termDays: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'quickfile_client_delete',
    description: 'Delete a client record (use with caution)',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'number',
          description: 'The client ID to delete',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'quickfile_client_insert_contacts',
    description: 'Add a new contact to an existing client',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'number',
          description: 'The client ID',
        },
        firstName: {
          type: 'string',
          description: 'Contact first name',
        },
        lastName: {
          type: 'string',
          description: 'Contact last name',
        },
        email: {
          type: 'string',
          description: 'Contact email',
        },
        telephone: {
          type: 'string',
          description: 'Contact telephone',
        },
        mobile: {
          type: 'string',
          description: 'Contact mobile',
        },
        isPrimary: {
          type: 'boolean',
          description: 'Set as primary contact',
          default: false,
        },
      },
      required: ['clientId', 'firstName', 'lastName'],
    },
  },
  {
    name: 'quickfile_client_login_url',
    description: 'Get a passwordless login URL for a client to view their invoices',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'number',
          description: 'The client ID',
        },
      },
      required: ['clientId'],
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

export async function handleClientTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_client_search': {
        // Build search parameters matching QuickFile API spec
        // OrderDirection and OrderResultsBy are REQUIRED fields
        const searchParams: Record<string, unknown> = {
          ReturnCount: (args.returnCount as number) ?? 25,
          Offset: (args.offset as number) ?? 0,
          OrderResultsBy: (args.orderBy as string) ?? 'CompanyName',
          OrderDirection: (args.orderDirection as string) ?? 'ASC',
        };
        
        if (args.companyName) { searchParams.CompanyName = args.companyName; }
        if (args.firstName) { searchParams.FirstName = args.firstName; }
        if (args.lastName) { searchParams.Surname = args.lastName; }
        if (args.email) { searchParams.Email = args.email; }
        if (args.telephone) { searchParams.Telephone = args.telephone; }

        const response = await apiClient.request<{ SearchParameters: typeof searchParams }, ClientSearchResponse>(
          'Client_Search',
          { SearchParameters: searchParams }
        );

        const clients = response.Record || [];
        return successResult({
          totalRecords: response.RecordsetCount,
          returnedCount: response.ReturnCount,
          clients: clients,
        });
      }

      case 'quickfile_client_get': {
        const response = await apiClient.request<{ ClientID: number }, ClientGetResponse>(
          'Client_Get',
          { ClientID: args.clientId as number }
        );

        return successResult(response.ClientDetails);
      }

      case 'quickfile_client_create': {
        const address: ClientAddress = {};
        if (args.address1) { address.Address1 = args.address1 as string; }
        if (args.address2) { address.Address2 = args.address2 as string; }
        if (args.town) { address.Town = args.town as string; }
        if (args.county) { address.County = args.county as string; }
        if (args.postcode) { address.Postcode = args.postcode as string; }
        if (args.country) { address.Country = args.country as string; }

        const clientData: Partial<Client> = {
          CompanyName: args.companyName as string | undefined,
          Title: args.title as string | undefined,
          FirstName: args.firstName as string | undefined,
          LastName: args.lastName as string | undefined,
          Email: args.email as string | undefined,
          Telephone: args.telephone as string | undefined,
          Mobile: args.mobile as string | undefined,
          Website: args.website as string | undefined,
          VatNumber: args.vatNumber as string | undefined,
          CompanyRegNo: args.companyRegNo as string | undefined,
          Currency: (args.currency as string) ?? 'GBP',
          TermDays: (args.termDays as number) ?? 30,
          Notes: args.notes as string | undefined,
          Address: Object.keys(address).length > 0 ? address : undefined,
        };

        const cleanData = cleanParams(clientData);

        const response = await apiClient.request<{ ClientData: typeof cleanData }, ClientCreateResponse>(
          'Client_Create',
          { ClientData: cleanData }
        );

        return successResult({
          success: true,
          clientId: response.ClientID,
          message: `Client created successfully with ID ${response.ClientID}`,
        });
      }

      case 'quickfile_client_update': {
        const clientId = args.clientId as number;
        const address: ClientAddress = {};
        if (args.address1) { address.Address1 = args.address1 as string; }
        if (args.address2) { address.Address2 = args.address2 as string; }
        if (args.town) { address.Town = args.town as string; }
        if (args.county) { address.County = args.county as string; }
        if (args.postcode) { address.Postcode = args.postcode as string; }
        if (args.country) { address.Country = args.country as string; }

        const updateData: Partial<Client> & { ClientID: number } = {
          ClientID: clientId,
          CompanyName: args.companyName as string | undefined,
          Title: args.title as string | undefined,
          FirstName: args.firstName as string | undefined,
          LastName: args.lastName as string | undefined,
          Email: args.email as string | undefined,
          Telephone: args.telephone as string | undefined,
          Mobile: args.mobile as string | undefined,
          Website: args.website as string | undefined,
          VatNumber: args.vatNumber as string | undefined,
          CompanyRegNo: args.companyRegNo as string | undefined,
          Currency: args.currency as string | undefined,
          TermDays: args.termDays as number | undefined,
          Notes: args.notes as string | undefined,
          Address: Object.keys(address).length > 0 ? address : undefined,
        };

        const cleanData = cleanParams(updateData);

        await apiClient.request<{ ClientData: typeof cleanData }, Record<string, never>>(
          'Client_Update',
          { ClientData: cleanData }
        );

        return successResult({
          success: true,
          clientId,
          message: `Client #${clientId} updated successfully`,
        });
      }

      case 'quickfile_client_delete': {
        const clientId = args.clientId as number;

        await apiClient.request<{ ClientID: number }, Record<string, never>>(
          'Client_Delete',
          { ClientID: clientId }
        );

        return successResult({
          success: true,
          clientId,
          message: `Client #${clientId} deleted successfully`,
        });
      }

      case 'quickfile_client_insert_contacts': {
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
        >('Client_InsertContacts', {
          ClientID: args.clientId as number,
          Contact: contact,
        });

        return successResult({
          success: true,
          contactId: response.ContactID,
          message: `Contact added to client #${args.clientId}`,
        });
      }

      case 'quickfile_client_login_url': {
        const response = await apiClient.request<{ ClientID: number }, ClientLoginResponse>(
          'Client_LogIn',
          { ClientID: args.clientId as number }
        );

        return successResult({
          clientId: args.clientId,
          loginUrl: response.LoginURL,
          message: 'Passwordless login URL generated (valid for limited time)',
        });
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown client tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

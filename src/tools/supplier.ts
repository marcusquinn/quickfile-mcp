/**
 * QuickFile Supplier Tools
 * Supplier management operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient, QuickFileApiError } from '../api/client.js';
import type {
  Supplier,
  SupplierSearchParams,
  ClientAddress,
} from '../types/quickfile.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const supplierTools: Tool[] = [
  {
    name: 'quickfile_supplier_search',
    description: 'Search for suppliers by company name, contact name, email, or postcode',
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
          enum: ['CompanyName', 'DateCreated', 'SupplierID'],
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
    name: 'quickfile_supplier_get',
    description: 'Get detailed information about a specific supplier',
    inputSchema: {
      type: 'object',
      properties: {
        supplierId: {
          type: 'number',
          description: 'The supplier ID',
        },
      },
      required: ['supplierId'],
    },
  },
  {
    name: 'quickfile_supplier_create',
    description: 'Create a new supplier record',
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
          description: 'Default currency (e.g., GBP)',
          default: 'GBP',
        },
        termDays: {
          type: 'number',
          description: 'Payment terms in days',
          default: 30,
        },
        notes: {
          type: 'string',
          description: 'Internal notes about the supplier',
        },
      },
      required: [],
    },
  },
  {
    name: 'quickfile_supplier_delete',
    description: 'Delete a supplier record (use with caution)',
    inputSchema: {
      type: 'object',
      properties: {
        supplierId: {
          type: 'number',
          description: 'The supplier ID to delete',
        },
      },
      required: ['supplierId'],
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

export async function handleSupplierTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const client = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_supplier_search': {
        // OrderDirection and OrderResultsBy are REQUIRED fields
        const params: SupplierSearchParams = {
          OrderResultsBy: (args.orderBy as SupplierSearchParams['OrderResultsBy']) ?? 'CompanyName',
          OrderDirection: (args.orderDirection as SupplierSearchParams['OrderDirection']) ?? 'ASC',
          ReturnCount: (args.returnCount as number) ?? 25,
          Offset: (args.offset as number) ?? 0,
          CompanyName: args.companyName as string | undefined,
          ContactName: args.contactName as string | undefined,
          Email: args.email as string | undefined,
          Postcode: args.postcode as string | undefined,
        };

        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined)
        );

        const response = await client.request<
          { SearchParameters: typeof cleanParams },
          SupplierSearchResponse
        >('Supplier_Search', { SearchParameters: cleanParams });

        const suppliers = response.Suppliers?.Supplier || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalRecords: response.TotalRecords,
                  count: suppliers.length,
                  suppliers: suppliers,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_supplier_get': {
        const response = await client.request<{ SupplierID: number }, SupplierGetResponse>(
          'Supplier_Get',
          { SupplierID: args.supplierId as number }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.SupplierDetails, null, 2),
            },
          ],
        };
      }

      case 'quickfile_supplier_create': {
        const address: ClientAddress = {};
        if (args.address1) address.Address1 = args.address1 as string;
        if (args.address2) address.Address2 = args.address2 as string;
        if (args.town) address.Town = args.town as string;
        if (args.county) address.County = args.county as string;
        if (args.postcode) address.Postcode = args.postcode as string;
        if (args.country) address.Country = args.country as string;

        const supplierData: Partial<Supplier> = {
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

        const cleanData = Object.fromEntries(
          Object.entries(supplierData).filter(([, v]) => v !== undefined)
        );

        const response = await client.request<
          { SupplierData: typeof cleanData },
          SupplierCreateResponse
        >('Supplier_Create', { SupplierData: cleanData });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  supplierId: response.SupplierID,
                  message: `Supplier created successfully with ID ${response.SupplierID}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_supplier_delete': {
        await client.request<{ SupplierID: number }, Record<string, never>>(
          'Supplier_Delete',
          { SupplierID: args.supplierId as number }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  supplierId: args.supplierId,
                  message: `Supplier #${args.supplierId} deleted successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown supplier tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message =
      error instanceof QuickFileApiError
        ? `QuickFile API Error [${error.code}]: ${error.message}`
        : `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;

    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }
}

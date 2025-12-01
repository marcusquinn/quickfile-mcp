/**
 * QuickFile System Tools
 * System-level operations: account details, events, notes
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient } from '../api/client.js';
import type {
  AccountDetails,
  SystemEvent,
  SystemEventSearchParams,
  CreateNoteParams,
} from '../types/quickfile.js';
import { handleToolError, successResult, cleanParams, type ToolResult } from './utils.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const systemTools: Tool[] = [
  {
    name: 'quickfile_system_get_account',
    description: 'Get account details including company name, VAT status, year end date, and contact information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'quickfile_system_search_events',
    description: 'Search the system event log for audit trail and activity history',
    inputSchema: {
      type: 'object',
      properties: {
        eventType: {
          type: 'string',
          description: 'Filter by event type',
        },
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        relatedId: {
          type: 'number',
          description: 'Filter by related entity ID',
        },
        relatedType: {
          type: 'string',
          description: 'Filter by related entity type (INVOICE, CLIENT, etc.)',
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
      },
      required: [],
    },
  },
  {
    name: 'quickfile_system_create_note',
    description: 'Create a note attached to an invoice, purchase, client, or supplier',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['INVOICE', 'PURCHASE', 'CLIENT', 'SUPPLIER'],
          description: 'Type of entity to attach note to',
        },
        entityId: {
          type: 'number',
          description: 'ID of the entity',
        },
        noteText: {
          type: 'string',
          description: 'Content of the note',
        },
      },
      required: ['entityType', 'entityId', 'noteText'],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface GetAccountResponse {
  AccountDetails: AccountDetails;
}

interface SearchEventsResponse {
  Events: SystemEvent[];
  TotalRecords: number;
}

interface CreateNoteResponse {
  NoteID: number;
}

export async function handleSystemTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const client = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_system_get_account': {
        // QuickFile requires specific body structure with AccountNumber and ReturnVariables
        const requestBody = {
          AccountDetails: {
            AccountNumber: client.getAccountNumber(),
            ReturnVariables: {
              Variable: [
                'CompanyName',
                'CompanyNumber', 
                'BusinessType',
                'Address',
                'CountryIso',
                'BaseCurrency',
                'Tel',
                'Web',
                'VatRegNumber',
                'YearEndDate',
              ],
            },
          },
        };
        
        const response = await client.request<typeof requestBody, GetAccountResponse>(
          'System_GetAccountDetails',
          requestBody
        );
        return successResult(response.AccountDetails || response);
      }

      case 'quickfile_system_search_events': {
        const params: SystemEventSearchParams = {
          EventType: args.eventType as string | undefined,
          DateFrom: args.dateFrom as string | undefined,
          DateTo: args.dateTo as string | undefined,
          RelatedID: args.relatedId as number | undefined,
          RelatedType: args.relatedType as string | undefined,
          ReturnCount: (args.returnCount as number) ?? 25,
          Offset: (args.offset as number) ?? 0,
        };

        const cleaned = cleanParams(params);

        const response = await client.request<{ SearchParameters: typeof cleaned }, SearchEventsResponse>(
          'System_SearchEvents',
          { SearchParameters: cleaned }
        );

        return successResult({
          totalRecords: response.TotalRecords,
          events: response.Events,
        });
      }

      case 'quickfile_system_create_note': {
        const params: CreateNoteParams = {
          EntityType: args.entityType as CreateNoteParams['EntityType'],
          EntityID: args.entityId as number,
          NoteText: args.noteText as string,
        };

        const response = await client.request<CreateNoteParams, CreateNoteResponse>(
          'System_CreateNote',
          params
        );

        return successResult({
          success: true,
          noteId: response.NoteID,
          message: `Note created successfully for ${params.EntityType} #${params.EntityID}`,
        });
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown system tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

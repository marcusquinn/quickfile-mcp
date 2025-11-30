/**
 * QuickFile Invoice Tools
 * Invoice, estimate, and recurring invoice operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient, QuickFileApiError } from '../api/client.js';
import type {
  Invoice,
  InvoiceSearchParams,
  InvoiceCreateParams,
  InvoiceLine,
  InvoiceType,
  InvoiceStatus,
} from '../types/quickfile.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const invoiceTools: Tool[] = [
  {
    name: 'quickfile_invoice_search',
    description: 'Search for invoices by type, client, date range, status, or keyword',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceType: {
          type: 'string',
          enum: ['INVOICE', 'ESTIMATE', 'RECURRING', 'CREDIT'],
          description: 'Type of invoice to search for',
        },
        clientId: {
          type: 'number',
          description: 'Filter by client ID',
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
          enum: ['DRAFT', 'SENT', 'VIEWED', 'PAID', 'PART_PAID', 'OVERDUE', 'CANCELLED'],
          description: 'Invoice status',
        },
        searchKeyword: {
          type: 'string',
          description: 'Search keyword (invoice number, client name, etc.)',
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
          enum: ['InvoiceNumber', 'IssueDate', 'DueDate', 'ClientName', 'GrossAmount'],
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
    name: 'quickfile_invoice_get',
    description: 'Get detailed information about a specific invoice including line items',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'number',
          description: 'The invoice ID',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'quickfile_invoice_create',
    description: 'Create a new invoice, estimate, or credit note',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceType: {
          type: 'string',
          enum: ['INVOICE', 'ESTIMATE', 'CREDIT'],
          description: 'Type of document to create',
        },
        clientId: {
          type: 'number',
          description: 'Client ID',
        },
        currency: {
          type: 'string',
          description: 'Currency code (default: GBP)',
          default: 'GBP',
        },
        termDays: {
          type: 'number',
          description: 'Payment terms in days',
          default: 30,
        },
        issueDate: {
          type: 'string',
          description: 'Issue date (YYYY-MM-DD, default: today)',
        },
        poNumber: {
          type: 'string',
          description: 'Purchase order number',
        },
        notes: {
          type: 'string',
          description: 'Notes to appear on invoice',
        },
        lines: {
          type: 'array',
          description: 'Invoice line items',
          items: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Item description',
              },
              unitCost: {
                type: 'number',
                description: 'Unit price',
              },
              quantity: {
                type: 'number',
                description: 'Quantity',
              },
              vatPercentage: {
                type: 'number',
                description: 'VAT percentage (default: 20)',
                default: 20,
              },
              nominalCode: {
                type: 'string',
                description: 'Nominal code for accounting',
              },
            },
            required: ['description', 'unitCost', 'quantity'],
          },
        },
      },
      required: ['invoiceType', 'clientId', 'lines'],
    },
  },
  {
    name: 'quickfile_invoice_delete',
    description: 'Delete an invoice, estimate, or credit note',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'number',
          description: 'The invoice ID to delete',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'quickfile_invoice_send',
    description: 'Send an invoice or estimate by email',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'number',
          description: 'The invoice ID to send',
        },
        emailTo: {
          type: 'string',
          description: 'Recipient email address (uses client email if not specified)',
        },
        emailSubject: {
          type: 'string',
          description: 'Email subject line',
        },
        emailBody: {
          type: 'string',
          description: 'Email body text',
        },
        attachPdf: {
          type: 'boolean',
          description: 'Attach PDF to email',
          default: true,
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'quickfile_invoice_get_pdf',
    description: 'Get a URL to download the invoice as PDF',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'number',
          description: 'The invoice ID',
        },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'quickfile_estimate_accept_decline',
    description: 'Accept or decline an estimate',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: {
          type: 'number',
          description: 'The estimate ID',
        },
        action: {
          type: 'string',
          enum: ['ACCEPT', 'DECLINE'],
          description: 'Accept or decline the estimate',
        },
      },
      required: ['invoiceId', 'action'],
    },
  },
  {
    name: 'quickfile_estimate_convert_to_invoice',
    description: 'Convert an accepted estimate to an invoice',
    inputSchema: {
      type: 'object',
      properties: {
        estimateId: {
          type: 'number',
          description: 'The estimate ID to convert',
        },
      },
      required: ['estimateId'],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface InvoiceSearchResponse {
  Invoices: {
    Invoice: Invoice[];
  };
  TotalRecords: number;
}

interface InvoiceGetResponse {
  InvoiceDetails: Invoice;
}

interface InvoiceCreateResponse {
  InvoiceID: number;
  InvoiceNumber: string;
}

interface InvoicePdfResponse {
  PDFUri: string;
}

interface EstimateConvertResponse {
  InvoiceID: number;
  InvoiceNumber: string;
}

export async function handleInvoiceTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const client = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_invoice_search': {
        const params: InvoiceSearchParams = {
          InvoiceType: args.invoiceType as InvoiceType | undefined,
          ClientID: args.clientId as number | undefined,
          DateFrom: args.dateFrom as string | undefined,
          DateTo: args.dateTo as string | undefined,
          Status: args.status as InvoiceStatus | undefined,
          SearchKeyword: args.searchKeyword as string | undefined,
          ReturnCount: (args.returnCount as number) ?? 25,
          Offset: (args.offset as number) ?? 0,
          OrderResultsBy: args.orderBy as InvoiceSearchParams['OrderResultsBy'],
          OrderDirection: args.orderDirection as InvoiceSearchParams['OrderDirection'],
        };

        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined)
        );

        const response = await client.request<
          { SearchParameters: typeof cleanParams },
          InvoiceSearchResponse
        >('Invoice_Search', { SearchParameters: cleanParams });

        const invoices = response.Invoices?.Invoice || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalRecords: response.TotalRecords,
                  count: invoices.length,
                  invoices: invoices,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_invoice_get': {
        const response = await client.request<{ InvoiceID: number }, InvoiceGetResponse>(
          'Invoice_Get',
          { InvoiceID: args.invoiceId as number }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.InvoiceDetails, null, 2),
            },
          ],
        };
      }

      case 'quickfile_invoice_create': {
        const lineItems = args.lines as Array<{
          description: string;
          unitCost: number;
          quantity: number;
          vatPercentage?: number;
          nominalCode?: string;
        }>;

        const invoiceLines: InvoiceLine[] = lineItems.map((line) => ({
          ItemID: 0,
          ItemDescription: line.description,
          UnitCost: line.unitCost,
          Qty: line.quantity,
          NominalCode: line.nominalCode,
          Tax1: {
            TaxName: 'VAT',
            TaxPercentage: line.vatPercentage ?? 20,
          },
        }));

        const createParams: InvoiceCreateParams = {
          InvoiceType: args.invoiceType as InvoiceType,
          ClientID: args.clientId as number,
          Currency: (args.currency as string) ?? 'GBP',
          TermDays: (args.termDays as number) ?? 30,
          IssueDate: args.issueDate as string | undefined,
          PONumber: args.poNumber as string | undefined,
          Notes: args.notes as string | undefined,
          InvoiceLines: invoiceLines,
        };

        const cleanParams = Object.fromEntries(
          Object.entries(createParams).filter(([, v]) => v !== undefined)
        );

        const response = await client.request<{ InvoiceData: typeof cleanParams }, InvoiceCreateResponse>(
          'Invoice_Create',
          { InvoiceData: cleanParams }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  invoiceId: response.InvoiceID,
                  invoiceNumber: response.InvoiceNumber,
                  message: `${args.invoiceType} #${response.InvoiceNumber} created successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_invoice_delete': {
        await client.request<{ InvoiceID: number }, Record<string, never>>(
          'Invoice_Delete',
          { InvoiceID: args.invoiceId as number }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  invoiceId: args.invoiceId,
                  message: `Invoice #${args.invoiceId} deleted successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_invoice_send': {
        const sendParams: Record<string, unknown> = {
          InvoiceID: args.invoiceId as number,
        };

        if (args.emailTo) sendParams.EmailTo = args.emailTo;
        if (args.emailSubject) sendParams.EmailSubject = args.emailSubject;
        if (args.emailBody) sendParams.EmailBody = args.emailBody;
        sendParams.AttachPDF = args.attachPdf ?? true;

        await client.request<typeof sendParams, Record<string, never>>(
          'Invoice_Send',
          sendParams
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  invoiceId: args.invoiceId,
                  message: `Invoice #${args.invoiceId} sent successfully`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_invoice_get_pdf': {
        const response = await client.request<{ InvoiceID: number }, InvoicePdfResponse>(
          'Invoice_GetPDF',
          { InvoiceID: args.invoiceId as number }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  invoiceId: args.invoiceId,
                  pdfUrl: response.PDFUri,
                  message: 'PDF URL generated (valid for limited time)',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_estimate_accept_decline': {
        await client.request<{ InvoiceID: number; Action: string }, Record<string, never>>(
          'Estimate_AcceptDecline',
          {
            InvoiceID: args.invoiceId as number,
            Action: args.action as string,
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  estimateId: args.invoiceId,
                  action: args.action,
                  message: `Estimate #${args.invoiceId} ${(args.action as string).toLowerCase()}ed`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_estimate_convert_to_invoice': {
        const response = await client.request<{ EstimateID: number }, EstimateConvertResponse>(
          'Estimate_ConvertToInvoice',
          { EstimateID: args.estimateId as number }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  estimateId: args.estimateId,
                  invoiceId: response.InvoiceID,
                  invoiceNumber: response.InvoiceNumber,
                  message: `Estimate converted to Invoice #${response.InvoiceNumber}`,
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
          content: [{ type: 'text', text: `Unknown invoice tool: ${toolName}` }],
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

/** QuickFile REST invoice tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  cleanParams,
  dateRangeSearchProperties,
  errorResult,
  handleToolError,
  lineItemSchemaProperties,
  resolveVatPercentage,
  successResult,
  type LineItemInput,
  type ToolResult,
} from "./utils.js";

const invoiceIdProperty = { invoiceId: { type: "number" as const } };

export const invoiceTools: Tool[] = [
  {
    name: "quickfile_invoice_search",
    description:
      "Search invoices, estimates, or recurring invoices. Credit notes are not a searchable type (the legacy CREDIT filter returns HTTP 400).",
    inputSchema: {
      type: "object",
      properties: {
        invoiceType: {
          type: "string",
          enum: ["INVOICE", "ESTIMATE", "RECURRING"],
        },
        clientId: { type: "number" },
        ...dateRangeSearchProperties,
        status: { type: "string" },
        searchKeyword: { type: "string" },
        orderBy: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "quickfile_invoice_get",
    description: "Get an invoice and its line items",
    inputSchema: {
      type: "object",
      properties: invoiceIdProperty,
      required: ["invoiceId"],
    },
  },
  {
    name: "quickfile_invoice_create",
    description:
      "Create an invoice or estimate. For credit notes use quickfile_credit_note_create.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceType: {
          type: "string",
          enum: ["INVOICE", "ESTIMATE"],
        },
        clientId: { type: "number" },
        currency: { type: "string", default: "GBP" },
        termDays: { type: "number", default: 30 },
        issueDate: { type: "string" },
        poNumber: { type: "string" },
        notes: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ...lineItemSchemaProperties,
              nominalCode: { type: "string" },
            },
            required: ["description", "unitCost", "quantity"],
          },
        },
      },
      required: ["invoiceType", "clientId", "lines"],
    },
  },
  {
    name: "quickfile_credit_note_create",
    description:
      "Create a credit note via REST v2 POST /invoices with credit_note, then read it back. 'void' writes off an unpaid balance and 'hold' leaves credit on account (both need invoiceId); 'refund' returns money from a bank nominal (needs nominalCode).",
    inputSchema: {
      type: "object",
      properties: {
        creditType: { type: "string", enum: ["void", "refund", "hold"] },
        invoiceId: { type: "number" },
        nominalCode: {
          type: "number",
          description: "Bank nominal (1200-1299) to refund from; refund only",
        },
        clientId: { type: "number" },
        currency: { type: "string", default: "GBP" },
        issueDate: { type: "string" },
        notes: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              ...lineItemSchemaProperties,
              nominalCode: { type: "string" },
            },
            required: ["description", "unitCost", "quantity"],
          },
        },
      },
      required: ["creditType", "clientId", "lines"],
    },
  },
  {
    name: "quickfile_invoice_delete",
    description: "Delete an invoice (destructive; confirmation required)",
    inputSchema: {
      type: "object",
      properties: invoiceIdProperty,
      required: ["invoiceId"],
    },
  },
  {
    name: "quickfile_invoice_send",
    description: "Send an invoice by email using its QuickFile client contact",
    inputSchema: {
      type: "object",
      properties: {
        ...invoiceIdProperty,
        clientContactId: { type: "number" },
      },
      required: ["invoiceId"],
    },
  },
  {
    name: "quickfile_invoice_get_pdf",
    description: "Get a time-limited invoice PDF URL",
    inputSchema: {
      type: "object",
      properties: invoiceIdProperty,
      required: ["invoiceId"],
    },
  },
];

interface PagingResponse<T> {
  count: number;
  data: T[];
}

interface InvoiceResponse {
  id: number;
  invoice_number?: string;
}

interface PdfResponse {
  id: number;
  uri: string;
}

function mapStatus(status: unknown): string | undefined {
  if (!status) {
    return undefined;
  }
  const statuses: Record<string, string> = {
    DRAFT: "draft",
    SENT: "sent",
    VIEWED: "sent",
    PAID: "paidfull",
    PART_PAID: "paidpart",
    OVERDUE: "aged",
    CANCELLED: "deleted",
  };
  return statuses[String(status)] ?? String(status).toLowerCase();
}

function buildItemLines(
  args: Record<string, unknown>,
  client: ReturnType<typeof getApiClient>,
): Array<Record<string, unknown>> {
  return (args.lines as LineItemInput[]).map((line) => ({
    description: line.description,
    nominal_code: line.nominalCode
      ? Number.parseInt(line.nominalCode, 10)
      : undefined,
    vat_rate: resolveVatPercentage(
      line.vatPercentage,
      client.getBusinessProfile(),
    ),
    unit_cost: line.unitCost,
    qty: line.quantity,
  }));
}

export function createCreditNoteBody(
  args: Record<string, unknown>,
  client: ReturnType<typeof getApiClient>,
): Record<string, unknown> {
  const creditType = String(args.creditType);
  if (creditType === "refund" && !args.nominalCode) {
    throw new Error("nominalCode (bank nominal) is required for a refund credit note");
  }
  if (creditType !== "refund" && !args.invoiceId) {
    throw new Error(`invoiceId is required for a ${creditType} credit note`);
  }
  return cleanParams({
    type: "invoice",
    client_id: args.clientId,
    currency: args.currency ?? "GBP",
    issue_date: args.issueDate,
    notes: args.notes,
    item_lines: buildItemLines(args, client),
    credit_note: cleanParams({
      type: creditType,
      invoice_id: args.invoiceId,
      nominal_code: args.nominalCode,
    }),
  });
}

function createInvoiceBody(
  args: Record<string, unknown>,
  client: ReturnType<typeof getApiClient>,
): Record<string, unknown> {
  const lines = buildItemLines(args, client);
  return cleanParams({
    type: String(args.invoiceType).toLowerCase(),
    client_id: args.clientId,
    currency: args.currency ?? "GBP",
    term_days: args.termDays ?? 30,
    issue_date: args.issueDate,
    purchase_reference: args.poNumber,
    notes: args.notes,
    item_lines: lines,
  });
}

export async function handleInvoiceTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = getApiClient(args.account as string);
  try {
    switch (toolName) {
      case "quickfile_invoice_search": {
        const response = await client.request<PagingResponse<unknown>>("/invoices", {
          query: cleanParams({
            type: args.invoiceType
              ? String(args.invoiceType).toLowerCase()
              : undefined,
            client_id: args.clientId,
            date_from: args.dateFrom,
            date_to: args.dateTo,
            status: mapStatus(args.status),
            invoice_number: args.searchKeyword,
            order_column: args.orderBy ?? "issue_date",
            order_direction: String(args.orderDirection ?? "DESC").toLowerCase(),
            offset: args.offset ?? 0,
            limit: args.returnCount ?? 25,
          }),
        });
        return successResult({
          totalRecords: response.count,
          count: response.data.length,
          invoices: response.data,
        });
      }
      case "quickfile_invoice_get":
        return successResult(await client.request(`/invoices/${args.invoiceId}`));
      case "quickfile_invoice_create": {
        const response = await client.request<InvoiceResponse>("/invoices", {
          method: "POST",
          body: createInvoiceBody(args, client),
        });
        return successResult({
          success: true,
          invoiceId: response.id,
          invoiceNumber: response.invoice_number,
        });
      }
      case "quickfile_credit_note_create": {
        const response = await client.request<InvoiceResponse>("/invoices", {
          method: "POST",
          body: createCreditNoteBody(args, client),
        });
        const creditNote = await client.request(`/invoices/${response.id}`);
        return successResult({
          success: true,
          account: args.account,
          creditNoteId: response.id,
          creditNote,
        });
      }
      case "quickfile_invoice_delete":
        await client.request(`/invoices/${args.invoiceId}`, {
          method: "DELETE",
          body: { delete_associated_payments: false },
        });
        return successResult({ success: true, invoiceId: args.invoiceId });
      case "quickfile_invoice_send": {
        const response = await client.request<{ success: boolean }>(
          "/invoices/send",
          {
            method: "POST",
            body: [
              cleanParams({
                invoice_id: args.invoiceId,
                by_email: true,
                by_snail_mail: false,
                client_contact_id: args.clientContactId,
              }),
            ],
          },
        );
        return response.success
          ? successResult({ success: true, invoiceId: args.invoiceId })
          : errorResult(`QuickFile did not send invoice #${args.invoiceId}`);
      }
      case "quickfile_invoice_get_pdf": {
        const response = await client.request<PdfResponse>(
          `/invoices/${args.invoiceId}/get-pdf`,
        );
        return successResult({ invoiceId: response.id, pdfUrl: response.uri });
      }
      default:
        return errorResult(`Unknown invoice tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

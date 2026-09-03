/**
 * QuickFile MCP Tools Index
 * Aggregates all tool definitions and handlers
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { listConfiguredAccounts } from "../api/auth.js";

// Import tool definitions
import { systemTools, handleSystemTool } from "./system.js";
import { clientTools, handleClientTool } from "./client.js";
import { invoiceTools, handleInvoiceTool } from "./invoice.js";
import { purchaseTools, handlePurchaseTool } from "./purchase.js";
import { supplierTools, handleSupplierTool } from "./supplier.js";
import { bankTools, handleBankTool } from "./bank.js";
import { reportTools, handleReportTool } from "./report.js";
import { documentTools, handleDocumentTool } from "./document.js";
import {
  handleRestTool,
  isRestDestructiveTool,
  isRestReadOnlyTool,
  restTools,
} from "./rest.js";

// Import local utilities, then re-export the public utility surface.
import { errorResult, type ToolResult } from "./utils.js";
import { validateToolInput, type JsonInputSchema } from "./validation.js";

// Re-export utility types and functions using export...from syntax
export type { ToolResult } from "./utils.js";
export {
  handleToolError,
  successResult,
  errorResult,
  logger,
  cleanParams,
} from "./utils.js";

// Aggregate all tools
const baseTools: Tool[] = [
  ...systemTools,
  ...clientTools,
  ...invoiceTools,
  ...purchaseTools,
  ...supplierTools,
  ...bankTools,
  ...reportTools,
  ...documentTools,
  ...restTools,
];

const readOnlyTools = new Set([
  "quickfile_system_get_account",
  "quickfile_system_search_events",
  "quickfile_client_search",
  "quickfile_client_get",
  "quickfile_invoice_search",
  "quickfile_invoice_get",
  "quickfile_invoice_get_pdf",
  "quickfile_purchase_search",
  "quickfile_purchase_get",
  "quickfile_supplier_search",
  "quickfile_supplier_get",
  "quickfile_bank_get_accounts",
  "quickfile_bank_get_balances",
  "quickfile_bank_search",
  "quickfile_report_profit_loss",
  "quickfile_report_balance_sheet",
  "quickfile_report_vat_obligations",
  "quickfile_report_ageing",
  "quickfile_report_chart_of_accounts",
  "quickfile_report_subscriptions",
]);

const destructiveTools = new Set([
  "quickfile_client_delete",
  "quickfile_invoice_delete",
  "quickfile_purchase_delete",
  "quickfile_supplier_delete",
]);

export function requiresConfirmation(toolName: string): boolean {
  return !readOnlyTools.has(toolName) && !isRestReadOnlyTool(toolName);
}

function addAccountSelector(tool: Tool): Tool {
  const configuredAccounts = listConfiguredAccounts();
  const mutating = requiresConfirmation(tool.name);
  return {
    ...tool,
    description:
      `${tool.description}` +
      (mutating && !tool.description?.includes("confirmation required")
        ? " Changes QuickFile data; confirmation is required."
        : "") +
      " Requires an explicit QuickFile account alias.",
    annotations: {
      ...tool.annotations,
      readOnlyHint: !mutating,
      destructiveHint:
        destructiveTools.has(tool.name) || isRestDestructiveTool(tool.name),
      idempotentHint: !mutating,
      openWorldHint: true,
    },
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        account: {
          type: "string",
          ...(configuredAccounts.length > 0
            ? { enum: configuredAccounts }
            : {}),
          description:
            "Configured QuickFile account alias (for example business or personal)",
        },
        ...(mutating
          ? {
              confirmed: {
                type: "boolean" as const,
                const: true,
                description:
                  "Set true only after the user confirms the account, payload, and effect",
              },
            }
          : {}),
        ...(tool.inputSchema.properties ?? {}),
      },
      required: [
        "account",
        ...(mutating ? ["confirmed"] : []),
        ...((tool.inputSchema.required as string[] | undefined) ?? []),
      ],
      additionalProperties: false,
    },
  };
}

export const allTools: Tool[] = baseTools.map(addAccountSelector);

/**
 * Route tool calls to appropriate handler
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = allTools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${toolName}. Available prefixes: quickfile_system_, quickfile_client_, quickfile_invoice_, quickfile_purchase_, quickfile_supplier_, quickfile_bank_, quickfile_report_, quickfile_document_`,
        },
      ],
      isError: true,
    };
  }

  const validationError = validateToolInput(
    args,
    tool.inputSchema as JsonInputSchema,
  );
  if (validationError) {
    return errorResult(`Validation error: ${validationError}`);
  }

  const handlerArgs = { ...args };
  delete handlerArgs.confirmed;

  if (toolName.startsWith("quickfile_rest_")) {
    return handleRestTool(toolName, handlerArgs);
  }

  // System tools
  if (toolName.startsWith("quickfile_system_")) {
    return handleSystemTool(toolName, handlerArgs);
  }

  // Client tools
  if (toolName.startsWith("quickfile_client_")) {
    return handleClientTool(toolName, handlerArgs);
  }

  // Invoice tools (invoice creation also supports estimate and credit types)
  if (toolName.startsWith("quickfile_invoice_")) {
    return handleInvoiceTool(toolName, handlerArgs);
  }

  // Purchase tools
  if (toolName.startsWith("quickfile_purchase_")) {
    return handlePurchaseTool(toolName, handlerArgs);
  }

  // Supplier tools
  if (toolName.startsWith("quickfile_supplier_")) {
    return handleSupplierTool(toolName, handlerArgs);
  }

  // Bank tools
  if (toolName.startsWith("quickfile_bank_")) {
    return handleBankTool(toolName, handlerArgs);
  }

  // Report tools
  if (toolName.startsWith("quickfile_report_")) {
    return handleReportTool(toolName, handlerArgs);
  }

  // Document tools
  if (toolName.startsWith("quickfile_document_")) {
    return handleDocumentTool(toolName, handlerArgs);
  }

  return errorResult(`No handler is registered for tool: ${toolName}`);
}

// Re-export individual handlers for direct use if needed
export {
  systemTools,
  handleSystemTool,
  clientTools,
  handleClientTool,
  invoiceTools,
  handleInvoiceTool,
  purchaseTools,
  handlePurchaseTool,
  supplierTools,
  handleSupplierTool,
  bankTools,
  handleBankTool,
  reportTools,
  handleReportTool,
  documentTools,
  handleDocumentTool,
  restTools,
  handleRestTool,
};

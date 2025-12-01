/**
 * QuickFile MCP Tools Index
 * Aggregates all tool definitions and handlers
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Import tool definitions
import { systemTools, handleSystemTool } from "./system.js";
import { clientTools, handleClientTool } from "./client.js";
import { invoiceTools, handleInvoiceTool } from "./invoice.js";
import { purchaseTools, handlePurchaseTool } from "./purchase.js";
import { supplierTools, handleSupplierTool } from "./supplier.js";
import { bankTools, handleBankTool } from "./bank.js";
import { reportTools, handleReportTool } from "./report.js";

// Import ToolResult for local use, then re-export
import type { ToolResult } from "./utils.js";

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
export const allTools: Tool[] = [
  ...systemTools,
  ...clientTools,
  ...invoiceTools,
  ...purchaseTools,
  ...supplierTools,
  ...bankTools,
  ...reportTools,
];

/**
 * Route tool calls to appropriate handler
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // System tools
  if (toolName.startsWith("quickfile_system_")) {
    return handleSystemTool(toolName, args);
  }

  // Client tools
  if (toolName.startsWith("quickfile_client_")) {
    return handleClientTool(toolName, args);
  }

  // Invoice and estimate tools
  if (
    toolName.startsWith("quickfile_invoice_") ||
    toolName.startsWith("quickfile_estimate_")
  ) {
    return handleInvoiceTool(toolName, args);
  }

  // Purchase tools
  if (toolName.startsWith("quickfile_purchase_")) {
    return handlePurchaseTool(toolName, args);
  }

  // Supplier tools
  if (toolName.startsWith("quickfile_supplier_")) {
    return handleSupplierTool(toolName, args);
  }

  // Bank tools
  if (toolName.startsWith("quickfile_bank_")) {
    return handleBankTool(toolName, args);
  }

  // Report tools
  if (toolName.startsWith("quickfile_report_")) {
    return handleReportTool(toolName, args);
  }

  // Unknown tool
  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${toolName}. Available prefixes: quickfile_system_, quickfile_client_, quickfile_invoice_, quickfile_estimate_, quickfile_purchase_, quickfile_supplier_, quickfile_bank_, quickfile_report_`,
      },
    ],
    isError: true,
  };
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
};

/** QuickFile account and event-log tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  type ToolResult,
} from "./utils.js";

export const capabilityMatrix = {
  supported: [
    "Invoices/estimates: create, get, search, send, PDF, delete",
    "Credit notes: quickfile_credit_note_create (void, refund, hold)",
    "Payments: quickfile_rest_client_payment_post / quickfile_rest_supplier_payment_post (guarded against duplicate bank lines)",
    "Bank: list accounts, balances, search transactions (tagged/untagged), create transaction",
    "Everything else published in REST v2: quickfile_rest_* tools",
  ],
  notSupported: [
    "Edit a payment: delete and re-create it instead",
    "Tag an existing untagged bank line to a payment: web app only (Bank > untagged > tag)",
    "Delete a bank transaction: web app only",
    "Search credit notes via invoice search: CREDIT type returns HTTP 400",
  ],
  notes: [
    "quickfile_rest_invoice_put replaces every line, so all line IDs change after any edit; re-send unchanged lines alongside the edited one.",
    "Payments with a bank nominal_code always create a new bank transaction.",
  ],
};

export const systemTools: Tool[] = [
  {
    name: "quickfile_system_capabilities",
    description:
      "List what this MCP server can and cannot do against QuickFile REST v2 (capability matrix and known limits)",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "quickfile_system_get_account",
    description:
      "Get the connected account's business details, VAT status, year end, and account statistics",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "quickfile_system_search_events",
    description: "Search the QuickFile REST event log",
    inputSchema: {
      type: "object",
      properties: {
        dateFrom: { type: "string", description: "Start date (YYYY-MM-DD)" },
        dateTo: { type: "string", description: "End date (YYYY-MM-DD)" },
        relatedId: { type: "string", description: "Related entity ID" },
        relatedType: { type: "string", description: "Related entity type" },
        userId: { type: "number", description: "QuickFile user ID" },
        returnCount: { type: "number", default: 25 },
        nextToken: { type: "string", description: "Pagination token" },
      },
      required: [],
    },
  },
];

export async function handleSystemTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  if (toolName === "quickfile_system_capabilities") {
    return successResult(capabilityMatrix);
  }
  const client = getApiClient(args.account as string);
  try {
    switch (toolName) {
      case "quickfile_system_get_account":
        return successResult(await client.request("/account/me"));
      case "quickfile_system_search_events": {
        const query = cleanParams({
          date_from: args.dateFrom,
          date_to: args.dateTo,
          reference_id: args.relatedId,
          reference_type: args.relatedType,
          user_id: args.userId,
          page_size: args.returnCount ?? 25,
          next_token: args.nextToken,
        });
        return successResult(
          await client.request("/reports/eventlog", { query }),
        );
      }
      default:
        return errorResult(`Unknown system tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

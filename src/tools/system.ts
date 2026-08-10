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

export const systemTools: Tool[] = [
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

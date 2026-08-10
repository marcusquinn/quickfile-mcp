/** QuickFile REST financial report tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  cleanParams,
  errorResult,
  handleToolError,
  successResult,
  type ToolResult,
} from "./utils.js";

export const reportTools: Tool[] = [
  {
    name: "quickfile_report_profit_loss",
    description: "Get a profit and loss report",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "quickfile_report_balance_sheet",
    description: "Get a balance sheet",
    inputSchema: {
      type: "object",
      properties: { reportDate: { type: "string" } },
      required: ["reportDate"],
    },
  },
  {
    name: "quickfile_report_vat_obligations",
    description: "Get VAT obligations for an HMRC connection",
    inputSchema: {
      type: "object",
      properties: {
        hmrcAccountId: { type: "number" },
        hmrcAccountType: { type: "string", default: "VAT" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
      },
      required: ["hmrcAccountId"],
    },
  },
  {
    name: "quickfile_report_ageing",
    description: "Get debtor or creditor ageing",
    inputSchema: {
      type: "object",
      properties: {
        reportType: { type: "string", enum: ["CREDITOR", "DEBTOR"] },
        returnCount: { type: "number", default: 100 },
        offset: { type: "number", default: 0 },
      },
      required: ["reportType"],
    },
  },
  {
    name: "quickfile_report_chart_of_accounts",
    description: "Get the chart of accounts",
    inputSchema: {
      type: "object",
      properties: {
        nominalCodeStart: { type: "number" },
        nominalCodeEnd: { type: "number" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        excludeZeroBalances: { type: "boolean" },
      },
      required: [],
    },
  },
  {
    name: "quickfile_report_subscriptions",
    description: "Get recurring subscriptions",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

export async function handleReportTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = getApiClient(args.account as string);
  try {
    switch (toolName) {
      case "quickfile_report_profit_loss":
        return successResult(
          await client.request("/reports/profit-and-loss", {
            query: { date_from: args.startDate, date_to: args.endDate },
          }),
        );
      case "quickfile_report_balance_sheet":
        return successResult(
          await client.request("/reports/balance-sheet", {
            query: { date_to: args.reportDate },
          }),
        );
      case "quickfile_report_vat_obligations":
        return successResult(
          await client.request("/reports/vat-obligations", {
            query: cleanParams({
              hmrc_account_id: args.hmrcAccountId,
              hmrc_account_type: args.hmrcAccountType ?? "VAT",
              date_from: args.dateFrom,
              date_to: args.dateTo,
            }),
          }),
        );
      case "quickfile_report_ageing":
        return successResult(
          await client.request("/reports/ageing", {
            query: {
              type: String(args.reportType).toLowerCase(),
              offset: args.offset ?? 0,
              limit: args.returnCount ?? 100,
            },
          }),
        );
      case "quickfile_report_chart_of_accounts":
        return successResult(
          await client.request("/reports/chart-of-accounts", {
            query: cleanParams({
              nominal_code_start: args.nominalCodeStart,
              nominal_code_end: args.nominalCodeEnd,
              date_from: args.dateFrom,
              date_to: args.dateTo,
              exclude_zero_balance_ledgers: args.excludeZeroBalances,
            }),
          }),
        );
      case "quickfile_report_subscriptions":
        return successResult(await client.request("/reports/subscriptions"));
      default:
        return errorResult(`Unknown report tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

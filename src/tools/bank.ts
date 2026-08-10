/** QuickFile REST bank tools. */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  cleanParams,
  errorResult,
  handleToolError,
  successResult,
  type ToolResult,
} from "./utils.js";

export const bankTools: Tool[] = [
  {
    name: "quickfile_bank_get_accounts",
    description: "List bank accounts",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "quickfile_bank_get_balances",
    description: "Get balances for bank account IDs",
    inputSchema: {
      type: "object",
      properties: {
        nominalCodes: {
          type: "array",
          items: { type: "string" },
          description: "Bank account IDs/nominal codes",
        },
      },
      required: ["nominalCodes"],
    },
  },
  {
    name: "quickfile_bank_search",
    description: "Search transactions for a bank account",
    inputSchema: {
      type: "object",
      properties: {
        nominalCode: { type: "string", description: "Bank account ID" },
        dateFrom: { type: "string" },
        dateTo: { type: "string" },
        reference: { type: "string" },
        notes: { type: "string" },
        minAmount: { type: "number" },
        maxAmount: { type: "number" },
        tagged: { type: "boolean" },
        returnCount: { type: "number", default: 50 },
        offset: { type: "number", default: 0 },
        orderBy: { type: "string" },
        orderDirection: { type: "string", enum: ["ASC", "DESC"] },
      },
      required: ["nominalCode"],
    },
  },
  {
    name: "quickfile_bank_create_account",
    description: "Create a bank account",
    inputSchema: {
      type: "object",
      properties: {
        bankId: { type: "number", description: "QuickFile bank-name ID" },
        accountName: { type: "string" },
        accountType: { type: "string" },
        currency: { type: "string", default: "GBP" },
        sortCode: { type: "string" },
        accountNumber: { type: "string" },
        openingBalance: { type: "number", default: 0 },
        openingBalanceDate: { type: "string" },
      },
      required: ["bankId", "accountName", "accountType"],
    },
  },
  {
    name: "quickfile_bank_create_transaction",
    description: "Create an untagged bank transaction",
    inputSchema: {
      type: "object",
      properties: {
        nominalCode: { type: "string", description: "Bank account ID" },
        transactionDate: { type: "string" },
        amount: { type: "number" },
        transactionType: {
          type: "string",
          enum: ["MONEY_IN", "MONEY_OUT"],
        },
        reference: { type: "string" },
        notes: { type: "string" },
      },
      required: ["nominalCode", "transactionDate", "amount", "transactionType"],
    },
  },
];

interface ArrayResponse<T> {
  count: number;
  data: T[];
}

interface BalanceResponse {
  balance: number;
}

export async function handleBankTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const client = getApiClient(args.account as string);
  try {
    switch (toolName) {
      case "quickfile_bank_get_accounts": {
        const response = await client.request<ArrayResponse<unknown>>(
          "/bank_accounts",
        );
        return successResult({ count: response.count, accounts: response.data });
      }
      case "quickfile_bank_get_balances": {
        const balances = [];
        for (const id of args.nominalCodes as string[]) {
          const response = await client.request<BalanceResponse>(
            `/bank_accounts/${id}/balance`,
          );
          balances.push({ accountId: id, balance: response.balance });
        }
        return successResult({ balances });
      }
      case "quickfile_bank_search": {
        const response = await client.request<ArrayResponse<unknown>>(
          `/bank_accounts/${args.nominalCode}/transactions`,
          {
            query: cleanParams({
              date_from: args.dateFrom,
              date_to: args.dateTo,
              reference: args.reference,
              notes: args.notes,
              amount_from: args.minAmount,
              amount_to: args.maxAmount,
              tag_status:
                args.tagged === undefined
                  ? undefined
                  : args.tagged
                    ? "tagged"
                    : "untagged",
              order_column: args.orderBy ?? "date",
              order_direction: String(
                args.orderDirection ?? "DESC",
              ).toLowerCase(),
              offset: args.offset ?? 0,
              limit: args.returnCount ?? 50,
            }),
          },
        );
        return successResult({
          totalRecords: response.count,
          count: response.data.length,
          transactions: response.data,
        });
      }
      case "quickfile_bank_create_account": {
        const response = await client.request("/bank_accounts", {
          method: "POST",
          body: cleanParams({
            bank_name_id: args.bankId,
            type: args.accountType,
            name: args.accountName,
            currency: args.currency ?? "GBP",
            account_number: args.accountNumber,
            sort_code: args.sortCode,
            opening_balance: args.openingBalanceDate
              ? {
                  date: args.openingBalanceDate,
                  amount: args.openingBalance ?? 0,
                }
              : undefined,
          }),
        });
        return successResult({ success: true, bankAccount: response });
      }
      case "quickfile_bank_create_transaction": {
        const magnitude = args.amount as number;
        if (!Number.isFinite(magnitude) || magnitude <= 0) {
          return errorResult("amount must be a positive number");
        }
        const amount = args.transactionType === "MONEY_OUT" ? -magnitude : magnitude;
        const response = await client.request(
          `/bank_accounts/${args.nominalCode}/transactions`,
          {
            method: "POST",
            body: cleanParams({
              date: args.transactionDate,
              amount,
              reference: args.reference ?? "QuickFile MCP transaction",
              notes: args.notes,
              duplicate_check: true,
            }),
          },
        );
        return successResult({ success: true, transaction: response });
      }
      default:
        return errorResult(`Unknown bank tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

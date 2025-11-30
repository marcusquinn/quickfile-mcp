/**
 * QuickFile Bank Tools
 * Bank account and transaction operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient, QuickFileApiError } from '../api/client.js';
import type {
  BankAccount,
  BankTransaction,
  BankTransactionCreateParams,
  BankAccountType,
} from '../types/quickfile.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const bankTools: Tool[] = [
  {
    name: 'quickfile_bank_get_accounts',
    description: 'Get list of all bank accounts grouped by type',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'quickfile_bank_get_balances',
    description: 'Get current balances for specific bank accounts',
    inputSchema: {
      type: 'object',
      properties: {
        nominalCodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of nominal codes to get balances for',
        },
      },
      required: ['nominalCodes'],
    },
  },
  {
    name: 'quickfile_bank_search',
    description: 'Search bank transactions by date range, reference, or amount',
    inputSchema: {
      type: 'object',
      properties: {
        nominalCode: {
          type: 'string',
          description: 'Bank account nominal code (e.g., 1200 for current account)',
        },
        dateFrom: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        dateTo: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        reference: {
          type: 'string',
          description: 'Search by reference',
        },
        minAmount: {
          type: 'number',
          description: 'Minimum amount',
        },
        maxAmount: {
          type: 'number',
          description: 'Maximum amount',
        },
        tagged: {
          type: 'boolean',
          description: 'Filter by tagged status',
        },
        returnCount: {
          type: 'number',
          description: 'Number of results (default: 50)',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Offset for pagination',
          default: 0,
        },
        orderBy: {
          type: 'string',
          enum: ['TransactionDate', 'Amount', 'Reference'],
          description: 'Field to order by',
        },
        orderDirection: {
          type: 'string',
          enum: ['ASC', 'DESC'],
          description: 'Order direction',
        },
      },
      required: ['nominalCode'],
    },
  },
  {
    name: 'quickfile_bank_create_account',
    description: 'Create a new bank account',
    inputSchema: {
      type: 'object',
      properties: {
        accountName: {
          type: 'string',
          description: 'Account name',
        },
        accountType: {
          type: 'string',
          enum: ['CURRENT', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'CASH', 'PAYPAL', 'MERCHANT', 'OTHER'],
          description: 'Type of bank account',
        },
        currency: {
          type: 'string',
          description: 'Currency (default: GBP)',
          default: 'GBP',
        },
        bankName: {
          type: 'string',
          description: 'Bank name',
        },
        sortCode: {
          type: 'string',
          description: 'Sort code (UK)',
        },
        accountNumber: {
          type: 'string',
          description: 'Account number',
        },
        openingBalance: {
          type: 'number',
          description: 'Opening balance',
          default: 0,
        },
      },
      required: ['accountName', 'accountType'],
    },
  },
  {
    name: 'quickfile_bank_create_transaction',
    description: 'Create an untagged bank transaction (money in or money out)',
    inputSchema: {
      type: 'object',
      properties: {
        nominalCode: {
          type: 'string',
          description: 'Bank account nominal code',
        },
        transactionDate: {
          type: 'string',
          description: 'Transaction date (YYYY-MM-DD)',
        },
        amount: {
          type: 'number',
          description: 'Transaction amount (positive value)',
        },
        transactionType: {
          type: 'string',
          enum: ['MONEY_IN', 'MONEY_OUT'],
          description: 'Whether money came in or went out',
        },
        reference: {
          type: 'string',
          description: 'Transaction reference',
        },
        payeePayer: {
          type: 'string',
          description: 'Name of payee or payer',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
      },
      required: ['nominalCode', 'transactionDate', 'amount', 'transactionType'],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface BankAccountsResponse {
  BankAccounts: {
    BankAccount: BankAccount[];
  };
}

interface BankBalancesResponse {
  Balances: Array<{
    NominalCode: string;
    AccountName: string;
    CurrentBalance: number;
  }>;
}

interface BankSearchResponse {
  Transactions: {
    Transaction: BankTransaction[];
  };
  TotalRecords: number;
}

interface BankAccountCreateResponse {
  NominalCode: string;
}

interface BankTransactionCreateResponse {
  TransactionID: number;
}

export async function handleBankTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const client = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_bank_get_accounts': {
        // OrderResultsBy and AccountTypes are required for Bank_GetAccounts
        // Valid OrderResultsBy values: NominalCode, Position
        // Valid AccountTypes: CURRENT, PETTY, BUILDINGSOC, LOAN, MERCHANT, EQUITY, CREDITCARD, RESERVE
        const response = await client.request<
          { SearchParameters: { 
            OrderResultsBy: string;
            AccountTypes: { AccountType: string[] };
          } },
          BankAccountsResponse
        >('Bank_GetAccounts', {
          SearchParameters: {
            OrderResultsBy: 'NominalCode',
            AccountTypes: {
              AccountType: ['CURRENT', 'PETTY', 'BUILDINGSOC', 'LOAN', 'MERCHANT', 'EQUITY', 'CREDITCARD', 'RESERVE'],
            },
          },
        });

        const accounts = response.BankAccounts?.BankAccount || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: accounts.length,
                  accounts: accounts,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_bank_get_balances': {
        const nominalCodes = args.nominalCodes as string[];

        const response = await client.request<
          { NominalCodes: { NominalCode: string[] } },
          BankBalancesResponse
        >('Bank_GetAccountBalances', {
          NominalCodes: { NominalCode: nominalCodes },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  balances: response.Balances,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_bank_search': {
        // Build search parameters - element order matters for QuickFile XML API
        // NominalCode is an int (1200-1299), OrderResultsBy and OrderDirection are REQUIRED
        const searchParams: Record<string, unknown> = {
          ReturnCount: (args.returnCount as number) ?? 50,
          Offset: (args.offset as number) ?? 0,
          OrderResultsBy: (args.orderBy as string) ?? 'TransactionDate',
          OrderDirection: (args.orderDirection as string) ?? 'DESC',
          NominalCode: parseInt(args.nominalCode as string, 10),
        };
        
        if (args.reference) searchParams.Reference = args.reference;
        if (args.dateFrom) searchParams.FromDate = args.dateFrom;
        if (args.dateTo) searchParams.ToDate = args.dateTo;
        if (args.minAmount !== undefined) searchParams.AmountFrom = args.minAmount;
        if (args.maxAmount !== undefined) searchParams.AmountTo = args.maxAmount;

        const response = await client.request<
          { SearchParameters: typeof searchParams },
          BankSearchResponse
        >('Bank_Search', { SearchParameters: searchParams });

        const transactions = response.Transactions?.Transaction || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalRecords: response.TotalRecords,
                  count: transactions.length,
                  transactions: transactions,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_bank_create_account': {
        const accountData: Record<string, unknown> = {
          AccountName: args.accountName as string,
          AccountType: args.accountType as BankAccountType,
          Currency: (args.currency as string) ?? 'GBP',
        };

        if (args.bankName) accountData.BankName = args.bankName;
        if (args.sortCode) accountData.SortCode = args.sortCode;
        if (args.accountNumber) accountData.AccountNumber = args.accountNumber;
        if (args.openingBalance !== undefined) {
          accountData.OpeningBalance = args.openingBalance;
        }

        const response = await client.request<
          { BankAccountData: typeof accountData },
          BankAccountCreateResponse
        >('Bank_CreateAccount', { BankAccountData: accountData });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  nominalCode: response.NominalCode,
                  message: `Bank account "${args.accountName}" created with nominal code ${response.NominalCode}`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_bank_create_transaction': {
        const txnParams: BankTransactionCreateParams = {
          NominalCode: args.nominalCode as string,
          TransactionDate: args.transactionDate as string,
          Amount: args.amount as number,
          TransactionType: args.transactionType as 'MONEY_IN' | 'MONEY_OUT',
          Reference: args.reference as string | undefined,
          PayeePayer: args.payeePayer as string | undefined,
          Notes: args.notes as string | undefined,
        };

        const cleanParams = Object.fromEntries(
          Object.entries(txnParams).filter(([, v]) => v !== undefined)
        );

        const response = await client.request<
          { TransactionData: typeof cleanParams },
          BankTransactionCreateResponse
        >('Bank_CreateTransaction', { TransactionData: cleanParams });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  transactionId: response.TransactionID,
                  message: `Bank transaction created with ID ${response.TransactionID}`,
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
          content: [{ type: 'text', text: `Unknown bank tool: ${toolName}` }],
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

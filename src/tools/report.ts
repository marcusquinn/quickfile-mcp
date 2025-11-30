/**
 * QuickFile Report Tools
 * Financial reporting operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient, QuickFileApiError } from '../api/client.js';
import type {
  ProfitAndLossReport,
  BalanceSheetReport,
  VatObligation,
  AgeingReport,
  ChartOfAccountsEntry,
} from '../types/quickfile.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const reportTools: Tool[] = [
  {
    name: 'quickfile_report_profit_loss',
    description: 'Get Profit and Loss report for a date range',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'quickfile_report_balance_sheet',
    description: 'Get Balance Sheet report as at a specific date',
    inputSchema: {
      type: 'object',
      properties: {
        reportDate: {
          type: 'string',
          description: 'Report date (YYYY-MM-DD)',
        },
      },
      required: ['reportDate'],
    },
  },
  {
    name: 'quickfile_report_vat_obligations',
    description: 'Get list of VAT obligations (filed and open returns)',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['O', 'F', 'ALL'],
          description: 'Filter by status: O=Open, F=Filed, ALL=All',
          default: 'ALL',
        },
      },
      required: [],
    },
  },
  {
    name: 'quickfile_report_ageing',
    description: 'Get debtor or creditor ageing report',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: ['CREDITOR', 'DEBTOR'],
          description: 'Creditor (what you owe) or Debtor (what is owed to you)',
        },
        asAtDate: {
          type: 'string',
          description: 'Report as at date (YYYY-MM-DD, default: today)',
        },
      },
      required: ['reportType'],
    },
  },
  {
    name: 'quickfile_report_chart_of_accounts',
    description: 'Get the chart of accounts (nominal codes)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'quickfile_report_subscriptions',
    description: 'Get list of recurring subscriptions',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface ProfitLossResponse {
  Report: ProfitAndLossReport;
}

interface BalanceSheetResponse {
  Report: BalanceSheetReport;
}

interface VatObligationsResponse {
  Obligations: {
    Obligation: VatObligation[];
  };
}

interface AgeingReportResponse {
  Report: AgeingReport;
}

interface ChartOfAccountsResponse {
  NominalCodes: {
    NominalCode: ChartOfAccountsEntry[];
  };
}

interface Subscription {
  SubscriptionID: number;
  Description: string;
  ClientID?: number;
  ClientName?: string;
  SupplierID?: number;
  SupplierName?: string;
  Amount: number;
  Frequency: string;
  NextDate: string;
  Status: string;
}

interface SubscriptionsResponse {
  Subscriptions: {
    Subscription: Subscription[];
  };
}

export async function handleReportTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const client = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_report_profit_loss': {
        // SearchParameters wrapper with FromDate/ToDate (not StartDate/EndDate)
        const searchParams: Record<string, unknown> = {};
        if (args.startDate) searchParams.FromDate = args.startDate;
        if (args.endDate) searchParams.ToDate = args.endDate;

        const response = await client.request<
          { SearchParameters: typeof searchParams },
          ProfitLossResponse
        >('Report_ProfitAndLoss', {
          SearchParameters: searchParams,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.Report, null, 2),
            },
          ],
        };
      }

      case 'quickfile_report_balance_sheet': {
        // SearchParameters wrapper with ToDate
        const searchParams: Record<string, unknown> = {};
        if (args.reportDate) searchParams.ToDate = args.reportDate;

        const response = await client.request<
          { SearchParameters: typeof searchParams },
          BalanceSheetResponse
        >('Report_BalanceSheet', {
          SearchParameters: searchParams,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.Report, null, 2),
            },
          ],
        };
      }

      case 'quickfile_report_vat_obligations': {
        const status = (args.status as string) ?? 'ALL';
        const params: Record<string, unknown> = {};
        
        if (status !== 'ALL') {
          params.Status = status;
        }

        const response = await client.request<typeof params, VatObligationsResponse>(
          'Report_VatObligations',
          params
        );

        const obligations = response.Obligations?.Obligation || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: obligations.length,
                  obligations: obligations,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_report_ageing': {
        const reportDate = (args.asAtDate as string) ?? new Date().toISOString().split('T')[0];

        const response = await client.request<
          { ReportType: string; AsAtDate: string },
          AgeingReportResponse
        >('Report_Ageing', {
          ReportType: args.reportType as string,
          AsAtDate: reportDate,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.Report, null, 2),
            },
          ],
        };
      }

      case 'quickfile_report_chart_of_accounts': {
        const response = await client.request<Record<string, never>, ChartOfAccountsResponse>(
          'Report_ChartOfAccounts',
          {}
        );

        const accounts = response.NominalCodes?.NominalCode || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: accounts.length,
                  nominalCodes: accounts,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'quickfile_report_subscriptions': {
        const response = await client.request<Record<string, never>, SubscriptionsResponse>(
          'Report_Subscriptions',
          {}
        );

        const subscriptions = response.Subscriptions?.Subscription || [];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: subscriptions.length,
                  subscriptions: subscriptions,
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
          content: [{ type: 'text', text: `Unknown report tool: ${toolName}` }],
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

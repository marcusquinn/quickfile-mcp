/**
 * QuickFile Report Tools
 * Financial reporting operations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getApiClient } from '../api/client.js';
import type {
  ProfitAndLossReport,
  BalanceSheetReport,
  VatObligation,
  AgeingReport,
  ChartOfAccountsEntry,
} from '../types/quickfile.js';
import { handleToolError, successResult, type ToolResult } from './utils.js';

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
  Nominals: {
    Nominal: ChartOfAccountsEntry[];
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
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case 'quickfile_report_profit_loss': {
        // SearchParameters wrapper with FromDate/ToDate (not StartDate/EndDate)
        const searchParams: Record<string, unknown> = {};
        if (args.startDate) { searchParams.FromDate = args.startDate; }
        if (args.endDate) { searchParams.ToDate = args.endDate; }

        const response = await apiClient.request<
          { SearchParameters: typeof searchParams },
          ProfitLossResponse
        >('Report_ProfitAndLoss', {
          SearchParameters: searchParams,
        });

        return successResult(response.Report);
      }

      case 'quickfile_report_balance_sheet': {
        // SearchParameters wrapper with ToDate
        const searchParams: Record<string, unknown> = {};
        if (args.reportDate) { searchParams.ToDate = args.reportDate; }

        const response = await apiClient.request<
          { SearchParameters: typeof searchParams },
          BalanceSheetResponse
        >('Report_BalanceSheet', {
          SearchParameters: searchParams,
        });

        return successResult(response.Report);
      }

      case 'quickfile_report_vat_obligations': {
        // VAT Obligations is only available for VAT-registered accounts using MTD
        // This endpoint requires OrganisationId and AccountType for MTD VAT
        // For non-VAT registered accounts, return an informative message
        try {
          const today = new Date();
          const fiveYearsAgo = new Date(today.getFullYear() - 5, 0, 1);
          
          const searchParams: Record<string, unknown> = {
            FromDate: fiveYearsAgo.toISOString().split('T')[0],
            ToDate: today.toISOString().split('T')[0],
            AccountType: 'VAT', // Required for MTD
          };

          const response = await apiClient.request<
            { SearchParameters: typeof searchParams },
            VatObligationsResponse
          >('Report_VatObligations', { SearchParameters: searchParams });

          const obligations = response.Obligations?.Obligation || [];
          return successResult({
            count: obligations.length,
            obligations: obligations,
          });
        } catch (error) {
          // If the account is not VAT registered or MTD not set up, return helpful message
          return successResult({
            count: 0,
            obligations: [],
            message: 'VAT obligations not available. This account may not be VAT registered or MTD VAT may not be configured.',
          });
        }
      }

      case 'quickfile_report_ageing': {
        const reportDate = (args.asAtDate as string) ?? new Date().toISOString().split('T')[0];

        const response = await apiClient.request<
          { ReportType: string; AsAtDate: string },
          AgeingReportResponse
        >('Report_Ageing', {
          ReportType: args.reportType as string,
          AsAtDate: reportDate,
        });

        return successResult(response.Report);
      }

      case 'quickfile_report_chart_of_accounts': {
        const response = await apiClient.request<Record<string, never>, ChartOfAccountsResponse>(
          'Ledger_GetNominalLedgers',
          {}
        );

        const accounts = response.Nominals?.Nominal || [];
        return successResult({
          count: accounts.length,
          nominalCodes: accounts,
        });
      }

      case 'quickfile_report_subscriptions': {
        // Report_Subscriptions doesn't accept a Body element
        const response = await apiClient.request<Record<string, never>, SubscriptionsResponse>(
          'Report_Subscriptions',
          {},
          { noBody: true }
        );

        const subscriptions = response.Subscriptions?.Subscription || [];
        return successResult({
          count: subscriptions.length,
          subscriptions: subscriptions,
        });
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown report tool: ${toolName}` }],
          isError: true,
        };
    }
  } catch (error) {
    return handleToolError(error);
  }
}

/**
 * Unit tests for Report API bug fix
 *
 * This test verifies that the P&L and Balance Sheet reports correctly
 * handle the QuickFile API response structure (Totals/Breakdown directly,
 * not wrapped in a Report field).
 */

import { handleReportTool } from '../../src/tools/report';

// Mock the API client
jest.mock('../../src/api/client', () => ({
  getApiClient: () => ({
    request: async (method: string) => {
      if (method === 'Report_ProfitAndLoss') {
        // Return the actual API response structure
        return {
          Totals: {
            Turnover: 45541.10,
            LessCostofSales: -1635.93,
            LessExpenses: -18842.37,
            NetProfit: 25062.80,
          },
          Breakdown: {
            Turnover: {
              Balances: {
                Balance: [
                  {
                    NominalCode: 4000,
                    NominalAccountName: 'General Sales',
                    Amount: 45541.10,
                  },
                ],
              },
            },
            LessCostofSales: {
              Balances: {
                Balance: [
                  {
                    NominalCode: 5000,
                    NominalAccountName: 'General Purchases',
                    Amount: -1635.93,
                  },
                ],
              },
            },
            LessExpenses: {
              Balances: {
                Balance: [],
              },
            },
          },
        };
      }

      if (method === 'Report_BalanceSheet') {
        return {
          Totals: {
            FixedAssets: 4974.59,
            CurrentAssets: 140999.62,
            CurrentLiabilities: 706.73,
            LongTermLiabilities: 0,
            CapitalAndReserves: 145267.48,
          },
          Breakdown: {
            FixedAssets: { Balances: { Balance: [] } },
            CurrentAssets: { Balances: { Balance: [] } },
            CurrentLiabilities: { Balances: { Balance: [] } },
            LongTermLiabilities: null,
            CapitalAndReserves: { Balances: { Balance: [] } },
          },
        };
      }

      return {};
    },
  }),
}));

describe('Report Tools - Bug Fix Verification', () => {
  it('should handle P&L report response without Report field wrapper', async () => {
    const result = await handleReportTool('quickfile_report_profit_loss', {
      startDate: '2024-04-06',
      endDate: '2025-04-05',
    });

    // Should not error
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    // Should have valid JSON string (not undefined)
    expect(result.content[0].text).toBeDefined();
    expect(typeof result.content[0].text).toBe('string');

    // Parse and verify structure
    const data = JSON.parse(result.content[0].text);
    expect(data.Totals).toBeDefined();
    expect(data.Totals.NetProfit).toBe(25062.80);
    expect(data.Breakdown).toBeDefined();
  });

  it('should handle Balance Sheet report response without Report field wrapper', async () => {
    const result = await handleReportTool('quickfile_report_balance_sheet', {
      reportDate: '2026-01-27',
    });

    // Should not error
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    // Should have valid JSON string (not undefined)
    expect(result.content[0].text).toBeDefined();
    expect(typeof result.content[0].text).toBe('string');

    // Parse and verify structure
    const data = JSON.parse(result.content[0].text);
    expect(data.Totals).toBeDefined();
    expect(data.Totals.CapitalAndReserves).toBe(145267.48);
    expect(data.Breakdown).toBeDefined();
  });
});

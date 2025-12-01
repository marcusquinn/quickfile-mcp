/**
 * Integration tests for QuickFile API
 * 
 * These tests make REAL API calls to QuickFile.
 * They use TestMode where supported to avoid affecting live data.
 * 
 * Prerequisites:
 * - Valid credentials in ~/.config/.quickfile-mcp/credentials.json
 * - Network access to api.quickfile.co.uk
 * 
 * Run with: npm run test:integration
 */

import { QuickFileApiClient, QuickFileApiError } from '../../src/api/client';
import { loadCredentials, validateCredentialsFormat } from '../../src/api/auth';

// Increase timeout for API calls
jest.setTimeout(30000);

describe('QuickFile API Integration Tests', () => {
  let client: QuickFileApiClient;

  beforeAll(() => {
    // Verify credentials exist and are valid format
    const credentials = loadCredentials();
    if (!validateCredentialsFormat(credentials)) {
      throw new Error('Invalid credential format - check ~/.config/.quickfile-mcp/credentials.json');
    }
    
    // Create client in test mode
    client = new QuickFileApiClient({ testMode: true });
  });

  describe('Connection & Authentication', () => {
    it('should load credentials successfully', () => {
      const credentials = loadCredentials();
      expect(credentials.accountNumber).toBeDefined();
      expect(credentials.apiKey).toBeDefined();
      expect(credentials.applicationId).toBeDefined();
    });

    it('should have valid credential format', () => {
      const credentials = loadCredentials();
      expect(validateCredentialsFormat(credentials)).toBe(true);
    });

    it('should create API client', () => {
      expect(client).toBeInstanceOf(QuickFileApiClient);
      expect(client.getAccountNumber()).toBeDefined();
    });
  });

  describe('System API', () => {
    it('should get account details', async () => {
      const response = await client.request<
        { AccountDetails: { AccountNumber: string; ReturnVariables: { Variable: string[] } } },
        { AccountDetails: Record<string, unknown> }
      >('System_GetAccountDetails', {
        AccountDetails: {
          AccountNumber: client.getAccountNumber(),
          ReturnVariables: {
            Variable: ['CompanyName', 'BaseCurrency', 'VatRegNumber'],
          },
        },
      });

      expect(response).toBeDefined();
      expect(response.AccountDetails).toBeDefined();
    });
  });

  describe('Client API', () => {
    it('should search clients', async () => {
      const response = await client.request<
        { SearchParameters: Record<string, unknown> },
        { RecordsetCount: number; ReturnCount: number; Record: unknown[] }
      >('Client_Search', {
        SearchParameters: {
          ReturnCount: 5,
          Offset: 0,
          OrderResultsBy: 'CompanyName',
          OrderDirection: 'ASC',
        },
      });

      expect(response).toBeDefined();
      expect(typeof response.RecordsetCount).toBe('number');
      expect(typeof response.ReturnCount).toBe('number');
      expect(Array.isArray(response.Record)).toBe(true);
    });

    it('should handle client search with filters', async () => {
      const response = await client.request<
        { SearchParameters: Record<string, unknown> },
        { RecordsetCount: number; Record: unknown[] }
      >('Client_Search', {
        SearchParameters: {
          ReturnCount: 10,
          Offset: 0,
          OrderResultsBy: 'CompanyName',  // DateCreated may not be valid
          OrderDirection: 'DESC',
        },
      });

      expect(response).toBeDefined();
      expect(response.RecordsetCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Invoice API', () => {
    it('should search invoices', async () => {
      const response = await client.request<
        { SearchParameters: Record<string, unknown> },
        { RecordsetCount?: number; Invoices?: { Invoice: unknown[] } }
      >('Invoice_Search', {
        SearchParameters: {
          InvoiceType: 'INVOICE',
          ReturnCount: 5,
          Offset: 0,
          OrderResultsBy: 'InvoiceNumber',
          OrderDirection: 'DESC',
        },
      });

      expect(response).toBeDefined();
      // API may return RecordsetCount or embed count differently
      expect(response.Invoices !== undefined || response.RecordsetCount !== undefined).toBe(true);
    });

    it('should search estimates', async () => {
      const response = await client.request<
        { SearchParameters: Record<string, unknown> },
        { RecordsetCount?: number; Invoices?: { Invoice: unknown[] } }
      >('Invoice_Search', {
        SearchParameters: {
          InvoiceType: 'ESTIMATE',
          ReturnCount: 5,
          Offset: 0,
          OrderResultsBy: 'InvoiceNumber',
          OrderDirection: 'DESC',
        },
      });

      expect(response).toBeDefined();
    });
  });

  describe('Purchase API', () => {
    it('should search purchases', async () => {
      const response = await client.request<
        { SearchParameters: Record<string, unknown> },
        { RecordsetCount?: number; Purchases?: { Purchase: unknown[] } }
      >('Purchase_Search', {
        SearchParameters: {
          ReturnCount: 5,
          Offset: 0,
          OrderResultsBy: 'ReceiptDate',
          OrderDirection: 'DESC',
        },
      });

      expect(response).toBeDefined();
    });
  });

  describe('Supplier API', () => {
    it('should search suppliers', async () => {
      const response = await client.request<
        { SearchParameters: Record<string, unknown> },
        { RecordsetCount?: number; Suppliers?: { Supplier: unknown[] } }
      >('Supplier_Search', {
        SearchParameters: {
          ReturnCount: 5,
          Offset: 0,
          OrderResultsBy: 'CompanyName',
          OrderDirection: 'ASC',
        },
      });

      expect(response).toBeDefined();
    });
  });

  describe('Bank API', () => {
    it('should get bank accounts', async () => {
      const response = await client.request<
        { SearchParameters: { OrderResultsBy: string; AccountTypes: { AccountType: string[] } } },
        { BankAccounts?: { BankAccount: unknown[] } }
      >('Bank_GetAccounts', {
        SearchParameters: {
          OrderResultsBy: 'NominalCode',
          AccountTypes: {
            AccountType: ['CURRENT', 'PETTY', 'BUILDINGSOC', 'CREDITCARD'],
          },
        },
      });

      expect(response).toBeDefined();
    });
  });

  describe('Report API', () => {
    it('should get chart of accounts', async () => {
      const response = await client.request<
        Record<string, never>,
        { NominalCodes?: { NominalCode: unknown[] } }
      >('Report_ChartOfAccounts', {});

      expect(response).toBeDefined();
    });

    it('should get profit and loss report', async () => {
      // Use last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await client.request<
        { SearchParameters: { FromDate: string; ToDate: string } },
        { Report?: Record<string, unknown> }
      >('Report_ProfitAndLoss', {
        SearchParameters: {
          FromDate: startDate,
          ToDate: endDate,
        },
      });

      expect(response).toBeDefined();
    });

    it('should get balance sheet report', async () => {
      const reportDate = new Date().toISOString().split('T')[0];

      const response = await client.request<
        { SearchParameters: { ToDate: string } },
        { Report?: Record<string, unknown> }
      >('Report_BalanceSheet', {
        SearchParameters: {
          ToDate: reportDate,
        },
      });

      expect(response).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid client ID gracefully', async () => {
      await expect(
        client.request<{ ClientID: number }, unknown>('Client_Get', {
          ClientID: 999999999,
        })
      ).rejects.toThrow(QuickFileApiError);
    });

    it('should handle invalid invoice ID gracefully', async () => {
      await expect(
        client.request<{ InvoiceID: number }, unknown>('Invoice_Get', {
          InvoiceID: 999999999,
        })
      ).rejects.toThrow(QuickFileApiError);
    });
  });
});

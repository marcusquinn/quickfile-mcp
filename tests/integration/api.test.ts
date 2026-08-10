/**
 * Read-only integration tests for the QuickFile beta REST API.
 *
 * Inject one or more QUICKFILE_<ACCOUNT>_API_KEY bearer tokens, then run:
 * npm run test:integration
 */

import { QuickFileApiClient } from "../../src/api/client";
import {
  listConfiguredAccounts,
  loadCredentials,
  validateCredentialsFormat,
} from "../../src/api/auth";

jest.setTimeout(30000);

interface CollectionResponse {
  count: number;
  data: unknown[];
}

describe("QuickFile REST API integration", () => {
  const accounts = listConfiguredAccounts();

  beforeAll(() => {
    if (accounts.length === 0) {
      throw new Error(
        "No QuickFile bearer tokens injected; expected QUICKFILE_<ACCOUNT>_API_KEY",
      );
    }
  });

  it.each(accounts)("authenticates account alias %s", async (account) => {
    const credentials = loadCredentials(account);
    expect(validateCredentialsFormat(credentials)).toBe(true);
    const client = new QuickFileApiClient({ account });
    const details = await client.request<Record<string, unknown>>("/account/me");
    expect(details).toHaveProperty("AccNumber");
    expect(details).toHaveProperty("BusinessName");
  });

  it.each(accounts)("performs read-only collection requests for %s", async (account) => {
    const client = new QuickFileApiClient({ account });
    const paths = [
      "/clients?limit=1",
      "/invoices?limit=1",
      "/purchases?limit=1",
      "/suppliers?limit=1",
      "/bank_accounts",
      "/reports/chart-of-accounts",
    ];

    for (const path of paths) {
      const response = await client.request<CollectionResponse>(path);
      expect(typeof response.count).toBe("number");
      expect(Array.isArray(response.data)).toBe(true);
    }
  });
});

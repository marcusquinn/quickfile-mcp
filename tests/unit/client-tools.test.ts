import { getApiClient } from "../../src/api/client";
import { handleClientTool } from "../../src/tools/client";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {},
}));

describe("REST client tools", () => {
  const request = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({ request });
  });

  it("maps search fields to REST query parameters", async () => {
    request.mockResolvedValue({ count: 1, data: [{ id: 12 }] });
    await handleClientTool("quickfile_client_search", {
      account: "evergreen",
      companyName: "Acme",
      returnCount: 10,
    });
    expect(getApiClient).toHaveBeenCalledWith("evergreen");
    expect(request).toHaveBeenCalledWith("/clients", {
      query: expect.objectContaining({
        company_name: "Acme",
        limit: 10,
        order_column: "company_name",
      }),
    });
  });

  it("creates a client and optional contact through separate REST endpoints", async () => {
    request.mockResolvedValueOnce({ id: 123 }).mockResolvedValueOnce({ id: 456 });
    await handleClientTool("quickfile_client_create", {
      account: "evergreen",
      companyName: "Acme Widgets Ltd",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(request).toHaveBeenNthCalledWith(1, "/clients", {
      method: "POST",
      body: expect.objectContaining({
        company_name: "Acme Widgets Ltd",
        default_currency: "GBP",
        default_term: 30,
      }),
    });
    expect(request).toHaveBeenNthCalledWith(2, "/clients/123/contacts", {
      method: "POST",
      body: expect.objectContaining({
        first_name: "Ada",
        surname: "Lovelace",
        email: "ada@example.com",
      }),
    });
  });

  it("does not create a partial contact", async () => {
    const result = await handleClientTool("quickfile_client_create", {
      account: "evergreen",
      companyName: "Acme",
      firstName: "Ada",
    });
    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});

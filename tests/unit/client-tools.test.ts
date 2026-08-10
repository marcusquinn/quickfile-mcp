import { getApiClient } from "../../src/api/client";
import { clientTools, handleClientTool } from "../../src/tools/client";

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
      firstName: "Ada",
      telephone: "01234",
      returnCount: 10,
    });
    expect(getApiClient).toHaveBeenCalledWith("evergreen");
    expect(request).toHaveBeenCalledWith("/clients", {
      query: expect.objectContaining({
        company_name: "Acme",
        first_name: "Ada",
        telephone: "01234",
        limit: 10,
        order_column: "company_name",
      }),
    });
  });

  it("advertises only REST-supported search and update fields", () => {
    const search = clientTools.find(
      (tool) => tool.name === "quickfile_client_search",
    );
    const update = clientTools.find(
      (tool) => tool.name === "quickfile_client_update",
    );
    expect(search?.inputSchema.properties).toMatchObject({
      firstName: { type: "string" },
      lastName: { type: "string" },
      telephone: { type: "string" },
    });
    expect(search?.inputSchema.properties).not.toHaveProperty("contactName");
    expect(update?.inputSchema.properties).not.toHaveProperty("firstName");
    expect(update?.inputSchema.properties).not.toHaveProperty("email");
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

  it("normalizes ISO country codes and rejects country names", async () => {
    request.mockResolvedValue({ id: 123 });
    await handleClientTool("quickfile_client_create", {
      account: "evergreen",
      companyName: "Acme",
      countryIso: "gb",
    });
    expect(request).toHaveBeenCalledWith("/clients", {
      method: "POST",
      body: expect.objectContaining({ country_iso: "GB" }),
    });

    request.mockClear();
    const result = await handleClientTool("quickfile_client_create", {
      account: "evergreen",
      companyName: "Acme",
      country: "United Kingdom",
    });
    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});

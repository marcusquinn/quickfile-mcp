import { getApiClient } from "../../src/api/client";
import { handleSupplierTool, supplierTools } from "../../src/tools/supplier";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {},
}));

describe("REST supplier tools", () => {
  const request = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({ request });
  });

  it("maps supplier search filters to snake-case query parameters", async () => {
    request.mockResolvedValue({ count: 1, data: [{ id: 42 }] });
    const result = await handleSupplierTool("quickfile_supplier_search", {
      account: "planning",
      firstName: "Ada",
      supplierReference: "ACME",
    });
    expect(request).toHaveBeenCalledWith("/suppliers", {
      query: expect.objectContaining({
        first_name: "Ada",
        supplier_reference: "ACME",
        order_column: "company_name",
      }),
    });
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      totalRecords: 1,
      count: 1,
    });
  });

  it("creates a supplier with REST field names", async () => {
    request.mockResolvedValue({ id: 12345 });
    await handleSupplierTool("quickfile_supplier_create", {
      account: "planning",
      companyName: "Acme Widgets Ltd",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      countryIso: "gb",
    });
    expect(request).toHaveBeenCalledWith("/suppliers", {
      method: "POST",
      body: expect.objectContaining({
        company_name: "Acme Widgets Ltd",
        contact_first_name: "Ada",
        contact_surname: "Lovelace",
        contact_email: "ada@example.com",
        country_iso: "GB",
      }),
    });
  });

  it("ignores invalid country names instead of sending malformed ISO data", async () => {
    request.mockResolvedValue({ id: 1 });
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    await handleSupplierTool("quickfile_supplier_create", {
      account: "planning",
      companyName: "Acme",
      country: "United Kingdom",
    });
    const body = request.mock.calls[0][1].body as Record<string, unknown>;
    expect(body).not.toHaveProperty("country_iso");
    expect(consoleError).toHaveBeenCalledWith(
      '[WARN] Ignored unrecognised country code {"country":"UNITED KINGDOM"}',
    );
    consoleError.mockRestore();
  });

  it("uses REST PUT for partial supplier updates", async () => {
    request.mockResolvedValue({ id: 7 });
    await handleSupplierTool("quickfile_supplier_update", {
      account: "planning",
      supplierId: 7,
      companyName: "Updated Ltd",
    });
    expect(request).toHaveBeenCalledWith("/suppliers/7", {
      method: "PUT",
      body: { company_name: "Updated Ltd" },
    });
    expect(
      supplierTools.find((tool) => tool.name === "quickfile_supplier_update")
        ?.inputSchema,
    ).toMatchObject({ required: ["supplierId"] });
  });

  it("wraps credential lookup failures", async () => {
    (getApiClient as jest.Mock).mockImplementationOnce(() => {
      throw new Error("missing credentials");
    });
    const result = await handleSupplierTool("quickfile_supplier_search", {
      account: "missing",
    });
    expect(result).toEqual({
      content: [{ type: "text", text: "Error: missing credentials" }],
      isError: true,
    });
  });

  it("does not initialize a client for unknown tools", async () => {
    const result = await handleSupplierTool("quickfile_supplier_unknown", {});
    expect(getApiClient).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });
});

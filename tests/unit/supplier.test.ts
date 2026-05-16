/**
 * Unit tests for supplier tools.
 */

import { handleSupplierTool, supplierTools } from "../../src/tools/supplier";
import { getApiClient } from "../../src/api/client";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {
    constructor(
      message: string,
      public code: string,
    ) {
      super(message);
      this.name = "QuickFileApiError";
    }
  },
}));

type ToolPayload = Record<string, Record<string, unknown>>;

describe("Supplier tools", () => {
  const mockRequest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({ request: mockRequest });
  });

  function propertiesFor(toolName: string): Record<string, unknown> {
    const tool = supplierTools.find((candidate) => candidate.name === toolName);
    return (tool?.inputSchema as { properties: Record<string, unknown> })
      .properties;
  }

  function lastPayload(): ToolPayload {
    return mockRequest.mock.calls[0][1] as ToolPayload;
  }

  describe("quickfile_supplier_search", () => {
    it("exposes supplier-specific filters and sends supplier wire names", async () => {
      mockRequest.mockResolvedValueOnce({ RecordsetCount: 0, Record: [] });

      await handleSupplierTool("quickfile_supplier_search", {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "accounts@example.com",
        telephone: "020 7946 0000",
        supplierReference: "ACME",
      });

      expect(propertiesFor("quickfile_supplier_search")).toMatchObject({
        telephone: { type: "string" },
        supplierReference: { type: "string" },
      });
      expect(lastPayload().SearchParameters).toMatchObject({
        ContactFirstName: "Ada",
        ContactSurname: "Lovelace",
        ContactEmail: "accounts@example.com",
        ContactTel: "020 7946 0000",
        SupplierReference: "ACME",
      });
      expect(lastPayload().SearchParameters).not.toHaveProperty("Email");
      expect(lastPayload().SearchParameters).not.toHaveProperty("ContactName");
    });

    it("normalizes a single Supplier_Search record into the suppliers array", async () => {
      mockRequest.mockResolvedValueOnce({
        RecordsetCount: 1,
        Record: { SupplierID: 42, CompanyName: "Solo Supplier" },
      });

      const result = await handleSupplierTool("quickfile_supplier_search", {});

      expect(JSON.parse(result.content[0].text)).toEqual({
        totalRecords: 1,
        count: 1,
        suppliers: [{ SupplierID: 42, CompanyName: "Solo Supplier" }],
      });
    });

    it("normalizes a null Supplier_Search record into an empty suppliers array", async () => {
      mockRequest.mockResolvedValueOnce({ RecordsetCount: 0, Record: null });

      const result = await handleSupplierTool("quickfile_supplier_search", {});

      expect(JSON.parse(result.content[0].text)).toEqual({
        totalRecords: 0,
        count: 0,
        suppliers: [],
      });
    });
  });

  describe("quickfile_supplier_create", () => {
    it("requires companyName and omits client-only supplier-rejected fields", () => {
      const createTool = supplierTools.find(
        (candidate) => candidate.name === "quickfile_supplier_create",
      );
      const props = propertiesFor("quickfile_supplier_create");

      expect(createTool?.inputSchema).toMatchObject({ required: ["companyName"] });
      for (const rejected of ["title", "mobile", "notes", "county", "companyRegNo"]) {
        expect(props).not.toHaveProperty(rejected);
      }
    });

    it("wraps SupplierDetails with supplier identity and contact fields", async () => {
      mockRequest.mockResolvedValueOnce({ SupplierID: 12345 });

      await handleSupplierTool("quickfile_supplier_create", {
        companyName: "Acme Widgets Ltd",
        companyNumber: "01234567",
        supplierReference: "ACME",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        telephone: "020 7946 0000",
      });

      expect(mockRequest).toHaveBeenCalledWith(
        "Supplier_Create",
        expect.any(Object),
      );
      const details = lastPayload().SupplierDetails;
      expect(details).toMatchObject({
        CompanyName: "Acme Widgets Ltd",
        CompanyNumber: "01234567",
        SupplierReference: "ACME",
        ContactFirstName: "Ada",
        ContactSurname: "Lovelace",
        ContactEmail: "ada@example.com",
        ContactTel: "020 7946 0000",
      });
      expect(details).not.toHaveProperty("SupplierData");
      expect(details).not.toHaveProperty("ContactSurName");
      expect(details).not.toHaveProperty("Email");
    });

    it("wraps SupplierDetails with flat address and preference fields", async () => {
      mockRequest.mockResolvedValueOnce({ SupplierID: 12345 });

      await handleSupplierTool("quickfile_supplier_create", {
        companyName: "Acme Widgets Ltd",
        address1: "1 Example Street",
        address2: "Industrial Estate",
        address3: "Greater Trading Park",
        town: "Market Drayton",
        postcode: "TF9 4LA",
        countryIso: "gb",
        defaultVatRate: 20,
        defaultNominalCode: 5000,
      });

      expect(mockRequest).toHaveBeenCalledWith(
        "Supplier_Create",
        expect.any(Object),
      );
      const details = lastPayload().SupplierDetails;
      expect(details).toMatchObject({
        AddressLine1: "1 Example Street",
        AddressLine2: "Industrial Estate",
        AddressLine3: "Greater Trading Park",
        Town: "Market Drayton",
        Postcode: "TF9 4LA",
        CountryISO: "GB",
      });
      expect(details.Preferences).toEqual({
        DefaultCurrency: "GBP",
        DefaultTerm: 30,
        DefaultVatRate: 20,
        DefaultNominalCode: 5000,
      });
      expect(details).not.toHaveProperty("SupplierData");
      expect(details).not.toHaveProperty("Address");
      expect(details).not.toHaveProperty("Currency");
      expect(details).not.toHaveProperty("TermDays");
    });

    it("accepts legacy country only when it is a valid two-letter ISO code", async () => {
      mockRequest.mockResolvedValueOnce({ SupplierID: 1 });
      await handleSupplierTool("quickfile_supplier_create", {
        companyName: "Acme",
        country: "United Kingdom",
      });
      expect(lastPayload().SupplierDetails).not.toHaveProperty("CountryISO");

      mockRequest.mockClear();
      mockRequest.mockResolvedValueOnce({ SupplierID: 2 });
      await handleSupplierTool("quickfile_supplier_create", {
        companyName: "Acme",
        country: "gb",
      });
      expect(lastPayload().SupplierDetails.CountryISO).toBe("GB");

      mockRequest.mockClear();
      mockRequest.mockResolvedValueOnce({ SupplierID: 3 });
      await handleSupplierTool("quickfile_supplier_create", {
        companyName: "Acme",
        countryIso: "ZZ",
      });
      expect(lastPayload().SupplierDetails).not.toHaveProperty("CountryISO");
    });
  });

  describe("handleSupplierTool", () => {
    it("wraps getApiClient errors with the standard tool error result", async () => {
      (getApiClient as jest.Mock).mockImplementationOnce(() => {
        throw new Error("missing credentials");
      });

      const result = await handleSupplierTool("quickfile_supplier_search", {});

      expect(result).toEqual({
        content: [{ type: "text", text: "Error: missing credentials" }],
        isError: true,
      });
    });

    it("does not initialize the API client for unknown supplier tools", async () => {
      const result = await handleSupplierTool("quickfile_supplier_unknown", {});

      expect(getApiClient).not.toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Unknown supplier tool: quickfile_supplier_unknown",
          },
        ],
        isError: true,
      });
    });
  });

  describe("quickfile_supplier_update", () => {
    it("declares supplierId as required and sends true partial updates", async () => {
      mockRequest.mockResolvedValueOnce({ SupplierDetailsUpdated: false });

      await handleSupplierTool("quickfile_supplier_update", {
        supplierId: 42,
        email: "x@example.com",
      });

      expect(supplierTools.find((tool) => tool.name === "quickfile_supplier_update")?.inputSchema).toMatchObject({
        required: ["supplierId"],
      });
      expect(mockRequest).toHaveBeenCalledWith("Supplier_Update", {
        SupplierDetails: {
          SupplierID: 42,
          ContactEmail: "x@example.com",
        },
      });
    });

    it("uses Supplier_Update surname casing and omits misleading API flag", async () => {
      mockRequest.mockResolvedValueOnce({ SupplierDetailsUpdated: false });

      const result = await handleSupplierTool("quickfile_supplier_update", {
        supplierId: 7,
        lastName: "Lovelace",
      });

      expect(lastPayload().SupplierDetails).toMatchObject({
        SupplierID: 7,
        ContactSurName: "Lovelace",
      });
      expect(lastPayload().SupplierDetails).not.toHaveProperty("ContactSurname");
      expect(JSON.parse(result.content[0].text)).toEqual({
        success: true,
        supplierId: 7,
        message: "Supplier #7 updated successfully",
      });
    });
  });
});

import { getApiClient } from "../../src/api/client";
import { handleBankTool } from "../../src/tools/bank";
import { handleDocumentTool } from "../../src/tools/document";
import { handleInvoiceTool } from "../../src/tools/invoice";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {},
}));

describe("REST mutation wire schemas", () => {
  const request = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({
      request,
      getBusinessProfile: jest.fn().mockReturnValue(undefined),
    });
  });

  it("creates invoices with the published snake-case fields", async () => {
    request.mockResolvedValue({ id: 99, invoice_number: "INV-99" });
    await handleInvoiceTool("quickfile_invoice_create", {
      account: "business",
      invoiceType: "INVOICE",
      clientId: 12,
      issueDate: "2026-08-10",
      poNumber: "PO-1",
      lines: [
        {
          description: "Consulting",
          unitCost: 100,
          quantity: 2,
          nominalCode: "4000",
          vatPercentage: 20,
        },
      ],
    });
    expect(request).toHaveBeenCalledWith("/invoices", {
      method: "POST",
      body: {
        type: "invoice",
        client_id: 12,
        currency: "GBP",
        term_days: 30,
        issue_date: "2026-08-10",
        purchase_reference: "PO-1",
        item_lines: [
          {
            description: "Consulting",
            nominal_code: 4000,
            vat_rate: 20,
            unit_cost: 100,
            qty: 2,
          },
        ],
      },
    });
  });

  it("creates bank accounts with a nested opening balance", async () => {
    request.mockResolvedValue({ id: 1200 });
    await handleBankTool("quickfile_bank_create_account", {
      account: "business",
      bankId: 1,
      accountName: "Current account",
      accountType: "current",
      openingBalance: 50,
      openingBalanceDate: "2026-08-10",
    });
    expect(request).toHaveBeenCalledWith("/bank_accounts", {
      method: "POST",
      body: {
        bank_name_id: 1,
        type: "current",
        name: "Current account",
        currency: "GBP",
        opening_balance: { date: "2026-08-10", amount: 50 },
      },
    });
  });

  it("uses negative amounts for money-out bank transactions", async () => {
    request.mockResolvedValue({ id: 10 });
    await handleBankTool("quickfile_bank_create_transaction", {
      account: "business",
      nominalCode: "1200",
      transactionDate: "2026-08-10",
      amount: 25,
      transactionType: "MONEY_OUT",
      reference: "Supplier payment",
    });
    expect(request).toHaveBeenCalledWith("/bank_accounts/1200/transactions", {
      method: "POST",
      body: {
        date: "2026-08-10",
        amount: -25,
        reference: "Supplier payment",
        duplicate_check: true,
      },
    });
  });

  it("defaults receipt capture_date to the required date-only format", async () => {
    request.mockResolvedValue({ id: 7 });
    await handleDocumentTool("quickfile_document_upload_receipt", {
      account: "business",
      fileName: "receipt.pdf",
      fileData: Buffer.from("receipt").toString("base64"),
    });
    const options = request.mock.calls[0][1] as { form: FormData };
    expect(request.mock.calls[0][0]).toBe("/documents/receipt");
    expect(options.form.get("capture_date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(options.form.get("receipt_name")).toBe("receipt.pdf");
  });
});

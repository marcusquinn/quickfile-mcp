import { getApiClient } from "../../src/api/client";
import { handleInvoiceTool, invoiceTools } from "../../src/tools/invoice";
import { handleRestTool } from "../../src/tools/rest";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {},
}));

describe("credit notes and payment guard", () => {
  const request = jest.fn();
  const getBusinessProfile = jest.fn().mockReturnValue({ vatRegistered: false });

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({ request, getBusinessProfile });
  });

  it("no longer advertises CREDIT on legacy invoice tools", () => {
    for (const tool of invoiceTools) {
      expect(JSON.stringify(tool.inputSchema)).not.toContain('"CREDIT"');
    }
  });

  it("builds a REST v2 hold credit note body and reads it back", async () => {
    request.mockResolvedValueOnce({ id: 9 }).mockResolvedValueOnce({ id: 9 });
    const result = await handleInvoiceTool("quickfile_credit_note_create", {
      account: "evergreen",
      creditType: "hold",
      invoiceId: 5,
      clientId: 3,
      lines: [{ description: "Refund", unitCost: 10, quantity: 1 }],
    });
    expect(result.isError).toBeUndefined();
    expect(request).toHaveBeenNthCalledWith(1, "/invoices", {
      method: "POST",
      body: expect.objectContaining({
        type: "invoice",
        client_id: 3,
        credit_note: { type: "hold", invoice_id: 5 },
      }),
    });
    expect(request).toHaveBeenNthCalledWith(2, "/invoices/9");
  });

  it("requires a bank nominal for refunds", async () => {
    const result = await handleInvoiceTool("quickfile_credit_note_create", {
      account: "evergreen",
      creditType: "refund",
      clientId: 3,
      lines: [{ description: "x", unitCost: 1, quantity: 1 }],
    });
    expect(result.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  const payment = {
    type: "payment",
    date: "2026-11-20",
    client_id: 1,
    invoice_id: 2,
    amount: 100,
    currency: "GBP",
    nominal_code: 1200,
  };

  it("refuses a payment when a matching untagged bank line exists", async () => {
    request.mockResolvedValueOnce({ data: [{ id: 1, amount: 100, date: "2026-11-21" }] });
    const result = await handleRestTool("quickfile_rest_client_payment_post", {
      account: "evergreen",
      body: payment,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Refused");
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "/bank_accounts/1200/transactions",
      expect.objectContaining({
        query: expect.objectContaining({
          tag_status: "untagged",
          date_from: "2026-11-13",
          date_to: "2026-11-27",
        }),
      }),
    );
  });

  it("posts when there is no match or the override is set", async () => {
    request
      .mockResolvedValueOnce({ data: [{ id: 1, amount: 55 }] })
      .mockResolvedValueOnce({ id: 77 });
    const ok = await handleRestTool("quickfile_rest_client_payment_post", {
      account: "evergreen",
      body: payment,
    });
    expect(ok.isError).toBeUndefined();
    expect(request).toHaveBeenLastCalledWith("/client_payments", {
      method: "POST",
      body: payment,
    });

    request.mockClear();
    request.mockResolvedValueOnce({ id: 78 });
    await handleRestTool("quickfile_rest_client_payment_post", {
      account: "evergreen",
      allow_new_bank_line: true,
      body: payment,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});

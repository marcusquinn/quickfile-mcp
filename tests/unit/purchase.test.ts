import { getApiClient } from "../../src/api/client";
import { handlePurchaseTool, purchaseTools } from "../../src/tools/purchase";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {},
}));

describe("REST purchase tools", () => {
  const request = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({
      request,
      getBusinessProfile: jest.fn().mockReturnValue(undefined),
    });
  });

  it("searches deleted purchases through REST query parameters", async () => {
    request.mockResolvedValue({ count: 0, data: [] });
    await handlePurchaseTool("quickfile_purchase_search", {
      account: "brandlight",
      status: "DELETED",
      includeDeleted: true,
    });
    expect(request).toHaveBeenCalledWith("/purchases", {
      query: expect.objectContaining({
        status: "deleted",
        include_deleted: true,
        order_column: "receipt_date",
      }),
    });
  });

  it("deletes each purchase through its REST resource", async () => {
    request.mockResolvedValue({});
    const result = await handlePurchaseTool("quickfile_purchase_delete", {
      account: "brandlight",
      purchaseIds: [123, 456],
      deleteAssociatedPayments: false,
    });
    expect(request).toHaveBeenNthCalledWith(1, "/purchases/123", {
      method: "DELETE",
      body: { delete_associated_payments: false },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/purchases/456", {
      method: "DELETE",
      body: { delete_associated_payments: false },
    });
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      purchasesDeleted: 2,
    });
  });

  it("keeps destructive delete inputs explicit", () => {
    const tool = purchaseTools.find(
      (candidate) => candidate.name === "quickfile_purchase_delete",
    );
    expect(tool?.inputSchema).toMatchObject({
      required: ["purchaseIds"],
      properties: {
        deleteAssociatedPayments: { type: "boolean", default: true },
      },
    });
  });
});

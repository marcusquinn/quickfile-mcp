/**
 * Unit tests for purchase tools.
 */

import { handlePurchaseTool, purchaseTools } from "../../src/tools/purchase";
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

describe("Purchase tools", () => {
  const mockRequest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({
      request: mockRequest,
    });
  });

  describe("quickfile_purchase_delete", () => {
    it("declares purchaseIds and deleteAssociatedPayments as sibling schema properties", () => {
      const tool = purchaseTools.find(
        (candidate) => candidate.name === "quickfile_purchase_delete",
      );

      expect(tool?.inputSchema).toMatchObject({
        type: "object",
        properties: {
          purchaseIds: {
            type: "array",
            items: { type: "integer", minimum: 1 },
            minItems: 1,
            uniqueItems: true,
          },
          deleteAssociatedPayments: {
            type: "boolean",
            default: true,
          },
        },
        required: ["purchaseIds"],
      });
    });

    it("sends the QuickFile bulk delete wire format and returns deleted count", async () => {
      mockRequest.mockResolvedValueOnce({ PurchasesDeleted: 2 });

      const result = await handlePurchaseTool("quickfile_purchase_delete", {
        purchaseIds: [123, 456],
        deleteAssociatedPayments: false,
      });

      expect(mockRequest).toHaveBeenCalledWith("Purchase_Delete", {
        PurchaseDetails: {
          PurchaseIDs: { PurchaseID: [123, 456] },
          DeleteAssociatedPayments: false,
        },
      });
      expect(JSON.parse(result.content[0].text)).toEqual({
        success: true,
        purchaseIds: [123, 456],
        purchasesDeleted: 2,
        message: "2 purchase(s) deleted",
      });
    });

    it("defaults DeleteAssociatedPayments to true", async () => {
      mockRequest.mockResolvedValueOnce({ PurchasesDeleted: 1 });

      await handlePurchaseTool("quickfile_purchase_delete", {
        purchaseIds: [789],
      });

      expect(mockRequest).toHaveBeenCalledWith("Purchase_Delete", {
        PurchaseDetails: {
          PurchaseIDs: { PurchaseID: [789] },
          DeleteAssociatedPayments: true,
        },
      });
    });
  });
});

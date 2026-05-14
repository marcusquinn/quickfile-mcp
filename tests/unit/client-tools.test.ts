/**
 * Unit tests for client tool wire shapes.
 */

import { handleClientTool } from "../../src/tools/client";
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

describe("Client tools", () => {
  const mockRequest = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({ request: mockRequest });
  });

  it("keeps client create on ClientData with nested Address and flat defaults", async () => {
    mockRequest.mockResolvedValueOnce({ ClientID: 123 });

    await handleClientTool("quickfile_client_create", {
      companyName: "Acme Widgets Ltd",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      address1: "1 Example Street",
      town: "Market Drayton",
      country: "United Kingdom",
    });

    expect(mockRequest).toHaveBeenCalledWith("Client_Create", {
      ClientData: expect.objectContaining({
        CompanyName: "Acme Widgets Ltd",
        FirstName: "Ada",
        LastName: "Lovelace",
        Email: "ada@example.com",
        Currency: "GBP",
        TermDays: 30,
        Address: {
          Address1: "1 Example Street",
          Town: "Market Drayton",
          Country: "United Kingdom",
        },
      }),
    });
  });

  it("keeps client update as a partial ClientData payload", async () => {
    mockRequest.mockResolvedValueOnce({});

    await handleClientTool("quickfile_client_update", {
      clientId: 456,
      email: "new@example.com",
    });

    expect(mockRequest).toHaveBeenCalledWith("Client_Update", {
      ClientData: {
        ClientID: 456,
        Email: "new@example.com",
      },
    });
  });
});

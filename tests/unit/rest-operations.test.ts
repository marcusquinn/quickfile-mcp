import { getApiClient } from "../../src/api/client";
import {
  allTools,
  handleToolCall,
  requiresConfirmation,
  restTools,
} from "../../src/tools";
import { restOperationCount, restSchemaVersion } from "../../src/tools/rest";

jest.mock("../../src/api/client", () => ({
  getApiClient: jest.fn(),
  QuickFileApiError: class QuickFileApiError extends Error {},
}));

describe("generated REST v2 operations", () => {
  const request = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getApiClient as jest.Mock).mockReturnValue({ request });
    request.mockResolvedValue({ count: 0, data: [] });
  });

  it("covers every published operation with unique tool names", () => {
    expect(restSchemaVersion).toBe("v2");
    expect(restOperationCount).toBe(75);
    expect(restTools).toHaveLength(75);
    expect(new Set(restTools.map((tool) => tool.name)).size).toBe(75);
    expect(allTools).toHaveLength(112);
    expect(new Set(allTools.map((tool) => tool.name)).size).toBe(112);
  });

  it("includes schema areas that were absent from curated tools", () => {
    const names = new Set(restTools.map((tool) => tool.name));
    expect(names.has("quickfile_rest_client_new_dd_collection")).toBe(true);
    expect(names.has("quickfile_rest_document_upload_general")).toBe(true);
    expect(names.has("quickfile_rest_inventory_post")).toBe(true);
    expect(names.has("quickfile_rest_journal_post")).toBe(true);
    expect(names.has("quickfile_rest_ledger_search")).toBe(true);
    expect(names.has("quickfile_rest_project_create")).toBe(true);
    expect(names.has("quickfile_rest_purchase_order_post_order")).toBe(true);
  });

  it("classifies generated reads and writes fail closed", () => {
    expect(requiresConfirmation("quickfile_rest_ledger_search")).toBe(false);
    expect(requiresConfirmation("quickfile_rest_journal_post")).toBe(true);

    const readTool = allTools.find(
      (tool) => tool.name === "quickfile_rest_ledger_search",
    );
    const writeTool = allTools.find(
      (tool) => tool.name === "quickfile_rest_journal_post",
    );
    expect(readTool?.annotations?.readOnlyHint).toBe(true);
    expect(readTool?.inputSchema.required).not.toContain("confirmed");
    expect(writeTool?.annotations?.readOnlyHint).toBe(false);
    expect(writeTool?.inputSchema.required).toContain("confirmed");
  });

  it("maps exact query fields to a GET request", async () => {
    await handleToolCall("quickfile_rest_ledger_search", {
      account: "business",
      query: { nominal_code: 4000, limit: 10 },
    });

    expect(request).toHaveBeenCalledWith("/ledgers", {
      method: "GET",
      query: { nominal_code: 4000, limit: 10 },
    });
  });

  it("maps path parameters and bodies to a PUT request", async () => {
    const body = { first_name: "Alex" };
    await handleToolCall("quickfile_rest_client_contact_update", {
      account: "business",
      confirmed: true,
      pathParams: { id: 7, contactId: 9 },
      body,
    });

    expect(request).toHaveBeenCalledWith("/clients/7/contacts/9", {
      method: "PUT",
      body,
    });
  });

  it("builds multipart form data for general document uploads", async () => {
    await handleToolCall("quickfile_rest_document_upload_general", {
      account: "business",
      confirmed: true,
      formData: {
        file: {
          fileName: "evidence.txt",
          fileData: Buffer.from("evidence").toString("base64"),
          mimeType: "text/plain",
        },
        collection_name: "Records",
      },
    });

    const options = request.mock.calls[0][1] as { form: FormData };
    expect(request.mock.calls[0][0]).toBe("/documents/general");
    expect(options.form.get("collection_name")).toBe("Records");
    expect((options.form.get("file") as File).name).toBe("evidence.txt");
  });
});

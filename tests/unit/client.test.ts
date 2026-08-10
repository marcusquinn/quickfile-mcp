import {
  _clearClientCache,
  getApiClient,
  QuickFileApiClient,
  QuickFileApiError,
} from "../../src/api/client";

jest.mock("../../src/api/auth", () => ({
  loadCredentials: jest.fn((account: string) => ({
    account,
    bearerToken: `${account}-token`,
  })),
}));

function response(status: number, data?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(
      data === undefined ? "" : JSON.stringify(data),
    ),
  } as unknown as Response;
}

describe("QuickFileApiError", () => {
  it("retains a safe error code", () => {
    const error = new QuickFileApiError("Not found", "NOT_FOUND");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("QuickFileApiError");
    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("QuickFileApiClient", () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch;
    _clearClientCache();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses the REST base URL and bearer authorization", async () => {
    mockFetch.mockResolvedValue(response(200, { BusinessName: "Example" }));
    const client = new QuickFileApiClient({ account: "evergreen" });

    await expect(client.request("/account/me")).resolves.toEqual({
      BusinessName: "Example",
    });
    const [url, options] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://api-beta.quickfile.co.uk/account/me");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer evergreen-token",
      Accept: "application/json",
    });
  });

  it("encodes query values and repeated array parameters", async () => {
    mockFetch.mockResolvedValue(response(200, { data: [] }));
    const client = new QuickFileApiClient({ account: "planning" });
    await client.request("/clients", {
      query: { company_name: "A & B", types: ["current", "reserve"] },
    });
    const [url] = mockFetch.mock.calls[0] as [URL];
    expect(url.searchParams.get("company_name")).toBe("A & B");
    expect(url.searchParams.getAll("types")).toEqual(["current", "reserve"]);
  });

  it("sends JSON bodies with the correct content type", async () => {
    mockFetch.mockResolvedValue(response(200, { id: 42 }));
    const client = new QuickFileApiClient({ account: "planning" });
    await client.request("/clients", {
      method: "POST",
      body: { company_name: "Example" },
    });
    const [, options] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(options.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(options.body).toBe(JSON.stringify({ company_name: "Example" }));
  });

  it("does not set JSON content type for multipart forms", async () => {
    mockFetch.mockResolvedValue(response(200, { id: 7 }));
    const client = new QuickFileApiClient({ account: "planning" });
    const form = new FormData();
    form.append("notes", "test");
    await client.request("/documents/general", { method: "POST", form });
    const [, options] = mockFetch.mock.calls[0] as [URL, RequestInit];
    expect(options.body).toBe(form);
    expect(options.headers).not.toHaveProperty("Content-Type");
  });

  it("handles 204 no-content responses", async () => {
    mockFetch.mockResolvedValue(response(204));
    const client = new QuickFileApiClient({ account: "planning" });
    await expect(
      client.request("/clients/42", { method: "DELETE" }),
    ).resolves.toEqual({});
  });

  it("classifies authentication and rate-limit failures", async () => {
    const client = new QuickFileApiClient({ account: "planning" });
    mockFetch.mockResolvedValueOnce(response(401));
    await expect(client.request("/account/me")).rejects.toMatchObject({
      code: "INVALID_AUTH",
    });
    mockFetch.mockResolvedValueOnce(response(429));
    await expect(client.request("/account/me")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("rejects legacy method names", async () => {
    const client = new QuickFileApiClient({ account: "planning" });
    await expect(client.request("Client_Search")).rejects.toMatchObject({
      code: "LEGACY_UNSUPPORTED",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns one cached client per account", () => {
    expect(getApiClient("evergreen")).toBe(getApiClient("evergreen"));
    expect(getApiClient("evergreen")).not.toBe(getApiClient("planning"));
  });
});

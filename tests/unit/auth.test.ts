import {
  _clearCredentialsCache,
  listConfiguredAccounts,
  loadCredentials,
  validateCredentialsFormat,
} from "../../src/api/auth";

describe("REST bearer-token authentication", () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("QUICKFILE_")) {
        delete process.env[key];
      }
    }
    _clearCredentialsCache();
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it("lists account aliases without returning values", () => {
    expect(
      listConfiguredAccounts({
        QUICKFILE_PLANNING_API_KEY: "planning-secret",
        QUICKFILE_EVERGREEN_BEARER_TOKEN: "evergreen-secret",
        QUICKFILE_DEBUG: "1",
      }),
    ).toEqual(["evergreen", "planning"]);
  });

  it("loads an entity-specific API key as a bearer token", () => {
    process.env.QUICKFILE_EVERGREEN_API_KEY = "rest-token";
    expect(loadCredentials("evergreen")).toEqual({
      account: "evergreen",
      bearerToken: "rest-token",
      businessProfile: undefined,
    });
  });

  it("prefers an explicit bearer-token variable", () => {
    process.env.QUICKFILE_PLANNING_API_KEY = "api-key-token";
    process.env.QUICKFILE_PLANNING_BEARER_TOKEN = "bearer-token";
    expect(loadCredentials("planning").bearerToken).toBe("bearer-token");
  });

  it("normalizes hyphenated aliases to environment variable names", () => {
    process.env.QUICKFILE_BRAND_LIGHT_API_KEY = "token";
    expect(loadCredentials("brand-light").account).toBe("brand_light");
  });

  it("supports one generic default token", () => {
    process.env.QUICKFILE_API_KEY = "default-token";
    expect(listConfiguredAccounts()).toEqual(["default"]);
    expect(loadCredentials("default").bearerToken).toBe("default-token");
  });

  it("fails clearly when an alias is not configured", () => {
    expect(() => loadCredentials("missing")).toThrow(
      "QuickFile bearer token not found for account \"missing\"",
    );
  });

  it("rejects unsafe account aliases", () => {
    expect(() => loadCredentials("../../unsafe")).toThrow(
      "QuickFile account must contain only",
    );
  });

  it("loads an optional VAT profile from the environment", () => {
    process.env.QUICKFILE_MARCUSQUINN_API_KEY = "token";
    process.env.QUICKFILE_MARCUSQUINN_VAT_REGISTERED = "false";
    expect(loadCredentials("marcusquinn").businessProfile).toEqual({
      vatRegistered: false,
    });
  });

  it("rejects malformed VAT profile values", () => {
    process.env.QUICKFILE_MARCUSQUINN_API_KEY = "token";
    process.env.QUICKFILE_MARCUSQUINN_VAT_REGISTERED = "yes";
    expect(() => loadCredentials("marcusquinn")).toThrow(
      "QUICKFILE_MARCUSQUINN_VAT_REGISTERED must be true or false",
    );
  });

  it("caches credentials until force reload", () => {
    process.env.QUICKFILE_BRANDLIGHT_API_KEY = "first";
    expect(loadCredentials("brandlight").bearerToken).toBe("first");
    process.env.QUICKFILE_BRANDLIGHT_API_KEY = "second";
    expect(loadCredentials("brandlight").bearerToken).toBe("first");
    expect(loadCredentials("brandlight", true).bearerToken).toBe("second");
  });

  it("validates token presence without imposing a legacy key shape", () => {
    expect(
      validateCredentialsFormat({ account: "planning", bearerToken: "token" }),
    ).toBe(true);
    expect(
      validateCredentialsFormat({ account: "planning", bearerToken: "" }),
    ).toBe(false);
  });
});

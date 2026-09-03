/**
 * QuickFile REST API bearer-token authentication.
 *
 * Tokens are supplied through environment variables so a secret manager can
 * inject them into the MCP process without writing plaintext credential files.
 * Multi-account variables use QUICKFILE_<ACCOUNT>_API_KEY. The
 * QUICKFILE_<ACCOUNT>_API_TOKEN and QUICKFILE_<ACCOUNT>_BEARER_TOKEN aliases are
 * also accepted, with BEARER_TOKEN taking precedence.
 */

import type { QuickFileCredentials } from "../types/quickfile.js";

const TOKEN_SUFFIXES = ["BEARER_TOKEN", "API_TOKEN", "API_KEY"] as const;
const GENERIC_ACCOUNT = "default";
const credentialsCache = new Map<string, QuickFileCredentials>();

function assertNoNamedDefaultToken(environment: NodeJS.ProcessEnv): void {
  const ambiguousVariable = TOKEN_SUFFIXES.map(
    (suffix) => `QUICKFILE_DEFAULT_${suffix}`,
  ).find((variable) => environment[variable]);
  if (ambiguousVariable) {
    throw new Error(
      `${ambiguousVariable} is ambiguous; use QUICKFILE_API_KEY for the default account or choose a different alias`,
    );
  }
}

function normalizeAccount(account: string): string {
  const normalized = account.trim().toUpperCase().replace(/-/g, "_");
  if (!normalized || !/^[A-Z0-9_]+$/.test(normalized)) {
    throw new Error(
      "QuickFile account must contain only letters, numbers, underscores, or hyphens",
    );
  }
  return normalized;
}

function tokenVariableCandidates(account: string): string[] {
  const normalized = normalizeAccount(account);
  if (normalized === GENERIC_ACCOUNT.toUpperCase()) {
    return TOKEN_SUFFIXES.map((suffix) => `QUICKFILE_${suffix}`);
  }
  return TOKEN_SUFFIXES.map((suffix) => `QUICKFILE_${normalized}_${suffix}`);
}

function readBusinessProfile(
  normalizedAccount: string,
): QuickFileCredentials["businessProfile"] {
  const variable =
    normalizedAccount === GENERIC_ACCOUNT.toUpperCase()
      ? "QUICKFILE_VAT_REGISTERED"
      : `QUICKFILE_${normalizedAccount}_VAT_REGISTERED`;
  const raw = process.env[variable];
  if (raw === undefined) {
    return undefined;
  }
  if (raw !== "true" && raw !== "false") {
    throw new Error(`${variable} must be true or false`);
  }
  return { vatRegistered: raw === "true" };
}

/** Return configured account aliases without exposing token values. */
export function listConfiguredAccounts(
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  assertNoNamedDefaultToken(environment);
  const accounts = new Set<string>();

  for (const variable of Object.keys(environment)) {
    for (const suffix of TOKEN_SUFFIXES) {
      const marker = `QUICKFILE_`;
      const ending = `_${suffix}`;
      if (variable.startsWith(marker) && variable.endsWith(ending)) {
        const account = variable.slice(marker.length, -ending.length);
        if (account && environment[variable]) {
          accounts.add(account.toLowerCase());
        }
      }
    }
  }

  if (TOKEN_SUFFIXES.some((suffix) => environment[`QUICKFILE_${suffix}`])) {
    accounts.add(GENERIC_ACCOUNT);
  }

  return [...accounts].sort();
}

/** Load one account's bearer token from the process environment. */
export function loadCredentials(
  account: string,
  forceReload = false,
): QuickFileCredentials {
  const normalized = normalizeAccount(account);
  if (normalized === GENERIC_ACCOUNT.toUpperCase()) {
    assertNoNamedDefaultToken(process.env);
  }
  const cacheKey = normalized.toLowerCase();
  const cached = credentialsCache.get(cacheKey);
  if (cached && !forceReload) {
    return cached;
  }

  const variable = tokenVariableCandidates(account).find(
    (candidate) => process.env[candidate],
  );
  if (!variable) {
    throw new Error(
      `QuickFile bearer token not found for account "${account}". Expected QUICKFILE_${normalized}_API_KEY`,
    );
  }

  const credentials: QuickFileCredentials = {
    account: cacheKey,
    bearerToken: process.env[variable] as string,
    businessProfile: readBusinessProfile(normalized),
  };
  credentialsCache.set(cacheKey, credentials);
  return credentials;
}

/** Validate only presence; QuickFile personal tokens have no stable public shape. */
export function validateCredentialsFormat(
  credentials: QuickFileCredentials,
): boolean {
  return (
    /^[a-z0-9_]+$/.test(credentials.account) &&
    credentials.bearerToken.trim().length > 0
  );
}

/** Clear cached environment lookups. Intended for tests. */
export function _clearCredentialsCache(): void {
  credentialsCache.clear();
}

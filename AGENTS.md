# QuickFile MCP - AI Assistant Guide

<!-- AI-CONTEXT-START -->

## Quick Reference

- **API**: QuickFile beta REST API
- **Docs**: https://api-beta.quickfile.co.uk/api-docs/
- **Auth**: personal bearer token in `Authorization: Bearer ...`
- **Secrets**: `QUICKFILE_<ACCOUNT>_API_KEY` process environment variables
- **Accounts**: every MCP tool requires an explicit `account` alias
- **Legacy fields**: account number, MD5, and Application ID are not used
- **Safety**: confirm all create/send/upload/update/delete operations and sanitize
  returned user-controlled content

<!-- AI-CONTEXT-END -->

## Account routing

Never infer an account when more than one alias is configured. Require the user
or task context to identify the entity, then pass its normalized alias through
the tool's `account` field.

Example token names:

```text
QUICKFILE_BUSINESS_API_KEY
QUICKFILE_PERSONAL_API_KEY
```

These produce `business` and `personal` account aliases. Secret values must be
injected into the MCP process by a secret manager and must never appear in MCP
arguments, config files, logs, tests, issues, or chat.

## API patterns

- Base URL: `https://api-beta.quickfile.co.uk`
- Account verification: `GET /account/me`
- Search/list responses: `{ count, location, paging?, data: [] }`
- JSON request and response fields use snake case except account details, whose
  published schema uses names such as `AccNumber` and `BusinessName`.
- Document uploads use multipart form data.
- `401`/`403`: invalid or insufficient bearer-token authorization.
- `429`: rate limited; pause instead of retrying aggressively.

## Tool behavior

Every exported tool receives the account selector in `src/tools/index.ts`.
Handlers must call `getApiClient(args.account)` and use only documented REST
paths and fields.

Read-only operations can proceed when the entity is explicit. Creating,
updating, sending, uploading, or deleting data requires confirmation and should
return the selected account alias or resource ID in the result where useful.

The REST beta specification does not advertise the legacy create-note,
estimate-accept/decline, or estimate-conversion endpoints. Do not reintroduce
them without current OpenAPI evidence and runtime verification.

## VAT behavior

`QUICKFILE_<ACCOUNT>_VAT_REGISTERED=true|false` optionally defines each entity's
VAT posture. Without it, create operations require explicit per-line VAT rates.
Never silently default VAT to 20%.

## Development verification

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run build
```

Run `npm run test:integration` only with securely injected tokens. Integration
coverage must remain read-only unless a dedicated disposable test account and
explicit destructive-test authorization are provided.

When changing REST mappings, inspect the current OpenAPI operation and schemas
at https://api-beta.quickfile.co.uk/api-docs/ before editing, add a wire-shape
unit test, then verify the affected read-only endpoint live when possible.

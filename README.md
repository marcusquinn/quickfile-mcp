# QuickFile MCP Server and CLI

Model Context Protocol server and command-line client for QuickFile UK
accounting, using the beta REST API with personal bearer tokens and explicit
multi-account selection.

## Features

- 112 tools: 37 curated operations plus exact coverage of all 75 operations in
  QuickFile's published REST v2 schema
- QuickFile beta REST API bearer-token authentication
- Multiple QuickFile entities in one MCP process
- Required `account` argument on every tool to prevent cross-entity mistakes
- Environment-only token loading for secret-manager injection
- Sanitization of user-controlled accounting data before MCP output
- JSON CLI over the same validated and sanitized operations as MCP

QuickFile REST API documentation: https://api-beta.quickfile.co.uk/api-docs/

## Install

QuickFile MCP requires Node.js 24. Install the published package globally for
long-lived MCP clients and direct CLI use:

```bash
npm install --global quickfile-mcp
quickfile --help
```

Run the MCP server without a global installation when needed:

```bash
npx --yes quickfile-mcp
```

For source development, clone the repository and use its pinned Node.js and npm
versions:

```bash
git clone https://github.com/marcusquinn/quickfile-mcp.git
cd quickfile-mcp
nvm install
nvm use
corepack enable npm
npm ci
npm run hooks:install
npm run build
```

Source development requires the exact Node.js version in [`.nvmrc`](.nvmrc)
(currently 24.19.0) and npm 11.17.0. The repository declares npm through
`packageManager`; use Corepack to select it before installing dependencies.

## Authentication

Generate a **personal bearer token** from the **Developer Dashboard**, available
from the top-right menu in the QuickFile account.

Grant only the endpoint groups the account needs. Personal REST tokens do not
use the legacy account-number, MD5, or Application ID authentication fields.

Inject each token as an account-specific environment variable:

```bash
export QUICKFILE_BUSINESS_API_KEY="<personal-bearer-token>"
export QUICKFILE_PERSONAL_API_KEY="<personal-bearer-token>"
```

The account segment becomes the lowercase alias accepted by every tool's
required `account` parameter (`business` and `personal` in this example). Use
underscores for multi-word aliases: `QUICKFILE_MY_BUSINESS_API_KEY` exposes
`my_business`. `BEARER_TOKEN` and `API_TOKEN` suffixes are also accepted, with
precedence in that order before `API_KEY`.

For a single unnamed entity, `QUICKFILE_API_KEY`, `QUICKFILE_API_TOKEN`, or
`QUICKFILE_BEARER_TOKEN` exposes the alias `default`. Do not use the ambiguous
`QUICKFILE_DEFAULT_*` form.

### aidevops secret storage

Store values using hidden terminal input; never paste them into chat or config:

```bash
aidevops secret set QUICKFILE_BUSINESS_API_KEY
aidevops secret set QUICKFILE_PERSONAL_API_KEY
```

Launch the installed MCP while injecting only the required tokens:

```bash
aidevops secret QUICKFILE_BUSINESS_API_KEY QUICKFILE_PERSONAL_API_KEY -- \
  quickfile-mcp
```

Optional VAT posture can be set per account:

```bash
export QUICKFILE_BUSINESS_VAT_REGISTERED=true
export QUICKFILE_PERSONAL_VAT_REGISTERED=false
```

For the curated `quickfile_invoice_create` and `quickfile_purchase_create`
tools:

- When VAT posture is unset or `true`, every line requires an explicit
  `vatPercentage`; rates are never silently defaulted.
- When VAT posture is `false`, omit `vatPercentage`. The tools use 0% and reject
  an explicitly supplied rate as contradictory configuration.

Exact `quickfile_rest_*` tools use the published snake_case request schemas
directly and do not apply this curated-tool VAT helper.

## MCP client configuration

Configure the client to run the secret-manager command rather than embedding
tokens in JSON. Generic command shape:

```text
aidevops secret <TOKEN_NAME> [<TOKEN_NAME>...] -- quickfile-mcp
```

Source installations can use `npm start` instead. After running `npm run build`,
use `./setup.sh client` to print the generic secure launch command for that
checkout. Restart the MCP client after changing its process environment or
secret injection command.

## Account selection

Every tool requires an explicit account alias:

```json
{
  "account": "business"
}
```

Examples:

```text
Show account details for the business QuickFile account.
List unpaid invoices for the personal QuickFile account.
```

The server refuses startup when no bearer-token variables are present and
refuses tool calls for unknown aliases.

## Command-line interface

The `quickfile` CLI exposes the same tool registry and handlers as the MCP
server. It is useful for scripts and AI agents that prefer a composable command
over an MCP transport. Output is JSON except for help and version text.

```bash
# Discover configured aliases and operations without exposing token values
quickfile accounts
quickfile tools
quickfile describe quickfile_invoice_search
quickfile describe quickfile_rest_journal_search

# Execute a read-only operation
quickfile call quickfile_system_get_account --account business

# Pass operation fields as one JSON object
quickfile call quickfile_invoice_search --account business \
  --input '{"status":"PAID","returnCount":10}'

# Use exact REST field names for any published v2 operation
quickfile call quickfile_rest_ledger_search --account business \
  --input '{"query":{"nominal_code":4000,"limit":10}}'
```

Create, update, send, upload, login-URL generation, and delete operations fail
unless `--confirm` is supplied. Only add it after the intended account, payload,
and effect have been confirmed. Keep bearer tokens in `QUICKFILE_*` environment
variables; never include them in CLI arguments.

The same guard applies to MCP: mutating tool schemas require `confirmed: true`.
Both interfaces validate required fields, primitive types, enumerations, and
unknown fields before loading credentials or calling QuickFile.

CLI `--input` must contain one JSON object. Supply routing and confirmation only
through `--account` and `--confirm`; do not put `account` or `confirmed` inside
the JSON payload.

Source checkouts can replace `quickfile` with `npm run cli --`. The installed
commands are `quickfile` and `quickfile-mcp`.

## Tool groups

| Group         | Tools                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System        | Account details, event log                                                                                                                                            |
| Clients       | Search, get, create, update, delete, contacts, login URL                                                                                                              |
| Invoices      | Search, get, create, delete, send, PDF URL                                                                                                                            |
| Purchases     | Search, get, create, delete                                                                                                                                           |
| Suppliers     | Search, get, create, update, delete                                                                                                                                   |
| Banking       | Accounts, balances, transactions, account creation                                                                                                                    |
| Reports       | P&L, balance sheet, VAT, ageing, chart, subscriptions                                                                                                                 |
| Documents     | Receipt and sales-attachment uploads                                                                                                                                  |
| Exact REST v2 | All 75 published operations, including payments, inventory, journals, ledgers, projects, purchase orders, contacts, recurring templates, and general document uploads |

Invoice creation supports invoice, estimate, and credit document types. The
REST beta API does not currently advertise the legacy create-note,
estimate-accept/decline, or estimate-conversion endpoints, so those legacy-only
tools are not exposed.

## Legacy API deprecation

QuickFile has announced that its legacy XML/JSON API will stop accepting
requests on 1 June 2027. Version 3.0.0 and later of this project already use the
replacement REST API exclusively. Installations upgrading from version 2 or
earlier must replace legacy account-number, MD5, and Application ID credentials
with personal bearer tokens and grant the required REST endpoint groups.

## QuickFile's hosted MCP server

QuickFile also provides an official hosted MCP server documented at
<https://support.quickfile.co.uk/t/public-mcp-server/65504>. It is the simplest
choice for temporary, read-only access and uses a seven-day key in its connector
URL.

This project remains useful when an integration needs explicit multi-account
routing, persistent secret-manager injection, local CLI access, or confirmed
write operations. Exact `quickfile_rest_*` tools expose every operation in the
current REST v2 schema, including journals, ledgers, inventory, payments,
projects, purchase orders, contacts, and recurring invoice templates. Their
arguments follow the published snake_case schema under `pathParams`, `query`,
`body`, or `formData`; use `describe` to inspect an operation before calling it.

## Development

Use `npm run dev` only during active source development: it starts a persistent
`tsx watch` process. Long-lived MCP clients must use `npm start` after
`npm run build` so they run the compiled output without a watcher.

```bash
nvm use
npm run check:runtime
npm run check:rest
npm run generate:rest
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run build
```

`npm run check:rest` compares the reviewed
`src/generated/rest-operations.json` snapshot with the live published REST v2
schema. If it reports drift, run `npm run generate:rest`, then review the
operation count, request fields, confirmation classification, and wire-shape
tests before committing.

Read-only live verification accepts one or more injected account tokens:

```bash
npm run test:integration
```

Integration tests call account details and read-only collection endpoints. They
do not create, update, send, upload, or delete accounting records.

## Security

- Tokens are read from the process environment and never logged.
- No plaintext credential file is created by this project.
- Debug logging includes the account alias and URL path, but not authorization
  headers, query values, request bodies, or response bodies.
- Destructive tool descriptions require confirmation by the calling agent.
- QuickFile response fields are untrusted external content and are sanitized
  before being returned over MCP.
- Personal bearer tokens should use least-privilege endpoint groups and optional
  expiry/IP restrictions where appropriate.

## Rate limits and beta status

The REST API is currently beta. QuickFile documents a default rolling 24-hour
limit of 5,000 requests per token. Treat `429` as a wait state and avoid bursty
parallel requests.

## License

MIT — see [LICENSE](LICENSE).

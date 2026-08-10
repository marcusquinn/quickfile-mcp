# QuickFile MCP Server

Model Context Protocol server for QuickFile UK accounting, using the beta REST
API with personal bearer tokens and explicit multi-account selection.

## Features

- 37 tools for accounts, clients, invoices, purchases, suppliers, banking,
  reports, and document uploads
- QuickFile beta REST API bearer-token authentication
- Multiple QuickFile entities in one MCP process
- Required `account` argument on every tool to prevent cross-entity mistakes
- Environment-only token loading for secret-manager injection
- Sanitization of user-controlled accounting data before MCP output

QuickFile REST API documentation: https://api-beta.quickfile.co.uk/api-docs/

## Install

```bash
git clone https://github.com/marcusquinn/quickfile-mcp.git
cd quickfile-mcp
nvm install
nvm use
corepack enable
npm ci
npm run build
```

Requires the exact Node.js version in [`.nvmrc`](.nvmrc) (currently 24.19.0)
and npm 11.17.0. The repository declares npm through `packageManager`; use
Corepack to select it before installing dependencies.

## Authentication

Generate a **personal bearer token** in QuickFile under:

`Account Settings → Third Party Integration → API`

Grant only the endpoint groups the account needs. Personal REST tokens do not
use the legacy account-number, MD5, or Application ID authentication fields.

Inject each token as an account-specific environment variable:

```bash
export QUICKFILE_BUSINESS_API_KEY="<personal-bearer-token>"
export QUICKFILE_PERSONAL_API_KEY="<personal-bearer-token>"
```

The aliases become the values accepted by every tool's required `account`
parameter (`business` and `personal` in this example). Hyphens normalize to
underscores. `BEARER_TOKEN` and `API_TOKEN` suffixes are also accepted, but
`API_KEY` preserves compatibility with common secret-store naming.

### aidevops secret storage

Store values using hidden terminal input; never paste them into chat or config:

```bash
aidevops secret set QUICKFILE_BUSINESS_API_KEY
aidevops secret set QUICKFILE_PERSONAL_API_KEY
```

Build once, then launch the compiled MCP while injecting only the required
tokens:

```bash
aidevops secret QUICKFILE_BUSINESS_API_KEY QUICKFILE_PERSONAL_API_KEY -- \
  npm start
```

Optional VAT posture can be set per account:

```bash
export QUICKFILE_BUSINESS_VAT_REGISTERED=true
export QUICKFILE_PERSONAL_VAT_REGISTERED=false
```

When no VAT posture is configured, invoice and purchase creation requires an
explicit `vatPercentage` on every line.

## MCP client configuration

Configure the client to run the secret-manager command rather than embedding
tokens in JSON. Generic command shape:

```text
aidevops secret <TOKEN_NAME> [<TOKEN_NAME>...] -- npm start
```

Run `./setup.sh client` for runtime-specific guidance. Restart the MCP client
after changing its process environment or secret injection command.

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

## Tool groups

| Group | Tools |
|---|---|
| System | Account details, event log |
| Clients | Search, get, create, update, delete, contacts, login URL |
| Invoices | Search, get, create, delete, send, PDF URL |
| Purchases | Search, get, create, delete |
| Suppliers | Search, get, create, update, delete |
| Banking | Accounts, balances, transactions, account creation |
| Reports | P&L, balance sheet, VAT, ageing, chart, subscriptions |
| Documents | Receipt and sales-attachment uploads |

Invoice creation supports invoice, estimate, and credit document types. The
REST beta API does not currently advertise the legacy create-note,
estimate-accept/decline, or estimate-conversion endpoints, so those legacy-only
tools are not exposed.

## Development

Use `npm run dev` only during active source development: it starts a persistent
`tsx watch` process. Long-lived MCP clients must use `npm start` after
`npm run build` so they run the compiled output without a watcher.

```bash
nvm use
npm run check:runtime
npm run typecheck
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm run build
```

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

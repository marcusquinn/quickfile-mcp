# QuickFile MCP - AI Assistant Guide

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Purpose**: MCP server for QuickFile UK accounting software (invoices, clients, purchases, banking, reports)
- **API**: QuickFile JSON API v1.2 at `https://api.quickfile.co.uk/1_2/{method}`
- **Auth**: MD5 hash of `AccountNumber + APIKey + SubmissionNumber`
- **Credentials**: `~/.config/.quickfile-mcp/credentials.json` (600 perms)
- **Tools**: 37 MCP tools across 7 categories

**Tool Categories**:

| Category | Prefix | Tools |
|----------|--------|-------|
| System | `quickfile_system_` | get_account, search_events, create_note |
| Clients | `quickfile_client_` | search, get, create, update, delete, insert_contacts, login_url |
| Invoices | `quickfile_invoice_` | search, get, create, delete, send, get_pdf |
| Estimates | `quickfile_estimate_` | accept_decline, convert_to_invoice |
| Purchases | `quickfile_purchase_` | search, get, create, delete |
| Suppliers | `quickfile_supplier_` | search, get, create, delete |
| Banking | `quickfile_bank_` | get_accounts, get_balances, search, create_account, create_transaction |
| Reports | `quickfile_report_` | profit_loss, balance_sheet, vat_obligations, ageing, chart_of_accounts, subscriptions |

**Common Operations**:

```
# Account info
quickfile_system_get_account

# Find clients
quickfile_client_search { companyName: "Smith" }

# Recent invoices
quickfile_invoice_search { dateFrom: "2024-01-01", status: "UNPAID" }

# Financial reports
quickfile_report_profit_loss { startDate: "2024-01-01", endDate: "2024-12-31" }
```

<!-- AI-CONTEXT-END -->

## Overview

This MCP server provides AI assistants with complete access to QuickFile accounting operations. It's designed for UK businesses using QuickFile for their bookkeeping.

## Authentication

QuickFile uses MD5 hash-based authentication:

```
MD5Value = MD5(AccountNumber + APIKey + SubmissionNumber)
```

- **Account Number**: Your QuickFile account ID (visible in dashboard)
- **API Key**: Static key from Account Settings → API Key
- **Submission Number**: Auto-generated unique ID per request
- **Application ID**: UUID from your registered QuickFile app

## Credential Storage

Credentials are stored in `~/.config/.quickfile-mcp/credentials.json`:

```json
{
  "accountNumber": "1234567890",
  "apiKey": "XXXX-XXXX-XXXX",
  "applicationId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Security Requirements**:
- File permissions: 600 (owner read/write only)
- Never commit to version control
- Never expose in logs or output

## Tool Documentation

### System Tools

#### `quickfile_system_get_account`
Returns account details including company name, VAT status, year end date, and contact information.

**Use when**: Starting a session to understand the account context.

#### `quickfile_system_search_events`
Searches the system event log for audit trail.

**Parameters**:
- `eventType`: Filter by event type
- `dateFrom`, `dateTo`: Date range (YYYY-MM-DD)
- `relatedId`, `relatedType`: Filter by related entity

#### `quickfile_system_create_note`
Attaches a note to an invoice, purchase, client, or supplier.

**Parameters**:
- `entityType`: INVOICE, PURCHASE, CLIENT, or SUPPLIER
- `entityId`: The entity's ID
- `noteText`: The note content

### Client Tools

#### `quickfile_client_search`
Searches for clients by various criteria.

**Parameters**:
- `companyName`: Partial match on company name
- `contactName`: Search by contact name
- `email`: Search by email
- `postcode`: Search by postcode
- `returnCount`: Results per page (default: 25)
- `offset`: Pagination offset

#### `quickfile_client_create`
Creates a new client record.

**Key Parameters**:
- `companyName`: Company or individual name
- `firstName`, `lastName`: Contact name
- `email`, `telephone`, `mobile`: Contact details
- `address1`, `town`, `postcode`, `country`: Address
- `vatNumber`: VAT registration
- `currency`: Default currency (GBP)
- `termDays`: Payment terms (default: 30)

### Invoice Tools

#### `quickfile_invoice_create`
Creates invoices, estimates, or credit notes.

**Parameters**:
- `invoiceType`: INVOICE, ESTIMATE, or CREDIT
- `clientId`: Client ID
- `lines`: Array of line items with description, unitCost, quantity, vatPercentage

**Example**:
```json
{
  "invoiceType": "INVOICE",
  "clientId": 12345,
  "lines": [
    { "description": "Consulting services", "unitCost": 100.00, "quantity": 8, "vatPercentage": 20 }
  ]
}
```

#### `quickfile_invoice_send`
Sends invoice by email.

**Parameters**:
- `invoiceId`: Invoice to send
- `emailTo`: Override recipient (optional)
- `emailSubject`, `emailBody`: Custom email content
- `attachPdf`: Attach PDF (default: true)

### Report Tools

#### `quickfile_report_profit_loss`
Generates P&L for a date range.

**Parameters**:
- `startDate`: Period start (YYYY-MM-DD)
- `endDate`: Period end (YYYY-MM-DD)

#### `quickfile_report_balance_sheet`
Balance sheet as at a specific date.

**Parameters**:
- `reportDate`: Report date (YYYY-MM-DD)

#### `quickfile_report_vat_obligations`
Lists VAT returns (open and filed).

**Parameters**:
- `status`: O (Open), F (Filed), or ALL

#### `quickfile_report_ageing`
Debtor or creditor ageing report.

**Parameters**:
- `reportType`: DEBTOR (owed to you) or CREDITOR (you owe)
- `asAtDate`: Report date (default: today)

## Common Workflows

### Check Account Status
```
1. quickfile_system_get_account
2. quickfile_report_profit_loss (current year)
3. quickfile_report_ageing (DEBTOR)
```

### Create and Send Invoice
```
1. quickfile_client_search (find client)
2. quickfile_invoice_create (create invoice)
3. quickfile_invoice_send (email to client)
```

### Record Purchase
```
1. quickfile_supplier_search (find or create supplier)
2. quickfile_purchase_create (record purchase)
```

### Financial Review
```
1. quickfile_report_profit_loss
2. quickfile_report_balance_sheet
3. quickfile_report_vat_obligations
4. quickfile_report_ageing (both DEBTOR and CREDITOR)
```

## API Response Patterns

**Important**: The QuickFile API has inconsistent response structures. The MCP server handles these automatically, but developers should be aware:

### Search Endpoints
Most search endpoints return data in this structure:
```json
{
  "RecordsetCount": 154,
  "ReturnCount": 25,
  "Record": [ ... ]
}
```

**Affected endpoints**: `Client_Search`, `Invoice_Search`, `Supplier_Search`, `Purchase_Search`

### Bank Accounts
Returns a direct array (not nested):
```json
{
  "BankAccounts": [ ... ]
}
```

### Bank Transactions
Uses nested structure:
```json
{
  "Transactions": {
    "Transaction": [ ... ]
  }
}
```

### Chart of Accounts
Uses `Ledger_GetNominalLedgers` (not `Report_ChartOfAccounts`):
```json
{
  "Nominals": {
    "Nominal": [ ... ]
  }
}
```

### Subscriptions
Requires `noBody` option - doesn't accept a Body element in the request.

### VAT Obligations
Only available for VAT-registered accounts with MTD configured. Requires `AccountType` parameter.

## Error Handling

API errors return structured responses:
- `QuickFile API Error [CODE]: Message`

Common error codes:
- `INVALID_AUTH`: Authentication failed (check credentials)
- `TIMEOUT`: Request timed out
- `NETWORK_ERROR`: Connection issues
- `400 Bad Request`: Usually indicates wrong request structure or missing required fields

## Rate Limits

QuickFile default: **1000 API calls per day**

Tips for staying within limits:
- Use search with pagination rather than fetching all records
- Cache frequently accessed data (e.g., chart of accounts)
- Batch operations when possible

## Development

### Project Structure
```
src/
├── index.ts           # MCP server
├── api/
│   ├── auth.ts        # MD5 authentication
│   └── client.ts      # HTTP client
├── tools/             # Tool implementations
└── types/             # TypeScript types
```

### Building
```bash
npm install
npm run build
npm run dev  # Development with auto-reload
```

### Testing
```bash
npm test
npm run typecheck
npm run lint
```

## Related Resources

- [QuickFile API Docs](https://api.quickfile.co.uk/)
- [QuickFile Sandbox](https://www.quickfile.co.uk/WebServices/API/authenticate.aspx)
- [API Testing Guide](https://community.quickfile.co.uk/t/testing-the-api-beginners-guide/501)

# QuickFile MCP Server

**Model Context Protocol server for QuickFile UK accounting software - giving AI assistants full access to invoicing, clients, purchases, banking, and financial reporting.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-0.1.0-blue)](https://github.com/marcusquinn/quickfile-mcp/releases)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![AGENTS.md](https://img.shields.io/badge/AGENTS.md-Compliant-blue.svg)](https://agents.md/)
[![QuickFile](https://img.shields.io/badge/QuickFile-API%20v1.2-blue.svg)](https://api.quickfile.co.uk/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Features

- **40+ MCP Tools** for complete QuickFile API coverage
- **Client Management**: Create, search, update, delete clients and contacts
- **Invoicing**: Create invoices, estimates, credit notes; send by email; get PDF
- **Purchases**: Record and manage purchase invoices from suppliers
- **Supplier Management**: Full supplier CRUD operations
- **Banking**: Bank accounts, transactions, balances
- **Financial Reports**: Profit & Loss, Balance Sheet, VAT obligations, Ageing reports
- **System Operations**: Account details, event log, notes

## Quick Start

### 1. Clone and Install

```bash
cd ~/git
git clone https://github.com/marcusquinn/quickfile-mcp.git
cd quickfile-mcp
npm install
npm run build
```

### 2. Configure Credentials

Create your QuickFile API credentials:

```bash
mkdir -p ~/.config/.quickfile-mcp
cat > ~/.config/.quickfile-mcp/credentials.json << 'EOF'
{
  "accountNumber": "YOUR_ACCOUNT_NUMBER",
  "apiKey": "YOUR_API_KEY",
  "applicationId": "YOUR_APPLICATION_ID"
}
EOF
chmod 600 ~/.config/.quickfile-mcp/credentials.json
```

**Where to find these:**
1. **Account Number**: Visible in top-right corner of QuickFile dashboard
2. **API Key**: Account Settings → 3rd Party Integrations → API Key
3. **Application ID**: Account Settings → Create a QuickFile App → copy the Application ID

### 3. Configure OpenCode

Add to your `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "quickfile": {
      "type": "local",
      "command": ["node", "/path/to/quickfile-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

Or use the setup script:

```bash
./setup.sh install
```

### 4. Start Using

Restart OpenCode and try:

```
"Show me my QuickFile account details"
"List my recent invoices"
"Search for clients named 'Smith'"
"Get the profit and loss report for this year"
```

## Available Tools

### System (3 tools)
| Tool | Description |
|------|-------------|
| `quickfile_system_get_account` | Get account details (company, VAT status, year end) |
| `quickfile_system_search_events` | Search the audit event log |
| `quickfile_system_create_note` | Add notes to invoices, clients, etc. |

### Clients (7 tools)
| Tool | Description |
|------|-------------|
| `quickfile_client_search` | Search clients by name, email, postcode |
| `quickfile_client_get` | Get full client details |
| `quickfile_client_create` | Create a new client |
| `quickfile_client_update` | Update client details |
| `quickfile_client_delete` | Delete a client |
| `quickfile_client_insert_contacts` | Add contacts to a client |
| `quickfile_client_login_url` | Get passwordless login URL for client portal |

### Invoices (8 tools)
| Tool | Description |
|------|-------------|
| `quickfile_invoice_search` | Search invoices by type, client, date, status |
| `quickfile_invoice_get` | Get full invoice with line items |
| `quickfile_invoice_create` | Create invoice, estimate, or credit note |
| `quickfile_invoice_delete` | Delete an invoice |
| `quickfile_invoice_send` | Send invoice by email |
| `quickfile_invoice_get_pdf` | Get PDF download URL |
| `quickfile_estimate_accept_decline` | Accept or decline an estimate |
| `quickfile_estimate_convert_to_invoice` | Convert estimate to invoice |

### Purchases (4 tools)
| Tool | Description |
|------|-------------|
| `quickfile_purchase_search` | Search purchase invoices |
| `quickfile_purchase_get` | Get purchase details |
| `quickfile_purchase_create` | Create purchase invoice |
| `quickfile_purchase_delete` | Delete purchase invoice |

### Suppliers (4 tools)
| Tool | Description |
|------|-------------|
| `quickfile_supplier_search` | Search suppliers |
| `quickfile_supplier_get` | Get supplier details |
| `quickfile_supplier_create` | Create a new supplier |
| `quickfile_supplier_delete` | Delete a supplier |

### Banking (5 tools)
| Tool | Description |
|------|-------------|
| `quickfile_bank_get_accounts` | List all bank accounts |
| `quickfile_bank_get_balances` | Get account balances |
| `quickfile_bank_search` | Search transactions |
| `quickfile_bank_create_account` | Create a bank account |
| `quickfile_bank_create_transaction` | Add bank transaction |

### Reports (6 tools)
| Tool | Description |
|------|-------------|
| `quickfile_report_profit_loss` | Profit & Loss report |
| `quickfile_report_balance_sheet` | Balance Sheet report |
| `quickfile_report_vat_obligations` | VAT returns (filed & open) |
| `quickfile_report_ageing` | Debtor/Creditor ageing |
| `quickfile_report_chart_of_accounts` | List nominal codes |
| `quickfile_report_subscriptions` | Recurring subscriptions |

## API Rate Limits

QuickFile has a default limit of **1000 API calls per day** per account. Contact QuickFile support if you need this increased.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode (with auto-reload)
npm run dev

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Debug API calls (shows request/response)
QUICKFILE_DEBUG=1 node dist/index.js
```

## Contributing

### QuickFile API Documentation

The QuickFile API has strict requirements for element ordering and required fields. When contributing:

1. **Always check the official API schema** at https://api.quickfile.co.uk/
2. **Use Context7 for AI-assisted development**: https://context7.com/websites/api_quickfile_co_uk
   - Context7 has indexed the full QuickFile API documentation
   - Use it to query exact field names, required parameters, and element ordering
   - Example: "What are the required fields for Purchase_Search?"

### Key API Quirks

- **Element ordering matters** - XML schema validation requires specific field order
- **Required fields vary by endpoint** - `OrderResultsBy` and `OrderDirection` are required for most search endpoints
- **Field naming is inconsistent** - e.g., `FromDate`/`ToDate` vs `DateFrom`/`DateTo`
- **SearchParameters wrapper** - Most endpoints need this wrapper around query params
- **NominalCode types** - Sometimes string, sometimes int (check schema)

## Architecture

```
quickfile-mcp/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── api/
│   │   ├── auth.ts        # MD5 authentication
│   │   └── client.ts      # HTTP client
│   ├── tools/
│   │   ├── index.ts       # Tool registry
│   │   ├── system.ts      # System tools
│   │   ├── client.ts      # Client tools
│   │   ├── invoice.ts     # Invoice tools
│   │   ├── purchase.ts    # Purchase tools
│   │   ├── supplier.ts    # Supplier tools
│   │   ├── bank.ts        # Bank tools
│   │   └── report.ts      # Report tools
│   └── types/
│       └── quickfile.ts   # TypeScript types
├── .agent/                # AI assistant documentation
├── .opencode/agent/       # OpenCode agent files
└── tests/                 # Test suite
```

## Credential Security

- Credentials stored in `~/.config/.quickfile-mcp/credentials.json`
- File permissions should be 600 (owner read/write only)
- **Never commit credentials to version control**
- API key provides full access - treat it like a password
- **Secretlint** runs automatically on pre-commit to prevent accidental secret exposure
- Run `npm run secretlint` manually to scan for secrets

## Related Projects

- [QuickFile](https://www.quickfile.co.uk/) - UK accounting software
- [QuickFile API Documentation](https://api.quickfile.co.uk/)
- [AI DevOps Framework](https://github.com/marcusquinn/aidevops) - Comprehensive AI infrastructure management

## License

MIT License - see [LICENSE](LICENSE) file for details.

**Created by Marcus Quinn** - Copyright © 2025

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-11-30

### Added

- Initial release of QuickFile MCP Server
- **System Tools**: Get account details, search events, create notes
- **Client Tools**: Search, get, create, update, delete clients; manage contacts; get login URLs
- **Invoice Tools**: Search, get, create, delete invoices; send by email; get PDF; estimate operations
- **Purchase Tools**: Search, get, create, delete purchase invoices
- **Supplier Tools**: Search, get, create, delete suppliers
- **Bank Tools**: Get accounts, balances, search transactions; create accounts and transactions
- **Report Tools**: Profit & Loss, Balance Sheet, VAT obligations, Ageing, Chart of Accounts, Subscriptions
- MD5-based authentication following QuickFile API v1.2 specification
- Secure credential storage at `~/.config/.quickfile-mcp/credentials.json`
- Setup script for installation and OpenCode integration
- Comprehensive documentation (README, AGENTS.md, agent files)
- OpenCode agent configuration
- TypeScript implementation with strict type checking

### Security

- Credentials stored with 600 permissions
- API key never exposed in logs or output
- Submission numbers auto-generated to prevent replay attacks

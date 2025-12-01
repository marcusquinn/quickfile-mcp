# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-12-01

### Added

- **Expanded Unit Test Suite**: 201 tests (up from 118) with 95.85% code coverage
  - `tests/unit/client.test.ts` - New: QuickFileApiClient, QuickFileApiError, singleton management
  - `tests/unit/auth.test.ts` - Added: loadCredentials tests with file mocking
  - `tests/unit/schemas.test.ts` - Added: Additional schema edge cases (OptionalDateSchema, ClientUpdateSchema, InvoiceGetSchema, BankSearchSchema, BalanceSheetSchema, error message formatting)

### Fixed

- README typo: "multicurrencyaccounting" → "accounting"

## [1.0.0] - 2024-12-01

### Added

- **ESLint Configuration**: Comprehensive `.eslintrc.json` with TypeScript strict rules
- **Zod Validation Schemas**: Runtime input validation for all tool arguments (`src/tools/schemas.ts`)
- **Shared Utilities Module**: Centralized error handling, logging, and helper functions (`src/tools/utils.ts`)
- **Structured Logger**: Level-aware logging (info/warn/error/debug) that respects `QUICKFILE_DEBUG` env var
- **Unit Test Suite**: 118 tests covering utilities, schemas, and authentication
  - `tests/unit/auth.test.ts` - MD5 hash generation, credential validation
  - `tests/unit/utils.test.ts` - Error handling, response formatting
  - `tests/unit/schemas.test.ts` - All Zod validation schemas
- **Integration Test Suite**: 16 tests verifying real API connectivity
  - `tests/integration/api.test.ts` - All major API endpoints tested

### Changed

- **Refactored All Tool Handlers**: Reduced code duplication by ~35% using shared utilities
- **Improved Error Handling**: Centralized `handleToolError()` replaces duplicate try/catch blocks
- **Updated Jest Configuration**: Added ESM module mapping, relaxed TypeScript for tests

### Security

- **Debug Log Redaction**: Sensitive authentication data (account number, MD5 hash) now redacted in debug output
- **MD5 Documentation**: Added comprehensive security documentation explaining API-mandated MD5 usage

### Fixed

- **ESLint Compliance**: All if statements now use curly braces
- **Variable Shadowing**: Renamed `client` to `apiClient` in tool handlers to avoid conflicts

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

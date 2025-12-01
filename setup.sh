#!/bin/bash
# =============================================================================
# QuickFile MCP Server - Setup Script
# =============================================================================
# Installation and configuration helper for QuickFile MCP server
#
# Usage: ./setup.sh [command]
# Commands:
#   install     - Install dependencies and build
#   configure   - Configure credentials interactively
#   opencode    - Add to OpenCode configuration
#   status      - Show current configuration status
#   help        - Show this help
#
# Version: 0.1.0
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDENTIALS_DIR="$HOME/.config/.quickfile-mcp"
CREDENTIALS_FILE="$CREDENTIALS_DIR/credentials.json"
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  QuickFile MCP Server Setup${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    return 0
}

print_success() {
    local message="$1"
    echo -e "${GREEN}✓${NC} ${message}"
    return 0
}

print_warning() {
    local message="$1"
    echo -e "${YELLOW}⚠${NC} ${message}"
    return 0
}

print_error() {
    local message="$1"
    echo -e "${RED}✗${NC} ${message}"
    return 0
}

print_info() {
    local message="$1"
    echo -e "${BLUE}ℹ${NC} ${message}"
    return 0
}

check_requirements() {
    local errors=0

    # Check Node.js
    if command -v node &>/dev/null; then
        local node_version
        node_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [[ "$node_version" -ge 18 ]]; then
            print_success "Node.js $(node --version) found"
        else
            print_error "Node.js 18+ required (found $(node --version))"
            errors=$((errors + 1))
        fi
    else
        print_error "Node.js not found"
        errors=$((errors + 1))
    fi

    # Check npm
    if command -v npm &>/dev/null; then
        print_success "npm $(npm --version) found"
    else
        print_error "npm not found"
        errors=$((errors + 1))
    fi

    return $errors
}

install_dependencies() {
    print_info "Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install
    print_success "Dependencies installed"
    return 0
}

build_project() {
    print_info "Building TypeScript..."
    cd "$SCRIPT_DIR"
    npm run build
    print_success "Build complete"
    return 0
}

configure_credentials() {
    print_header
    echo "Configure QuickFile API Credentials"
    echo ""
    echo "You'll need the following from your QuickFile account:"
    echo "  1. Account Number (visible in top-right of dashboard)"
    echo "  2. API Key (Account Settings → 3rd Party Integrations)"
    echo "  3. Application ID (Account Settings → Create a QuickFile App)"
    echo ""

    # Create directory if needed
    mkdir -p "$CREDENTIALS_DIR"

    # Read existing values if file exists
    local existing_account=""
    local existing_key=""
    local existing_app=""

    if [[ -f "$CREDENTIALS_FILE" ]]; then
        existing_account=$(grep -o '"accountNumber"[[:space:]]*:[[:space:]]*"[^"]*"' "$CREDENTIALS_FILE" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/' || echo "")
        existing_key=$(grep -o '"apiKey"[[:space:]]*:[[:space:]]*"[^"]*"' "$CREDENTIALS_FILE" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/' || echo "")
        existing_app=$(grep -o '"applicationId"[[:space:]]*:[[:space:]]*"[^"]*"' "$CREDENTIALS_FILE" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/' || echo "")
    fi

    # Prompt for values
    read -r -p "Account Number [$existing_account]: " account_number
    account_number="${account_number:-$existing_account}"

    read -r -p "API Key [$existing_key]: " api_key
    api_key="${api_key:-$existing_key}"

    read -r -p "Application ID [$existing_app]: " application_id
    application_id="${application_id:-$existing_app}"

    # Validate inputs
    if [[ -z "$account_number" || -z "$api_key" || -z "$application_id" ]]; then
        print_error "All fields are required"
        return 1
    fi

    # Write credentials file
    cat > "$CREDENTIALS_FILE" << EOF
{
  "accountNumber": "$account_number",
  "apiKey": "$api_key",
  "applicationId": "$application_id"
}
EOF

    # Set secure permissions
    chmod 600 "$CREDENTIALS_FILE"

    print_success "Credentials saved to $CREDENTIALS_FILE"
    print_info "File permissions set to 600"

    return 0
}

setup_opencode() {
    print_info "Configuring OpenCode integration..."

    # Check if OpenCode config exists
    if [[ ! -f "$OPENCODE_CONFIG" ]]; then
        print_warning "OpenCode config not found at $OPENCODE_CONFIG"
        print_info "Creating minimal config..."
        mkdir -p "$(dirname "$OPENCODE_CONFIG")"
        echo '{"mcp": {}}' > "$OPENCODE_CONFIG"
    fi

    # Check if jq is available
    if ! command -v jq &>/dev/null; then
        print_warning "jq not found - please add manually to $OPENCODE_CONFIG:"
        echo ""
        echo '  "mcp": {'
        echo '    "quickfile": {'
        echo '      "type": "local",'
        echo "      \"command\": [\"node\", \"$SCRIPT_DIR/dist/index.js\"],"
        echo '      "enabled": true'
        echo '    }'
        echo '  }'
        echo ""
        return 0
    fi

    # Add or update quickfile MCP configuration
    local tmp_file
    tmp_file=$(mktemp)

    jq --arg cmd "$SCRIPT_DIR/dist/index.js" '
        .mcp.quickfile = {
            "type": "local",
            "command": ["node", $cmd],
            "enabled": true
        }
    ' "$OPENCODE_CONFIG" > "$tmp_file" && mv "$tmp_file" "$OPENCODE_CONFIG"

    print_success "OpenCode configuration updated"
    print_info "Restart OpenCode to load the new MCP server"

    return 0
}

create_opencode_agent() {
    local opencode_agent_dir="$HOME/.config/opencode/agent"
    mkdir -p "$opencode_agent_dir"

    # Create agent file
    cat > "$opencode_agent_dir/quickfile.md" << 'AGENT_EOF'
---
description: QuickFile UK accounting - invoices, clients, purchases, banking, reports
mode: subagent
temperature: 0.1
tools:
  quickfile_*: true
---

# QuickFile Agent

Specialized agent for QuickFile UK accounting operations.

## Reference Documentation

Read `~/git/quickfile-mcp/AGENTS.md` for complete operational guidance.

## Available Tools

- **System**: quickfile_system_get_account, search_events, create_note
- **Clients**: quickfile_client_search, get, create, update, delete
- **Invoices**: quickfile_invoice_search, get, create, delete, send, get_pdf
- **Purchases**: quickfile_purchase_search, get, create, delete
- **Suppliers**: quickfile_supplier_search, get, create, delete
- **Banking**: quickfile_bank_get_accounts, get_balances, search, create_account
- **Reports**: quickfile_report_profit_loss, balance_sheet, vat_obligations, ageing

## Security

Credentials stored in `~/.config/.quickfile-mcp/credentials.json`
AGENT_EOF

    print_success "Created OpenCode agent at $opencode_agent_dir/quickfile.md"
    return 0
}

show_status() {
    print_header

    # Check credentials
    echo "Credentials:"
    if [[ -f "$CREDENTIALS_FILE" ]]; then
        local perms
        perms=$(stat -f "%Lp" "$CREDENTIALS_FILE" 2>/dev/null || stat -c "%a" "$CREDENTIALS_FILE" 2>/dev/null)
        if [[ "$perms" == "600" ]]; then
            print_success "Credentials file exists with correct permissions (600)"
        else
            print_warning "Credentials file exists but permissions are $perms (should be 600)"
        fi

        # Check if credentials are complete
        if grep -q '"accountNumber"' "$CREDENTIALS_FILE" && \
           grep -q '"apiKey"' "$CREDENTIALS_FILE" && \
           grep -q '"applicationId"' "$CREDENTIALS_FILE"; then
            print_success "All credential fields present"
        else
            print_warning "Some credential fields may be missing"
        fi
    else
        print_warning "Credentials file not found at $CREDENTIALS_FILE"
    fi

    echo ""

    # Check build
    echo "Build Status:"
    if [[ -f "$SCRIPT_DIR/dist/index.js" ]]; then
        print_success "Built (dist/index.js exists)"
    else
        print_warning "Not built - run './setup.sh install'"
    fi

    echo ""

    # Check OpenCode
    echo "OpenCode Integration:"
    if [[ -f "$OPENCODE_CONFIG" ]] && grep -q "quickfile" "$OPENCODE_CONFIG" 2>/dev/null; then
        print_success "Configured in OpenCode"
    else
        print_warning "Not configured in OpenCode - run './setup.sh opencode'"
    fi

    if [[ -f "$HOME/.config/opencode/agent/quickfile.md" ]]; then
        print_success "Agent file exists"
    else
        print_warning "Agent file not found"
    fi

    echo ""
    return 0
}

show_help() {
    cat << 'HELP_EOF'
QuickFile MCP Server - Setup Script

Usage: ./setup.sh [command]

Commands:
  install     Install dependencies and build the project
  configure   Configure QuickFile API credentials interactively
  opencode    Add MCP server to OpenCode configuration
  status      Show current configuration status
  help        Show this help message

Quick Start:
  1. ./setup.sh install     # Install and build
  2. ./setup.sh configure   # Set up credentials
  3. ./setup.sh opencode    # Configure OpenCode
  4. Restart OpenCode

Credentials are stored securely at:
  ~/.config/.quickfile-mcp/credentials.json

For more information:
  https://github.com/marcusquinn/quickfile-mcp
  https://api.quickfile.co.uk/

HELP_EOF
    return 0
}

main() {
    local command="${1:-help}"

    case "$command" in
        install)
            print_header
            check_requirements || exit 1
            install_dependencies
            build_project
            echo ""
            print_success "Installation complete!"
            print_info "Next: Run './setup.sh configure' to set up credentials"
            ;;
        configure)
            configure_credentials
            ;;
        opencode)
            print_header
            setup_opencode
            create_opencode_agent
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac

    return 0
}

main "$@"

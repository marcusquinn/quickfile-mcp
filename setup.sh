#!/bin/bash
# QuickFile MCP REST setup helper

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
	cat <<'HELP'
QuickFile MCP setup

Usage: ./setup.sh [install|configure|client|status|help]

  install    Install dependencies and build
  configure  Store one bearer token with aidevops secret management
  client     Print the secure MCP launch command shape
  status     Check build and environment-only credential configuration
  help       Show this help

QuickFile REST API docs: https://api-beta.quickfile.co.uk/api-docs/
HELP
	return 0
}

install_project() {
	local current_node_version=""
	local required_node_version=""
	command -v node >/dev/null 2>&1 || {
		printf 'Node.js is required\n' >&2
		return 1
	}
	if [[ ! -f "$SCRIPT_DIR/.nvmrc" ]]; then
		printf 'Unable to read the required Node.js version from .nvmrc\n' >&2
		return 1
	fi
	required_node_version=$(tr -d '[:space:]' <"$SCRIPT_DIR/.nvmrc")
	if ! current_node_version=$(node -p 'process.versions.node'); then
		printf 'Unable to determine the Node.js version\n' >&2
		return 1
	fi
	if [[ "$current_node_version" != "$required_node_version" ]]; then
		printf 'Node.js %s is required; found %s\n' "$required_node_version" "$current_node_version" >&2
		return 1
	fi
	command -v npm >/dev/null 2>&1 || {
		printf 'npm is required\n' >&2
		return 1
	}
	(
		cd "$SCRIPT_DIR"
		npm install
		npm run build
	)
	return 0
}

configure_token() {
	local account_alias=""
	local normalized=""
	local variable=""
	read -r -p "Account alias (for example business): " account_alias
	normalized=$(printf '%s' "$account_alias" | tr '[:lower:]-' '[:upper:]_')
	if [[ -z "$normalized" || ! "$normalized" =~ ^[A-Z0-9_]+$ ]]; then
		printf 'Alias must contain only letters, numbers, underscores, or hyphens\n' >&2
		return 1
	fi
	variable="QUICKFILE_${normalized}_API_KEY"
	if command -v aidevops >/dev/null 2>&1; then
		printf 'Storing %s using hidden input\n' "$variable"
		aidevops secret set "$variable"
	else
		printf 'aidevops is not installed. Inject %s with your secret manager.\n' "$variable"
		printf 'Do not put bearer tokens in MCP JSON or this repository.\n'
	fi
	return 0
}

show_client_command() {
	printf '%s\n' 'Configure your MCP client to launch:'
	printf '%s\n' "  aidevops secret QUICKFILE_BUSINESS_API_KEY [MORE_TOKEN_NAMES...] -- \\"
	printf '    node %s/dist/index.js\n' "$SCRIPT_DIR"
	printf '%s\n' 'Replace the example token names with your configured account aliases.'
	return 0
}

show_status() {
	local build_status="missing"
	local token_count=0
	local name=""
	if [[ -f "$SCRIPT_DIR/dist/index.js" ]]; then
		build_status="ready"
	fi
	while IFS='=' read -r name _; do
		case "$name" in
		QUICKFILE_*_API_KEY | QUICKFILE_*_API_TOKEN | QUICKFILE_*_BEARER_TOKEN)
			token_count=$((token_count + 1))
			;;
		esac
	done < <(env)
	printf 'Build: %s\n' "$build_status"
	printf 'Injected QuickFile account tokens: %s (values hidden)\n' "$token_count"
	return 0
}

main() {
	local command="$1"
	case "$command" in
	install) install_project ;;
	configure) configure_token ;;
	client) show_client_command ;;
	status) show_status ;;
	help | --help | -h) show_help ;;
	*)
		printf 'Unknown command: %s\n' "$command" >&2
		show_help
		return 1
		;;
	esac
	return 0
}

main "${1:-help}"

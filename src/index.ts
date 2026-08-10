#!/usr/bin/env node
/**
 * QuickFile MCP Server
 * Model Context Protocol server for QuickFile UK accounting software
 *
 * Provides AI assistants with tools for:
 * - Client/customer management
 * - Invoice and estimate operations
 * - Purchase invoice management
 * - Supplier management
 * - Bank account and transaction operations
 * - Financial reporting (P&L, Balance Sheet, VAT, Ageing)
 * - System operations (account details, events, notes)
 *
 * @see https://api-beta.quickfile.co.uk/api-docs/
 * @author Marcus Quinn
 * @license MIT
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { allTools, handleToolCall } from "./tools/index.js";
import {
  listConfiguredAccounts,
  loadCredentials,
  validateCredentialsFormat,
} from "./api/auth.js";

// Server metadata
const SERVER_NAME = "quickfile-mcp";
const SERVER_VERSION = "1.0.0";

/**
 * Initialize and run the MCP server
 */
async function main(): Promise<void> {
  // Validate configured account aliases on startup without exposing tokens.
  try {
    const accounts = listConfiguredAccounts();
    if (accounts.length === 0) {
      throw new Error(
        "No QuickFile bearer tokens found. Set QUICKFILE_<ACCOUNT>_API_KEY.",
      );
    }
    for (const account of accounts) {
      const credentials = loadCredentials(account);
      if (!validateCredentialsFormat(credentials)) {
        throw new Error(`Credential validation failed for account ${account}`);
      }
    }
    console.error(
      `QuickFile MCP Server starting for accounts: ${accounts.join(", ")}`,
    );
  } catch (error) {
    console.error(
      "Failed to load credentials:",
      error instanceof Error ? error.message : error,
    );
    console.error("Inject bearer tokens through the process environment.");
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error(`Tool called: ${name}`);

    try {
      const result = await handleToolCall(
        name,
        (args as Record<string, unknown>) ?? {},
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`Tool error: ${errorMessage}`);

      return {
        content: [
          {
            type: "text",
            text: `Error executing ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `${SERVER_NAME} v${SERVER_VERSION} running with ${allTools.length} tools`,
  );
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

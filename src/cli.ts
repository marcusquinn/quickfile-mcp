#!/usr/bin/env node

import { listConfiguredAccounts } from "./api/auth.js";
import { SERVER_VERSION } from "./metadata.js";
import {
  allTools,
  handleToolCall,
  requiresConfirmation,
  type ToolResult,
} from "./tools/index.js";

interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

type ToolInvoker = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<ToolResult>;

interface CallOptions {
  toolName: string;
  account: string;
  input: Record<string, unknown>;
  confirmed: boolean;
}

const defaultIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const usage = `QuickFile REST API CLI

Usage:
  quickfile accounts
  quickfile tools
  quickfile describe <tool-name>
  quickfile call <tool-name> --account <alias> [--input '<json>'] [--confirm]
  quickfile --version

Discovery and call output is JSON; help and version output is plain text.
Mutating calls require --confirm after the user has approved the operation.
Tokens are loaded only from QUICKFILE_* environment variables and must never be
passed as command arguments.`;

function writeJson(writer: (text: string) => void, value: unknown): void {
  writer(`${JSON.stringify(value, null, 2)}\n`);
}

function parseInput(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("--input must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("--input must be a JSON object");
  }
  if ("account" in parsed || "confirmed" in parsed) {
    throw new Error(
      "Set routing and confirmation with --account and --confirm, not inside --input",
    );
  }
  return parsed as Record<string, unknown>;
}

function readOptionValue(
  argv: string[],
  index: number,
  option: string,
): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function parseCallOptions(argv: string[]): CallOptions {
  const toolName = argv[0];
  if (!toolName || toolName.startsWith("--")) {
    throw new Error("call requires a tool name");
  }

  let account: string | undefined;
  let input: Record<string, unknown> = {};
  let confirmed = false;

  for (let index = 1; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--account") {
      if (account !== undefined) {
        throw new Error("call accepts exactly one --account <alias>");
      }
      account = readOptionValue(argv, index, option);
      index += 1;
    } else if (option === "--input") {
      input = parseInput(readOptionValue(argv, index, option));
      index += 1;
    } else if (option === "--confirm") {
      confirmed = true;
    } else {
      throw new Error(`Unknown call option: ${option}`);
    }
  }

  if (!account) {
    throw new Error("call requires --account <alias>");
  }

  return { toolName, account, input, confirmed };
}

function parseResultContent(result: ToolResult): unknown {
  const text = result.content.map((item) => item.text).join("\n");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function callTool(
  argv: string[],
  io: CliIo,
  invokeTool: ToolInvoker,
): Promise<number> {
  const options = parseCallOptions(argv);
  if (!allTools.some((candidate) => candidate.name === options.toolName)) {
    throw new Error(`Unknown tool: ${options.toolName}`);
  }
  if (requiresConfirmation(options.toolName) && !options.confirmed) {
    throw new Error(
      `${options.toolName} changes QuickFile data and requires --confirm`,
    );
  }

  const result = await invokeTool(options.toolName, {
    account: options.account,
    ...(options.confirmed ? { confirmed: true } : {}),
    ...options.input,
  });
  const payload = {
    ok: !result.isError,
    tool: options.toolName,
    account: options.account,
    result: parseResultContent(result),
  };
  writeJson(result.isError ? io.stderr : io.stdout, payload);
  return result.isError ? 1 : 0;
}

function listAccounts(io: CliIo): number {
  writeJson(io.stdout, { accounts: listConfiguredAccounts() });
  return 0;
}

function listTools(io: CliIo): number {
  writeJson(
    io.stdout,
    allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      confirmationRequired: requiresConfirmation(tool.name),
    })),
  );
  return 0;
}

function describeTool(argv: string[], io: CliIo): number {
  const toolName = argv[0];
  if (!toolName || argv.length !== 1) {
    throw new Error("describe requires exactly one tool name");
  }
  const tool = allTools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  writeJson(io.stdout, {
    ...tool,
    confirmationRequired: requiresConfirmation(toolName),
  });
  return 0;
}

function showHelp(io: CliIo): number {
  io.stdout(`${usage}\n`);
  return 0;
}

function showVersion(io: CliIo): number {
  io.stdout(`${SERVER_VERSION}\n`);
  return 0;
}

type CliCommand =
  | "help"
  | "version"
  | "accounts"
  | "tools"
  | "describe"
  | "call";

function normalizeCommand(command: string): CliCommand | undefined {
  if (["help", "--help", "-h"].includes(command)) {
    return "help";
  }
  if (["--version", "-v"].includes(command)) {
    return "version";
  }
  if (["accounts", "tools", "describe", "call"].includes(command)) {
    return command as CliCommand;
  }
  return undefined;
}

async function runCommand(
  command: CliCommand,
  argv: string[],
  io: CliIo,
  invokeTool: ToolInvoker,
): Promise<number> {
  switch (command) {
    case "help":
      return showHelp(io);
    case "version":
      return showVersion(io);
    case "accounts":
      return listAccounts(io);
    case "tools":
      return listTools(io);
    case "describe":
      return describeTool(argv, io);
    case "call":
      return callTool(argv, io, invokeTool);
  }
}

export async function runCli(
  argv: string[],
  io: CliIo = defaultIo,
  invokeTool: ToolInvoker = handleToolCall,
): Promise<number> {
  try {
    const [requestedCommand = "help", ...commandArgs] = argv;
    const command = normalizeCommand(requestedCommand);
    if (!command) {
      throw new Error(`Unknown command: ${requestedCommand}`);
    }
    return await runCommand(command, commandArgs, io, invokeTool);
  } catch (error) {
    writeJson(io.stderr, {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown CLI error",
    });
    return 1;
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}

export { SERVER_NAME, SERVER_VERSION } from "./metadata.js";

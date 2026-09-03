#!/usr/bin/env node

const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const SCHEMA_URL = "https://api-beta.quickfile.co.uk/api-docs/v2";
const OUTPUT_PATH = join(
  __dirname,
  "..",
  "src",
  "generated",
  "rest-operations.json",
);
const HTTP_METHODS = new Set(["get", "post", "put", "delete"]);

function cleanText(value) {
  let clean = "";
  let inTag = false;
  let pendingSpace = false;
  for (const character of String(value ?? "")) {
    if (character === "<") {
      inTag = true;
      pendingSpace = clean.length > 0;
    } else if (character === ">" && inTag) {
      inTag = false;
    } else if (!inTag && " \t\n\r\f\v".includes(character)) {
      pendingSpace = clean.length > 0;
    } else if (!inTag) {
      if (pendingSpace) {
        clean += " ";
        pendingSpace = false;
      }
      clean += character;
    }
  }
  return clean;
}

function toolName(operationId) {
  let normalized = "";
  for (let index = 0; index < operationId.length; index += 1) {
    const character = operationId[index];
    const previous = operationId[index - 1] ?? "";
    const next = operationId[index + 1] ?? "";
    const alphaNumeric = /[A-Za-z0-9]/.test(character);
    if (!alphaNumeric) {
      if (normalized && !normalized.endsWith("_")) {
        normalized += "_";
      }
      continue;
    }
    const wordBoundary =
      /[A-Z]/.test(character) &&
      (/[a-z0-9]/.test(previous) ||
        (/[A-Z]/.test(previous) && /[a-z]/.test(next)));
    if (wordBoundary && !normalized.endsWith("_")) {
      normalized += "_";
    }
    normalized += character.toLowerCase();
  }
  while (normalized.endsWith("_")) {
    normalized = normalized.slice(0, -1);
  }
  return `quickfile_rest_${normalized}`;
}

function convertSchema(schema, definitions, stack = []) {
  if (!schema || typeof schema !== "object") {
    return {};
  }
  if (schema.$ref) {
    const name = schema.$ref.replace("#/definitions/", "");
    if (!definitions[name]) {
      throw new Error(`Unknown OpenAPI definition: ${schema.$ref}`);
    }
    if (stack.includes(name)) {
      throw new Error(`Recursive OpenAPI definition is unsupported: ${name}`);
    }
    return convertSchema(definitions[name], definitions, [...stack, name]);
  }

  const converted = {};
  const scalarKeys = [
    "type",
    "format",
    "default",
    "minimum",
    "maximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "uniqueItems",
    "pattern",
  ];
  for (const key of scalarKeys) {
    if (schema[key] !== undefined) {
      converted[key] = schema[key];
    }
  }
  if (schema.description) {
    converted.description = cleanText(schema.description);
  }
  if (Array.isArray(schema.enum)) {
    converted.enum = schema.enum;
  }
  if (Array.isArray(schema.required)) {
    converted.required = schema.required;
  }
  if (schema.properties) {
    converted.type = converted.type ?? "object";
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, property]) => [
        name,
        convertSchema(property, definitions, stack),
      ]),
    );
    converted.additionalProperties = false;
  }
  if (schema.items) {
    converted.items = convertSchema(schema.items, definitions, stack);
  }
  return converted;
}

function fileSchema(description) {
  return {
    type: "object",
    description: cleanText(description || "File upload"),
    properties: {
      fileName: { type: "string", minLength: 1 },
      fileData: {
        type: "string",
        minLength: 1,
        description: "Base64-encoded file content",
      },
      mimeType: {
        type: "string",
        description: "Media type; defaults to application/octet-stream",
      },
    },
    required: ["fileName", "fileData"],
    additionalProperties: false,
  };
}

function parameterSchema(parameter, definitions) {
  if (parameter.type === "file") {
    return fileSchema(parameter.description);
  }
  if (parameter.schema) {
    return convertSchema(parameter.schema, definitions);
  }
  return convertSchema(parameter, definitions);
}

function parameterSection(parameters, location, definitions) {
  const selected = parameters.filter((parameter) => parameter.in === location);
  if (selected.length === 0) {
    return undefined;
  }
  const required = selected
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name);
  return {
    type: "object",
    properties: Object.fromEntries(
      selected.map((parameter) => [
        parameter.name,
        parameterSchema(parameter, definitions),
      ]),
    ),
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function buildInputSchema(operation, definitions) {
  const parameters = operation.parameters ?? [];
  const properties = {};
  const required = [];
  for (const [location, property] of [
    ["path", "pathParams"],
    ["query", "query"],
    ["formData", "formData"],
  ]) {
    const section = parameterSection(parameters, location, definitions);
    if (section) {
      properties[property] = section;
      if (section.required) {
        required.push(property);
      }
    }
  }

  const body = parameters.find((parameter) => parameter.in === "body");
  if (body) {
    properties.body = parameterSchema(body, definitions);
    if (body.required) {
      required.push("body");
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function buildManifest(schema) {
  if (schema.swagger !== "2.0" || schema.info?.version !== "v2") {
    throw new Error("Expected the QuickFile Swagger 2.0 v2 schema");
  }
  if (schema.host !== "api-beta.quickfile.co.uk") {
    throw new Error(`Unexpected QuickFile API host: ${schema.host}`);
  }

  const definitions = schema.definitions ?? {};
  const operations = [];
  for (const [path, pathItem] of Object.entries(schema.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation.operationId) {
        continue;
      }
      operations.push({
        name: toolName(operation.operationId),
        operationId: operation.operationId,
        group: cleanText(operation.tags?.[0] ?? "REST"),
        summary: cleanText(operation.summary || operation.operationId),
        method: method.toUpperCase(),
        path,
        inputSchema: buildInputSchema(operation, definitions),
      });
    }
  }
  operations.sort((left, right) => left.name.localeCompare(right.name));
  const names = new Set(operations.map((operation) => operation.name));
  if (names.size !== operations.length) {
    throw new Error("Generated QuickFile REST tool names are not unique");
  }

  return {
    source: SCHEMA_URL,
    schemaVersion: schema.info.version,
    operationCount: operations.length,
    operationsSha256: createHash("sha256")
      .update(JSON.stringify(operations))
      .digest("hex"),
    operations,
  };
}

async function readSchema(inputPath) {
  if (inputPath) {
    return JSON.parse(readFileSync(inputPath, "utf8"));
  }
  const response = await fetch(SCHEMA_URL);
  if (!response.ok) {
    throw new Error(`OpenAPI fetch failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const checkOnly = cliArgs.includes("--check");
  const inputPath = cliArgs.find((argument) => !argument.startsWith("--"));
  const schema = await readSchema(inputPath);
  const manifest = buildManifest(schema);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (checkOnly) {
    if (readFileSync(OUTPUT_PATH, "utf8") !== serialized) {
      throw new Error(
        "Generated REST operation snapshot is stale; run npm run generate:rest and review the changes",
      );
    }
    process.stdout.write(
      `Verified ${manifest.operationCount} QuickFile REST operations against ${manifest.schemaVersion}\n`,
    );
    return;
  }
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized);
  process.stdout.write(
    `Generated ${manifest.operationCount} QuickFile REST operations from ${manifest.schemaVersion}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "REST schema generation failed"}\n`,
  );
  process.exitCode = 1;
});

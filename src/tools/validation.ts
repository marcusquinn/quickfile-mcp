export interface JsonInputSchema {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  properties?: Record<string, JsonInputSchema>;
  required?: string[];
  items?: JsonInputSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

function hasOwn(value: Record<string, unknown>, property: string): boolean {
  return Object.hasOwn(value, property);
}

function validateType(value: unknown, type: string): boolean {
  switch (type) {
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
}

function validateString(value: string, schema: JsonInputSchema, path: string) {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return `${path} must contain at least ${schema.minLength} character(s)`;
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    return `${path} must contain at most ${schema.maxLength} character(s)`;
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    return `${path} does not match the required format`;
  }
  return undefined;
}

function validateNumber(value: number, schema: JsonInputSchema, path: string) {
  if (schema.minimum !== undefined && value < schema.minimum) {
    return `${path} must be at least ${schema.minimum}`;
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    return `${path} must be at most ${schema.maximum}`;
  }
  return undefined;
}

function validateObject(
  value: Record<string, unknown>,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (!schema.properties) {
    return undefined;
  }
  for (const required of schema.required ?? []) {
    if (!hasOwn(value, required)) {
      return `${path}.${required} is required`;
    }
  }
  for (const property of Object.keys(value)) {
    if (!hasOwn(schema.properties, property)) {
      return `${path} contains an unsupported field`;
    }
    const error = validateValue(
      value[property],
      schema.properties[property],
      `${path}.${property}`,
    );
    if (error) {
      return error;
    }
  }
  return undefined;
}

function validateArray(
  value: unknown[],
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    return `${path} must contain at least ${schema.minItems} item(s)`;
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    return `${path} must contain at most ${schema.maxItems} item(s)`;
  }
  if (
    schema.uniqueItems &&
    new Set(value.map((item) => JSON.stringify(item))).size !== value.length
  ) {
    return `${path} must not contain duplicate items`;
  }
  if (!schema.items) {
    return undefined;
  }
  for (let index = 0; index < value.length; index += 1) {
    const error = validateValue(
      value[index],
      schema.items,
      `${path}[${index}]`,
    );
    if (error) {
      return error;
    }
  }
  return undefined;
}

function validateValue(
  value: unknown,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.type && !validateType(value, schema.type)) {
    return `${path} must be of type ${schema.type}`;
  }
  if (schema.const !== undefined && !Object.is(value, schema.const)) {
    return `${path} must equal ${JSON.stringify(schema.const)}`;
  }
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    return `${path} must be one of ${schema.enum.map(String).join(", ")}`;
  }
  if (typeof value === "string") {
    return validateString(value, schema, path);
  }
  if (typeof value === "number") {
    return validateNumber(value, schema, path);
  }
  if (schema.type === "object") {
    return validateObject(value as Record<string, unknown>, schema, path);
  }
  if (schema.type === "array") {
    return validateArray(value as unknown[], schema, path);
  }

  return undefined;
}

export function validateToolInput(
  input: Record<string, unknown>,
  schema: JsonInputSchema,
): string | undefined {
  return validateValue(input, schema, "input");
}

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
  return Object.prototype.hasOwnProperty.call(value, property);
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
  if (typeof value === "string" && schema.minLength !== undefined) {
    if (value.length < schema.minLength) {
      return `${path} must contain at least ${schema.minLength} character(s)`;
    }
  }
  if (typeof value === "string" && schema.maxLength !== undefined) {
    if (value.length > schema.maxLength) {
      return `${path} must contain at most ${schema.maxLength} character(s)`;
    }
  }
  if (typeof value === "string" && schema.pattern) {
    if (!new RegExp(schema.pattern).test(value)) {
      return `${path} does not match the required format`;
    }
  }
  if (typeof value === "number" && schema.minimum !== undefined) {
    if (value < schema.minimum) {
      return `${path} must be at least ${schema.minimum}`;
    }
  }
  if (typeof value === "number" && schema.maximum !== undefined) {
    if (value > schema.maximum) {
      return `${path} must be at most ${schema.maximum}`;
    }
  }

  if (schema.type === "object" && schema.properties) {
    const object = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!hasOwn(object, required)) {
        return `${path}.${required} is required`;
      }
    }
    for (const property of Object.keys(object)) {
      if (!hasOwn(schema.properties, property)) {
        return `${path} contains an unsupported field`;
      }
      const error = validateValue(
        object[property],
        schema.properties[property],
        `${path}.${property}`,
      );
      if (error) {
        return error;
      }
    }
  }

  if (schema.type === "array" && schema.items) {
    const array = value as unknown[];
    if (schema.minItems !== undefined && array.length < schema.minItems) {
      return `${path} must contain at least ${schema.minItems} item(s)`;
    }
    if (schema.maxItems !== undefined && array.length > schema.maxItems) {
      return `${path} must contain at most ${schema.maxItems} item(s)`;
    }
    if (
      schema.uniqueItems &&
      new Set(array.map((item) => JSON.stringify(item))).size !== array.length
    ) {
      return `${path} must not contain duplicate items`;
    }
    for (let index = 0; index < array.length; index += 1) {
      const error = validateValue(
        array[index],
        schema.items,
        `${path}[${index}]`,
      );
      if (error) {
        return error;
      }
    }
  }

  return undefined;
}

export function validateToolInput(
  input: Record<string, unknown>,
  schema: JsonInputSchema,
): string | undefined {
  return validateValue(input, schema, "input");
}

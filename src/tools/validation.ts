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

type ValueValidator = (value: unknown) => boolean;

const typeValidators: Record<string, ValueValidator> = {
  object: (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value),
  array: Array.isArray,
  string: (value) => typeof value === "string",
  number: (value) => typeof value === "number" && Number.isFinite(value),
  integer: (value) => typeof value === "number" && Number.isInteger(value),
  boolean: (value) => typeof value === "boolean",
};

const accountNumberPattern = "^$|^\\d{3,10}$";
const sortCodePattern = "^$|^\\d{2}-\\d{2}-\\d{2}$";

function isAsciiDigits(
  value: string,
  minimum: number,
  maximum: number,
): boolean {
  return (
    value.length >= minimum &&
    value.length <= maximum &&
    [...value].every((character) => character >= "0" && character <= "9")
  );
}

const patternValidators: Record<string, (value: string) => boolean> = {
  [accountNumberPattern]: (value) =>
    value === "" || isAsciiDigits(value, 3, 10),
  [sortCodePattern]: (value) =>
    value === "" ||
    (value.length === 8 &&
      value[2] === "-" &&
      value[5] === "-" &&
      isAsciiDigits(value.replaceAll("-", ""), 6, 6)),
};

function hasOwn(value: Record<string, unknown>, property: string): boolean {
  return Object.hasOwn(value, property);
}

function validateType(value: unknown, type: string): boolean {
  return typeValidators[type]?.(value) ?? false;
}

function validateStringMinimum(
  value: string,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return `${path} must contain at least ${schema.minLength} character(s)`;
  }
  return undefined;
}

function validateStringMaximum(
  value: string,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    return `${path} must contain at most ${schema.maxLength} character(s)`;
  }
  return undefined;
}

function validateStringPattern(
  value: string,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.pattern && !patternValidators[schema.pattern]?.(value)) {
    return `${path} does not match the required format`;
  }
  return undefined;
}

function validateString(
  value: string,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  return (
    validateStringMinimum(value, schema, path) ??
    validateStringMaximum(value, schema, path) ??
    validateStringPattern(value, schema, path)
  );
}

function validateNumberMinimum(
  value: number,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.minimum !== undefined && value < schema.minimum) {
    return `${path} must be at least ${schema.minimum}`;
  }
  return undefined;
}

function validateNumberMaximum(
  value: number,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.maximum !== undefined && value > schema.maximum) {
    return `${path} must be at most ${schema.maximum}`;
  }
  return undefined;
}

function validateNumber(
  value: number,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  return (
    validateNumberMinimum(value, schema, path) ??
    validateNumberMaximum(value, schema, path)
  );
}

function validateRequiredProperties(
  value: Record<string, unknown>,
  requiredProperties: string[],
  path: string,
): string | undefined {
  for (const required of requiredProperties) {
    if (!hasOwn(value, required)) {
      return `${path}.${required} is required`;
    }
  }
  return undefined;
}

function validateObjectProperties(
  value: Record<string, unknown>,
  properties: Record<string, JsonInputSchema>,
  path: string,
): string | undefined {
  for (const property of Object.keys(value)) {
    if (!hasOwn(properties, property)) {
      return `${path} contains an unsupported field`;
    }
    const error = validateValue(
      value[property],
      properties[property],
      `${path}.${property}`,
    );
    if (error) {
      return error;
    }
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
  return (
    validateRequiredProperties(value, schema.required ?? [], path) ??
    validateObjectProperties(value, schema.properties, path)
  );
}

function validateArrayLength(
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
  return undefined;
}

function validateArrayUniqueness(
  value: unknown[],
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (
    schema.uniqueItems &&
    new Set(value.map((item) => JSON.stringify(item))).size !== value.length
  ) {
    return `${path} must not contain duplicate items`;
  }
  return undefined;
}

function validateArrayItems(
  value: unknown[],
  itemSchema: JsonInputSchema | undefined,
  path: string,
): string | undefined {
  if (!itemSchema) {
    return undefined;
  }
  for (let index = 0; index < value.length; index += 1) {
    const error = validateValue(value[index], itemSchema, `${path}[${index}]`);
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
  return (
    validateArrayLength(value, schema, path) ??
    validateArrayUniqueness(value, schema, path) ??
    validateArrayItems(value, schema.items, path)
  );
}

function validateDeclaredType(
  value: unknown,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.type && !validateType(value, schema.type)) {
    return `${path} must be of type ${schema.type}`;
  }
  return undefined;
}

function validateDeclaredConst(
  value: unknown,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.const !== undefined && !Object.is(value, schema.const)) {
    return `${path} must equal ${JSON.stringify(schema.const)}`;
  }
  return undefined;
}

function validateDeclaredEnum(
  value: unknown,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    return `${path} must be one of ${schema.enum.map(String).join(", ")}`;
  }
  return undefined;
}

function validateConstraints(
  value: unknown,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
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

function validateValue(
  value: unknown,
  schema: JsonInputSchema,
  path: string,
): string | undefined {
  return (
    validateDeclaredType(value, schema, path) ??
    validateDeclaredConst(value, schema, path) ??
    validateDeclaredEnum(value, schema, path) ??
    validateConstraints(value, schema, path)
  );
}

export function validateToolInput(
  input: Record<string, unknown>,
  schema: JsonInputSchema,
): string | undefined {
  return validateValue(input, schema, "input");
}

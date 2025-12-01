/**
 * QuickFile Tool Input Validation Schemas
 * Using Zod for runtime validation of tool arguments
 * 
 * This provides an additional layer of validation beyond TypeScript's
 * compile-time checking, ensuring data integrity at runtime.
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

/** Pagination parameters common to search operations */
export const PaginationSchema = z.object({
  returnCount: z.number().int().min(1).max(100).optional().default(25),
  offset: z.number().int().min(0).optional().default(0),
});

/** Order direction for search results */
export const OrderDirectionSchema = z.enum(['ASC', 'DESC']).optional().default('ASC');

/** Date string in YYYY-MM-DD format */
export const DateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
);

/** Optional date string */
export const OptionalDateSchema = DateStringSchema.optional();

// =============================================================================
// Client Schemas
// =============================================================================

export const ClientSearchSchema = PaginationSchema.extend({
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  postcode: z.string().optional(),
  orderBy: z.enum(['CompanyName', 'DateCreated', 'ClientID']).optional(),
  orderDirection: OrderDirectionSchema,
});

export const ClientGetSchema = z.object({
  clientId: z.number().int().positive('Client ID must be a positive integer'),
});

export const ClientCreateSchema = z.object({
  companyName: z.string().optional(),
  title: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  telephone: z.string().optional(),
  mobile: z.string().optional(),
  website: z.string().url().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  town: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  vatNumber: z.string().optional(),
  companyRegNo: z.string().optional(),
  currency: z.string().length(3).optional().default('GBP'),
  termDays: z.number().int().min(0).max(365).optional().default(30),
  notes: z.string().optional(),
});

export const ClientUpdateSchema = ClientCreateSchema.extend({
  clientId: z.number().int().positive('Client ID must be a positive integer'),
});

export const ClientDeleteSchema = ClientGetSchema;

// =============================================================================
// Invoice Schemas
// =============================================================================

export const InvoiceTypeSchema = z.enum(['INVOICE', 'ESTIMATE', 'RECURRING', 'CREDIT']);
export const InvoiceStatusSchema = z.enum(['DRAFT', 'SENT', 'VIEWED', 'PAID', 'PART_PAID', 'OVERDUE', 'CANCELLED']);

export const InvoiceSearchSchema = PaginationSchema.extend({
  invoiceType: InvoiceTypeSchema.optional(),
  clientId: z.number().int().positive().optional(),
  dateFrom: OptionalDateSchema,
  dateTo: OptionalDateSchema,
  status: InvoiceStatusSchema.optional(),
  searchKeyword: z.string().optional(),
  orderBy: z.enum(['InvoiceNumber', 'IssueDate', 'DueDate', 'ClientName', 'GrossAmount']).optional(),
  orderDirection: OrderDirectionSchema,
});

export const InvoiceGetSchema = z.object({
  invoiceId: z.number().int().positive('Invoice ID must be a positive integer'),
});

export const InvoiceLineSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  unitCost: z.number().min(0, 'Unit cost must be non-negative'),
  quantity: z.number().positive('Quantity must be positive'),
  vatPercentage: z.number().min(0).max(100).optional().default(20),
  nominalCode: z.string().optional(),
});

export const InvoiceCreateSchema = z.object({
  invoiceType: z.enum(['INVOICE', 'ESTIMATE', 'CREDIT']),
  clientId: z.number().int().positive('Client ID must be a positive integer'),
  currency: z.string().length(3).optional().default('GBP'),
  termDays: z.number().int().min(0).max(365).optional().default(30),
  issueDate: OptionalDateSchema,
  poNumber: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(InvoiceLineSchema).min(1, 'At least one line item is required'),
});

// =============================================================================
// Bank Schemas
// =============================================================================

export const BankNominalCodeSchema = z.string().regex(
  /^\d{4}$/,
  'Nominal code must be a 4-digit number'
);

export const BankSearchSchema = PaginationSchema.extend({
  nominalCode: BankNominalCodeSchema,
  dateFrom: OptionalDateSchema,
  dateTo: OptionalDateSchema,
  reference: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  tagged: z.boolean().optional(),
  orderBy: z.enum(['TransactionDate', 'Amount', 'Reference']).optional(),
  orderDirection: OrderDirectionSchema,
});

export const BankTransactionCreateSchema = z.object({
  nominalCode: BankNominalCodeSchema,
  transactionDate: DateStringSchema,
  amount: z.number().positive('Amount must be positive'),
  transactionType: z.enum(['MONEY_IN', 'MONEY_OUT']),
  reference: z.string().optional(),
  payeePayer: z.string().optional(),
  notes: z.string().optional(),
});

// =============================================================================
// Report Schemas
// =============================================================================

export const ProfitLossSchema = z.object({
  startDate: DateStringSchema,
  endDate: DateStringSchema,
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
);

export const BalanceSheetSchema = z.object({
  reportDate: DateStringSchema,
});

export const AgeingReportSchema = z.object({
  reportType: z.enum(['CREDITOR', 'DEBTOR']),
  asAtDate: OptionalDateSchema,
});

// =============================================================================
// System Schemas
// =============================================================================

export const CreateNoteSchema = z.object({
  entityType: z.enum(['INVOICE', 'PURCHASE', 'CLIENT', 'SUPPLIER']),
  entityId: z.number().int().positive('Entity ID must be a positive integer'),
  noteText: z.string().min(1, 'Note text is required'),
});

// =============================================================================
// Validation Helper
// =============================================================================

/**
 * Validate tool arguments using a Zod schema
 * Returns the parsed data or throws a descriptive error
 */
export function validateArgs<T extends z.ZodTypeAny>(
  schema: T,
  args: unknown
): z.infer<T> {
  const result = schema.safeParse(args);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data;
}

/**
 * Safe validation that returns null instead of throwing
 */
export function validateArgsSafe<T extends z.ZodTypeAny>(
  schema: T,
  args: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(args);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    return { success: false, error: `Validation error: ${errors}` };
  }
  return { success: true, data: result.data };
}

/**
 * Unit tests for Zod validation schemas
 */

import {
  // Common schemas
  PaginationSchema,
  DateStringSchema,
  OrderDirectionSchema,
  // Client schemas
  ClientSearchSchema,
  ClientGetSchema,
  ClientCreateSchema,
  // Invoice schemas
  InvoiceSearchSchema,
  InvoiceCreateSchema,
  InvoiceLineSchema,
  // Bank schemas
  BankNominalCodeSchema,
  BankTransactionCreateSchema,
  // Report schemas
  ProfitLossSchema,
  AgeingReportSchema,
  // System schemas
  CreateNoteSchema,
  // Helpers
  validateArgs,
  validateArgsSafe,
} from '../../src/tools/schemas';

describe('Common Schemas', () => {
  describe('PaginationSchema', () => {
    it('should accept valid pagination params', () => {
      const result = PaginationSchema.safeParse({ returnCount: 50, offset: 10 });
      expect(result.success).toBe(true);
    });

    it('should use defaults when not provided', () => {
      const result = PaginationSchema.parse({});
      expect(result.returnCount).toBe(25);
      expect(result.offset).toBe(0);
    });

    it('should reject returnCount over 100', () => {
      const result = PaginationSchema.safeParse({ returnCount: 150 });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = PaginationSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('DateStringSchema', () => {
    it('should accept valid date format', () => {
      const result = DateStringSchema.safeParse('2024-01-15');
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = DateStringSchema.safeParse('15-01-2024');
      expect(result.success).toBe(false);
    });

    it('should reject date with slashes', () => {
      const result = DateStringSchema.safeParse('2024/01/15');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = DateStringSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('OrderDirectionSchema', () => {
    it('should accept ASC', () => {
      const result = OrderDirectionSchema.safeParse('ASC');
      expect(result.success).toBe(true);
    });

    it('should accept DESC', () => {
      const result = OrderDirectionSchema.safeParse('DESC');
      expect(result.success).toBe(true);
    });

    it('should reject lowercase', () => {
      const result = OrderDirectionSchema.safeParse('asc');
      expect(result.success).toBe(false);
    });

    it('should default to ASC when undefined', () => {
      const result = OrderDirectionSchema.parse(undefined);
      expect(result).toBe('ASC');
    });
  });
});

describe('Client Schemas', () => {
  describe('ClientSearchSchema', () => {
    it('should accept valid search params', () => {
      const result = ClientSearchSchema.safeParse({
        companyName: 'Test Corp',
        email: 'test@example.com',
        returnCount: 10,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (uses defaults)', () => {
      const result = ClientSearchSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = ClientSearchSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid orderBy value', () => {
      const result = ClientSearchSchema.safeParse({
        orderBy: 'InvalidField',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ClientGetSchema', () => {
    it('should accept valid client ID', () => {
      const result = ClientGetSchema.safeParse({ clientId: 12345 });
      expect(result.success).toBe(true);
    });

    it('should reject zero client ID', () => {
      const result = ClientGetSchema.safeParse({ clientId: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative client ID', () => {
      const result = ClientGetSchema.safeParse({ clientId: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject missing client ID', () => {
      const result = ClientGetSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-integer client ID', () => {
      const result = ClientGetSchema.safeParse({ clientId: 123.45 });
      expect(result.success).toBe(false);
    });
  });

  describe('ClientCreateSchema', () => {
    it('should accept valid client data', () => {
      const result = ClientCreateSchema.safeParse({
        companyName: 'Test Corp',
        email: 'test@example.com',
        website: 'https://example.com',
        termDays: 30,
      });
      expect(result.success).toBe(true);
    });

    it('should use default currency', () => {
      const result = ClientCreateSchema.parse({});
      expect(result.currency).toBe('GBP');
    });

    it('should reject invalid website URL', () => {
      const result = ClientCreateSchema.safeParse({
        website: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should reject termDays over 365', () => {
      const result = ClientCreateSchema.safeParse({
        termDays: 400,
      });
      expect(result.success).toBe(false);
    });

    it('should reject currency not 3 chars', () => {
      const result = ClientCreateSchema.safeParse({
        currency: 'EURO',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Invoice Schemas', () => {
  describe('InvoiceLineSchema', () => {
    it('should accept valid line item', () => {
      const result = InvoiceLineSchema.safeParse({
        description: 'Consulting services',
        unitCost: 100.00,
        quantity: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should use default VAT percentage', () => {
      const result = InvoiceLineSchema.parse({
        description: 'Test',
        unitCost: 100,
        quantity: 1,
      });
      expect(result.vatPercentage).toBe(20);
    });

    it('should reject empty description', () => {
      const result = InvoiceLineSchema.safeParse({
        description: '',
        unitCost: 100,
        quantity: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative unit cost', () => {
      const result = InvoiceLineSchema.safeParse({
        description: 'Test',
        unitCost: -50,
        quantity: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero quantity', () => {
      const result = InvoiceLineSchema.safeParse({
        description: 'Test',
        unitCost: 100,
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject VAT over 100%', () => {
      const result = InvoiceLineSchema.safeParse({
        description: 'Test',
        unitCost: 100,
        quantity: 1,
        vatPercentage: 150,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('InvoiceCreateSchema', () => {
    const validLines = [
      { description: 'Service', unitCost: 100, quantity: 1 },
    ];

    it('should accept valid invoice', () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: 'INVOICE',
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty lines array', () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: 'INVOICE',
        clientId: 123,
        lines: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid invoice type', () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: 'RECEIPT',
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(false);
    });

    it('should accept ESTIMATE type', () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: 'ESTIMATE',
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(true);
    });

    it('should accept CREDIT type', () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: 'CREDIT',
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('InvoiceSearchSchema', () => {
    it('should accept valid search with status', () => {
      const result = InvoiceSearchSchema.safeParse({
        status: 'PAID',
        invoiceType: 'INVOICE',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = InvoiceSearchSchema.safeParse({
        status: 'PENDING',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Bank Schemas', () => {
  describe('BankNominalCodeSchema', () => {
    it('should accept 4-digit code', () => {
      const result = BankNominalCodeSchema.safeParse('1200');
      expect(result.success).toBe(true);
    });

    it('should reject 3-digit code', () => {
      const result = BankNominalCodeSchema.safeParse('120');
      expect(result.success).toBe(false);
    });

    it('should reject 5-digit code', () => {
      const result = BankNominalCodeSchema.safeParse('12000');
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric', () => {
      const result = BankNominalCodeSchema.safeParse('12AB');
      expect(result.success).toBe(false);
    });
  });

  describe('BankTransactionCreateSchema', () => {
    it('should accept valid transaction', () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: '1200',
        transactionDate: '2024-01-15',
        amount: 150.00,
        transactionType: 'MONEY_IN',
      });
      expect(result.success).toBe(true);
    });

    it('should reject zero amount', () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: '1200',
        transactionDate: '2024-01-15',
        amount: 0,
        transactionType: 'MONEY_IN',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid transaction type', () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: '1200',
        transactionDate: '2024-01-15',
        amount: 100,
        transactionType: 'TRANSFER',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Report Schemas', () => {
  describe('ProfitLossSchema', () => {
    it('should accept valid date range', () => {
      const result = ProfitLossSchema.safeParse({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result.success).toBe(true);
    });

    it('should accept same start and end date', () => {
      const result = ProfitLossSchema.safeParse({
        startDate: '2024-06-15',
        endDate: '2024-06-15',
      });
      expect(result.success).toBe(true);
    });

    it('should reject end date before start date', () => {
      const result = ProfitLossSchema.safeParse({
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AgeingReportSchema', () => {
    it('should accept CREDITOR type', () => {
      const result = AgeingReportSchema.safeParse({
        reportType: 'CREDITOR',
      });
      expect(result.success).toBe(true);
    });

    it('should accept DEBTOR type', () => {
      const result = AgeingReportSchema.safeParse({
        reportType: 'DEBTOR',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = AgeingReportSchema.safeParse({
        reportType: 'BOTH',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('System Schemas', () => {
  describe('CreateNoteSchema', () => {
    it('should accept valid note', () => {
      const result = CreateNoteSchema.safeParse({
        entityType: 'INVOICE',
        entityId: 123,
        noteText: 'This is a note',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty note text', () => {
      const result = CreateNoteSchema.safeParse({
        entityType: 'CLIENT',
        entityId: 123,
        noteText: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid entity type', () => {
      const result = CreateNoteSchema.safeParse({
        entityType: 'BANK',
        entityId: 123,
        noteText: 'Note',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid entity types', () => {
      const types = ['INVOICE', 'PURCHASE', 'CLIENT', 'SUPPLIER'];
      types.forEach(type => {
        const result = CreateNoteSchema.safeParse({
          entityType: type,
          entityId: 1,
          noteText: 'Test',
        });
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('Validation Helpers', () => {
  describe('validateArgs', () => {
    it('should return parsed data for valid input', () => {
      const result = validateArgs(ClientGetSchema, { clientId: 123 });
      expect(result.clientId).toBe(123);
    });

    it('should throw descriptive error for invalid input', () => {
      expect(() => validateArgs(ClientGetSchema, { clientId: -1 }))
        .toThrow('Validation error');
    });

    it('should include field path in error', () => {
      expect(() => validateArgs(ClientGetSchema, { clientId: 'abc' }))
        .toThrow('clientId');
    });
  });

  describe('validateArgsSafe', () => {
    it('should return success result for valid input', () => {
      const result = validateArgsSafe(ClientGetSchema, { clientId: 123 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientId).toBe(123);
      }
    });

    it('should return error result for invalid input', () => {
      const result = validateArgsSafe(ClientGetSchema, { clientId: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Validation error');
      }
    });

    it('should not throw for invalid input', () => {
      expect(() => validateArgsSafe(ClientGetSchema, {})).not.toThrow();
    });
  });
});

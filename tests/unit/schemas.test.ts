/**
 * Unit tests for Zod validation schemas
 */

import {
  // Common schemas
  PaginationSchema,
  DateStringSchema,
  OrderDirectionSchema,
  OptionalDateSchema,
  // Client schemas
  ClientSearchSchema,
  ClientGetSchema,
  ClientCreateSchema,
  ClientUpdateSchema,
  ClientDeleteSchema,
  // Invoice schemas
  InvoiceSearchSchema,
  InvoiceCreateSchema,
  InvoiceLineSchema,
  InvoiceTypeSchema,
  InvoiceStatusSchema,
  InvoiceGetSchema,
  // Bank schemas
  BankNominalCodeSchema,
  BankTransactionCreateSchema,
  BankSearchSchema,
  // Report schemas
  ProfitLossSchema,
  AgeingReportSchema,
  BalanceSheetSchema,
  // System schemas
  CreateNoteSchema,
  // Helpers
  validateArgs,
  validateArgsSafe,
} from "../../src/tools/schemas";

describe("Common Schemas", () => {
  describe("PaginationSchema", () => {
    it("should accept valid pagination params", () => {
      const result = PaginationSchema.safeParse({
        returnCount: 50,
        offset: 10,
      });
      expect(result.success).toBe(true);
    });

    it("should use defaults when not provided", () => {
      const result = PaginationSchema.parse({});
      expect(result.returnCount).toBe(25);
      expect(result.offset).toBe(0);
    });

    it("should reject returnCount over 100", () => {
      const result = PaginationSchema.safeParse({ returnCount: 150 });
      expect(result.success).toBe(false);
    });

    it("should reject negative offset", () => {
      const result = PaginationSchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe("DateStringSchema", () => {
    it("should accept valid date format", () => {
      const result = DateStringSchema.safeParse("2024-01-15");
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format", () => {
      const result = DateStringSchema.safeParse("15-01-2024");
      expect(result.success).toBe(false);
    });

    it("should reject date with slashes", () => {
      const result = DateStringSchema.safeParse("2024/01/15");
      expect(result.success).toBe(false);
    });

    it("should reject empty string", () => {
      const result = DateStringSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("OrderDirectionSchema", () => {
    it("should accept ASC", () => {
      const result = OrderDirectionSchema.safeParse("ASC");
      expect(result.success).toBe(true);
    });

    it("should accept DESC", () => {
      const result = OrderDirectionSchema.safeParse("DESC");
      expect(result.success).toBe(true);
    });

    it("should reject lowercase", () => {
      const result = OrderDirectionSchema.safeParse("asc");
      expect(result.success).toBe(false);
    });

    it("should default to ASC when undefined", () => {
      const result = OrderDirectionSchema.parse(undefined);
      expect(result).toBe("ASC");
    });
  });
});

describe("Client Schemas", () => {
  describe("ClientSearchSchema", () => {
    it("should accept valid search params", () => {
      const result = ClientSearchSchema.safeParse({
        companyName: "Test Corp",
        email: "test@example.com",
        returnCount: 10,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object (uses defaults)", () => {
      const result = ClientSearchSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const result = ClientSearchSchema.safeParse({
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid orderBy value", () => {
      const result = ClientSearchSchema.safeParse({
        orderBy: "InvalidField",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ClientGetSchema", () => {
    it("should accept valid client ID", () => {
      const result = ClientGetSchema.safeParse({ clientId: 12345 });
      expect(result.success).toBe(true);
    });

    it("should reject zero client ID", () => {
      const result = ClientGetSchema.safeParse({ clientId: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject negative client ID", () => {
      const result = ClientGetSchema.safeParse({ clientId: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject missing client ID", () => {
      const result = ClientGetSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject non-integer client ID", () => {
      const result = ClientGetSchema.safeParse({ clientId: 123.45 });
      expect(result.success).toBe(false);
    });
  });

  describe("ClientCreateSchema", () => {
    it("should accept valid client data", () => {
      const result = ClientCreateSchema.safeParse({
        companyName: "Test Corp",
        email: "test@example.com",
        website: "https://example.com",
        termDays: 30,
      });
      expect(result.success).toBe(true);
    });

    it("should use default currency", () => {
      const result = ClientCreateSchema.parse({});
      expect(result.currency).toBe("GBP");
    });

    it("should reject invalid website URL", () => {
      const result = ClientCreateSchema.safeParse({
        website: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("should reject termDays over 365", () => {
      const result = ClientCreateSchema.safeParse({
        termDays: 400,
      });
      expect(result.success).toBe(false);
    });

    it("should reject currency not 3 chars", () => {
      const result = ClientCreateSchema.safeParse({
        currency: "EURO",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Invoice Schemas", () => {
  describe("InvoiceLineSchema", () => {
    it("should accept valid line item", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "Consulting services",
        unitCost: 100,
        quantity: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should use default VAT percentage", () => {
      const result = InvoiceLineSchema.parse({
        description: "Test",
        unitCost: 100,
        quantity: 1,
      });
      expect(result.vatPercentage).toBe(20);
    });

    it("should reject empty description", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "",
        unitCost: 100,
        quantity: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative unit cost", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "Test",
        unitCost: -50,
        quantity: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject zero quantity", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "Test",
        unitCost: 100,
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject VAT over 100%", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "Test",
        unitCost: 100,
        quantity: 1,
        vatPercentage: 150,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("InvoiceCreateSchema", () => {
    const validLines = [{ description: "Service", unitCost: 100, quantity: 1 }];

    it("should accept valid invoice", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "INVOICE",
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty lines array", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "INVOICE",
        clientId: 123,
        lines: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid invoice type", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "RECEIPT",
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(false);
    });

    it("should accept ESTIMATE type", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "ESTIMATE",
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(true);
    });

    it("should accept CREDIT type", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "CREDIT",
        clientId: 123,
        lines: validLines,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("InvoiceSearchSchema", () => {
    it("should accept valid search with status", () => {
      const result = InvoiceSearchSchema.safeParse({
        status: "PAID",
        invoiceType: "INVOICE",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = InvoiceSearchSchema.safeParse({
        status: "PENDING",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Bank Schemas", () => {
  describe("BankNominalCodeSchema", () => {
    it("should accept 4-digit code", () => {
      const result = BankNominalCodeSchema.safeParse("1200");
      expect(result.success).toBe(true);
    });

    it("should reject 3-digit code", () => {
      const result = BankNominalCodeSchema.safeParse("120");
      expect(result.success).toBe(false);
    });

    it("should reject 5-digit code", () => {
      const result = BankNominalCodeSchema.safeParse("12000");
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric", () => {
      const result = BankNominalCodeSchema.safeParse("12AB");
      expect(result.success).toBe(false);
    });
  });

  describe("BankTransactionCreateSchema", () => {
    it("should accept valid transaction", () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: "1200",
        transactionDate: "2024-01-15",
        amount: 150,
        transactionType: "MONEY_IN",
      });
      expect(result.success).toBe(true);
    });

    it("should reject zero amount", () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: "1200",
        transactionDate: "2024-01-15",
        amount: 0,
        transactionType: "MONEY_IN",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid transaction type", () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: "1200",
        transactionDate: "2024-01-15",
        amount: 100,
        transactionType: "TRANSFER",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Report Schemas", () => {
  describe("ProfitLossSchema", () => {
    it("should accept valid date range", () => {
      const result = ProfitLossSchema.safeParse({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("should accept same start and end date", () => {
      const result = ProfitLossSchema.safeParse({
        startDate: "2024-06-15",
        endDate: "2024-06-15",
      });
      expect(result.success).toBe(true);
    });

    it("should reject end date before start date", () => {
      const result = ProfitLossSchema.safeParse({
        startDate: "2024-12-31",
        endDate: "2024-01-01",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AgeingReportSchema", () => {
    it("should accept CREDITOR type", () => {
      const result = AgeingReportSchema.safeParse({
        reportType: "CREDITOR",
      });
      expect(result.success).toBe(true);
    });

    it("should accept DEBTOR type", () => {
      const result = AgeingReportSchema.safeParse({
        reportType: "DEBTOR",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid type", () => {
      const result = AgeingReportSchema.safeParse({
        reportType: "BOTH",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("System Schemas", () => {
  describe("CreateNoteSchema", () => {
    it("should accept valid note", () => {
      const result = CreateNoteSchema.safeParse({
        entityType: "INVOICE",
        entityId: 123,
        noteText: "This is a note",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty note text", () => {
      const result = CreateNoteSchema.safeParse({
        entityType: "CLIENT",
        entityId: 123,
        noteText: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid entity type", () => {
      const result = CreateNoteSchema.safeParse({
        entityType: "BANK",
        entityId: 123,
        noteText: "Note",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid entity types", () => {
      const types = ["INVOICE", "PURCHASE", "CLIENT", "SUPPLIER"];
      types.forEach((type) => {
        const result = CreateNoteSchema.safeParse({
          entityType: type,
          entityId: 1,
          noteText: "Test",
        });
        expect(result.success).toBe(true);
      });
    });
  });
});

describe("Validation Helpers", () => {
  describe("validateArgs", () => {
    it("should return parsed data for valid input", () => {
      const result = validateArgs(ClientGetSchema, { clientId: 123 });
      expect(result.clientId).toBe(123);
    });

    it("should throw descriptive error for invalid input", () => {
      expect(() => validateArgs(ClientGetSchema, { clientId: -1 })).toThrow(
        "Validation error",
      );
    });

    it("should include field path in error", () => {
      expect(() => validateArgs(ClientGetSchema, { clientId: "abc" })).toThrow(
        "clientId",
      );
    });
  });

  describe("validateArgsSafe", () => {
    it("should return success result for valid input", () => {
      const result = validateArgsSafe(ClientGetSchema, { clientId: 123 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientId).toBe(123);
      }
    });

    it("should return error result for invalid input", () => {
      const result = validateArgsSafe(ClientGetSchema, { clientId: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Validation error");
      }
    });

    it("should not throw for invalid input", () => {
      expect(() => validateArgsSafe(ClientGetSchema, {})).not.toThrow();
    });
  });
});

// Additional comprehensive tests for schemas
describe("Additional Common Schema Tests", () => {
  describe("OptionalDateSchema", () => {
    it("should accept valid date", () => {
      const result = OptionalDateSchema.safeParse("2024-01-15");
      expect(result.success).toBe(true);
    });

    it("should accept undefined", () => {
      const result = OptionalDateSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format", () => {
      const result = OptionalDateSchema.safeParse("01-15-2024");
      expect(result.success).toBe(false);
    });
  });

  describe("PaginationSchema edge cases", () => {
    it("should accept returnCount at minimum (1)", () => {
      const result = PaginationSchema.safeParse({ returnCount: 1 });
      expect(result.success).toBe(true);
    });

    it("should accept returnCount at maximum (100)", () => {
      const result = PaginationSchema.safeParse({ returnCount: 100 });
      expect(result.success).toBe(true);
    });

    it("should reject returnCount of 0", () => {
      const result = PaginationSchema.safeParse({ returnCount: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer returnCount", () => {
      const result = PaginationSchema.safeParse({ returnCount: 10.5 });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer offset", () => {
      const result = PaginationSchema.safeParse({ offset: 5.5 });
      expect(result.success).toBe(false);
    });
  });
});

describe("Additional Client Schema Tests", () => {
  describe("ClientUpdateSchema", () => {
    it("should require clientId", () => {
      const result = ClientUpdateSchema.safeParse({
        companyName: "Updated Corp",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid update", () => {
      const result = ClientUpdateSchema.safeParse({
        clientId: 123,
        companyName: "Updated Corp",
        email: "new@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should allow partial updates", () => {
      const result = ClientUpdateSchema.safeParse({
        clientId: 123,
        telephone: "01onal234567890",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ClientDeleteSchema", () => {
    it("should be equivalent to ClientGetSchema", () => {
      const validResult = ClientDeleteSchema.safeParse({ clientId: 123 });
      const invalidResult = ClientDeleteSchema.safeParse({ clientId: -1 });

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe("ClientSearchSchema orderBy values", () => {
    it("should accept CompanyName orderBy", () => {
      const result = ClientSearchSchema.safeParse({ orderBy: "CompanyName" });
      expect(result.success).toBe(true);
    });

    it("should accept DateCreated orderBy", () => {
      const result = ClientSearchSchema.safeParse({ orderBy: "DateCreated" });
      expect(result.success).toBe(true);
    });

    it("should accept ClientID orderBy", () => {
      const result = ClientSearchSchema.safeParse({ orderBy: "ClientID" });
      expect(result.success).toBe(true);
    });
  });
});

describe("Additional Invoice Schema Tests", () => {
  describe("InvoiceTypeSchema", () => {
    it("should accept all valid invoice types", () => {
      const types = ["INVOICE", "ESTIMATE", "RECURRING", "CREDIT"];
      types.forEach((type) => {
        const result = InvoiceTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid invoice type", () => {
      const result = InvoiceTypeSchema.safeParse("RECEIPT");
      expect(result.success).toBe(false);
    });
  });

  describe("InvoiceStatusSchema", () => {
    it("should accept all valid statuses", () => {
      const statuses = [
        "DRAFT",
        "SENT",
        "VIEWED",
        "PAID",
        "PART_PAID",
        "OVERDUE",
        "CANCELLED",
      ];
      statuses.forEach((status) => {
        const result = InvoiceStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid status", () => {
      const result = InvoiceStatusSchema.safeParse("PENDING");
      expect(result.success).toBe(false);
    });
  });

  describe("InvoiceGetSchema", () => {
    it("should accept valid invoice ID", () => {
      const result = InvoiceGetSchema.safeParse({ invoiceId: 12345 });
      expect(result.success).toBe(true);
    });

    it("should reject zero invoice ID", () => {
      const result = InvoiceGetSchema.safeParse({ invoiceId: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject negative invoice ID", () => {
      const result = InvoiceGetSchema.safeParse({ invoiceId: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer invoice ID", () => {
      const result = InvoiceGetSchema.safeParse({ invoiceId: 123.45 });
      expect(result.success).toBe(false);
    });
  });

  describe("InvoiceSearchSchema orderBy values", () => {
    it("should accept all valid orderBy values", () => {
      const orderByValues = [
        "InvoiceNumber",
        "IssueDate",
        "DueDate",
        "ClientName",
        "GrossAmount",
      ];
      orderByValues.forEach((orderBy) => {
        const result = InvoiceSearchSchema.safeParse({ orderBy });
        expect(result.success).toBe(true);
      });
    });
  });

  describe("InvoiceLineSchema with nominalCode", () => {
    it("should accept line with nominalCode", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "Service",
        unitCost: 100,
        quantity: 1,
        nominalCode: "4000",
      });
      expect(result.success).toBe(true);
    });

    it("should accept VAT at 0%", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "Zero-rated item",
        unitCost: 50,
        quantity: 2,
        vatPercentage: 0,
      });
      expect(result.success).toBe(true);
    });

    it("should accept VAT at 100%", () => {
      const result = InvoiceLineSchema.safeParse({
        description: "High tax item",
        unitCost: 50,
        quantity: 1,
        vatPercentage: 100,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("InvoiceCreateSchema full validation", () => {
    it("should accept invoice with all optional fields", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "INVOICE",
        clientId: 123,
        currency: "EUR",
        termDays: 60,
        issueDate: "2024-01-15",
        poNumber: "PO-12345",
        notes: "Thank you for your business",
        lines: [
          {
            description: "Consulting",
            unitCost: 500,
            quantity: 8,
            vatPercentage: 20,
            nominalCode: "4000",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept multiple line items", () => {
      const result = InvoiceCreateSchema.safeParse({
        invoiceType: "INVOICE",
        clientId: 123,
        lines: [
          { description: "Item 1", unitCost: 100, quantity: 1 },
          { description: "Item 2", unitCost: 200, quantity: 2 },
          { description: "Item 3", unitCost: 50, quantity: 10 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Additional Bank Schema Tests", () => {
  describe("BankSearchSchema", () => {
    it("should require nominalCode", () => {
      const result = BankSearchSchema.safeParse({
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid search params", () => {
      const result = BankSearchSchema.safeParse({
        nominalCode: "1200",
        dateFrom: "2024-01-01",
        dateTo: "2024-12-31",
        reference: "REF001",
        minAmount: 0,
        maxAmount: 10000,
        tagged: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept all orderBy values", () => {
      const orderByValues = ["TransactionDate", "Amount", "Reference"];
      orderByValues.forEach((orderBy) => {
        const result = BankSearchSchema.safeParse({
          nominalCode: "1200",
          orderBy,
        });
        expect(result.success).toBe(true);
      });
    });

    it("should accept tagged as false", () => {
      const result = BankSearchSchema.safeParse({
        nominalCode: "1200",
        tagged: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("BankTransactionCreateSchema", () => {
    it("should accept MONEY_OUT transaction", () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: "1200",
        transactionDate: "2024-01-15",
        amount: 100,
        transactionType: "MONEY_OUT",
      });
      expect(result.success).toBe(true);
    });

    it("should accept transaction with all optional fields", () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: "1200",
        transactionDate: "2024-01-15",
        amount: 500,
        transactionType: "MONEY_IN",
        reference: "INV-001",
        payeePayer: "Test Client",
        notes: "Payment received",
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative amount", () => {
      const result = BankTransactionCreateSchema.safeParse({
        nominalCode: "1200",
        transactionDate: "2024-01-15",
        amount: -100,
        transactionType: "MONEY_IN",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Additional Report Schema Tests", () => {
  describe("BalanceSheetSchema", () => {
    it("should accept valid report date", () => {
      const result = BalanceSheetSchema.safeParse({
        reportDate: "2024-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("should require reportDate", () => {
      const result = BalanceSheetSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const result = BalanceSheetSchema.safeParse({
        reportDate: "31-12-2024",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ProfitLossSchema validation", () => {
    it("should require both dates", () => {
      const result1 = ProfitLossSchema.safeParse({ startDate: "2024-01-01" });
      const result2 = ProfitLossSchema.safeParse({ endDate: "2024-12-31" });

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it("should reject invalid date formats", () => {
      const result = ProfitLossSchema.safeParse({
        startDate: "01/01/2024",
        endDate: "31/12/2024",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AgeingReportSchema", () => {
    it("should accept with optional asAtDate", () => {
      const result = AgeingReportSchema.safeParse({
        reportType: "DEBTOR",
        asAtDate: "2024-06-30",
      });
      expect(result.success).toBe(true);
    });

    it("should work without asAtDate", () => {
      const result = AgeingReportSchema.safeParse({
        reportType: "CREDITOR",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Edge Cases and Error Messages", () => {
  describe("validateArgs error messages", () => {
    it("should include path for nested errors", () => {
      const schema = InvoiceCreateSchema;
      expect(() =>
        validateArgs(schema, {
          invoiceType: "INVOICE",
          clientId: 123,
          lines: [{ description: "", unitCost: 100, quantity: 1 }],
        }),
      ).toThrow("lines.0.description");
    });

    it("should combine multiple errors", () => {
      const schema = InvoiceCreateSchema;
      try {
        validateArgs(schema, {
          invoiceType: "INVALID",
          clientId: -1,
          lines: [],
        });
        fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Validation error");
      }
    });
  });

  describe("validateArgsSafe error messages", () => {
    it("should return formatted error for nested issues", () => {
      const result = validateArgsSafe(InvoiceCreateSchema, {
        invoiceType: "INVOICE",
        clientId: 123,
        lines: [{ description: "", unitCost: 100, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("lines.0.description");
      }
    });
  });
});

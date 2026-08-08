/**
 * Unit tests for payment request building and validation
 */

import {
  buildPaymentDetails,
  validatePaymentArgs,
} from "../../src/tools/payment";

describe("validatePaymentArgs", () => {
  const supplierPayment = {
    designation: "SUPPLIER",
    paymentDate: "2026-07-31",
    amount: 14.86,
    payMethod: "BANK",
    invoiceId: 46928443,
    supplierId: 4061885,
  };

  it("accepts a well-formed supplier payment", () => {
    expect(validatePaymentArgs(supplierPayment)).toBeNull();
  });

  it("rejects a non-positive amount", () => {
    expect(validatePaymentArgs({ ...supplierPayment, amount: 0 })).toMatch(
      /positive/,
    );
    expect(validatePaymentArgs({ ...supplierPayment, amount: -5 })).toMatch(
      /positive/,
    );
  });

  it("requires supplierId for SUPPLIER designation", () => {
    const { supplierId: _omitted, ...rest } = supplierPayment;
    expect(validatePaymentArgs(rest)).toMatch(/supplierId/);
  });

  it("requires clientId for CLIENT designation", () => {
    expect(
      validatePaymentArgs({
        designation: "CLIENT",
        paymentDate: "2026-07-31",
        amount: 10,
        payMethod: "BANK",
        invoiceId: 1,
      }),
    ).toMatch(/clientId/);
  });

  it("requires invoiceId when paymentType is PAYMENT", () => {
    const { invoiceId: _omitted, ...rest } = supplierPayment;
    expect(validatePaymentArgs(rest)).toMatch(/invoiceId/);
  });

  it("allows a CREDIT payment with no invoiceId", () => {
    const { invoiceId: _omitted, ...rest } = supplierPayment;
    expect(
      validatePaymentArgs({ ...rest, paymentType: "CREDIT" }),
    ).toBeNull();
  });
});

describe("buildPaymentDetails", () => {
  it("nests SupplierID under DesignatedTo and keeps XSD element order", () => {
    const details = buildPaymentDetails({
      designation: "SUPPLIER",
      paymentDate: "2026-07-31",
      amount: 14.86,
      payMethod: "BANK",
      invoiceId: 46928443,
      supplierId: 4061885,
      bankNominalCode: 1250,
    });

    expect(details.DesignatedTo).toEqual({ SupplierID: 4061885 });
    expect(details.PaymentType).toBe("PAYMENT");
    expect(details.Currency).toBe("GBP");
    // The server enforces xs:sequence order, so key order is load-bearing.
    expect(Object.keys(details)).toEqual([
      "Designation",
      "PaymentType",
      "PaymentDate",
      "Amount",
      "Currency",
      "PayMethod",
      "InvoiceID",
      "DesignatedTo",
      "BankNominalCode",
    ]);
  });

  it("nests ClientID under DesignatedTo for client payments", () => {
    const details = buildPaymentDetails({
      designation: "CLIENT",
      paymentDate: "2026-07-31",
      amount: 100,
      payMethod: "BANK",
      invoiceId: 123,
      clientId: 456,
    });

    expect(details.DesignatedTo).toEqual({ ClientID: 456 });
  });

  it("drops omitted optionals rather than sending nulls", () => {
    const details = buildPaymentDetails({
      designation: "SUPPLIER",
      paymentDate: "2026-07-31",
      amount: 7.43,
      payMethod: "BANK",
      invoiceId: 46928425,
      supplierId: 4061885,
    });

    expect(details).not.toHaveProperty("Notes");
    expect(details).not.toHaveProperty("BankNominalCode");
    expect(details).not.toHaveProperty("SendConfirmation");
  });
});

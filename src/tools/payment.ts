/**
 * QuickFile Payment Tools
 * Record payments against invoices (clients) and purchases (suppliers)
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getApiClient } from "../api/client.js";
import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  type ToolResult,
} from "./utils.js";

// =============================================================================
// Tool Definitions
// =============================================================================

export const paymentTools: Tool[] = [
  {
    name: "quickfile_payment_get_methods",
    description:
      "List the payment method codes this account accepts. Call this first — Payment_Create rejects a PayMethod that isn't in this list, and the codes are account-specific (the API docs don't publish them).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "quickfile_payment_create",
    description:
      "Record a payment against an invoice (client) or a purchase (supplier). This is what marks a purchase PAIDFULL — it posts the payment and the corresponding bank entry in one call, so no manual bank tagging is needed. For a purchase, pass designation=SUPPLIER, supplierId, and invoiceId=<the purchase ID>.",
    inputSchema: {
      type: "object",
      properties: {
        designation: {
          type: "string",
          enum: ["CLIENT", "SUPPLIER"],
          description:
            "CLIENT for money received against a sales invoice, SUPPLIER for money paid against a purchase",
        },
        paymentType: {
          type: "string",
          enum: ["PAYMENT", "CREDIT"],
          default: "PAYMENT",
          description:
            "PAYMENT attributes the money to a specific invoice/purchase (requires invoiceId). CREDIT holds it on account.",
        },
        paymentDate: {
          type: "string",
          description: "Date the payment occurred (YYYY-MM-DD)",
        },
        amount: {
          type: "number",
          description:
            "Payment amount, positive. In the payment currency, not the base currency.",
        },
        currency: {
          type: "string",
          default: "GBP",
          description: "Payment currency code (default: GBP)",
        },
        payMethod: {
          type: "string",
          description:
            "Payment method code — must be one returned by quickfile_payment_get_methods",
        },
        invoiceId: {
          type: "number",
          description:
            "The invoice ID, or the purchase ID when designation=SUPPLIER. Required when paymentType=PAYMENT.",
        },
        clientId: {
          type: "number",
          description: "Client ID — required when designation=CLIENT",
        },
        supplierId: {
          type: "number",
          description: "Supplier ID — required when designation=SUPPLIER",
        },
        bankNominalCode: {
          type: "number",
          description:
            "Bank account nominal code the money moves through (e.g. 1200 current account, 1250 credit card)",
        },
        applyFromCredit: {
          type: "boolean",
          description: "Apply any available account credit first",
        },
        sendConfirmation: {
          type: "boolean",
          description: "Email a confirmation to the client (CLIENT payments)",
        },
        notes: {
          type: "string",
          description: "Free-text note on the payment (max 100 chars)",
        },
      },
      required: ["designation", "paymentDate", "amount", "payMethod"],
    },
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

interface PayMethodsResponse {
  PaymentMethods?: { PaymentMethod?: unknown[] };
}

/**
 * Payment_Create's PaymentDetails is an xs:sequence — the server enforces
 * element order, so build the object in the XSD's declared order and let
 * cleanParams drop the omitted optionals.
 */
export function buildPaymentDetails(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const designation = args.designation as "CLIENT" | "SUPPLIER";
  const paymentType = (args.paymentType as string) ?? "PAYMENT";

  const designatedTo =
    designation === "SUPPLIER"
      ? { SupplierID: args.supplierId as number }
      : { ClientID: args.clientId as number };

  return cleanParams({
    Designation: designation,
    PaymentType: paymentType,
    PaymentDate: args.paymentDate as string,
    Amount: args.amount as number,
    Currency: (args.currency as string) ?? "GBP",
    PayMethod: args.payMethod as string,
    InvoiceID: args.invoiceId as number | undefined,
    DesignatedTo: designatedTo,
    BankNominalCode: args.bankNominalCode as number | undefined,
    ApplyFromCredit: args.applyFromCredit as boolean | undefined,
    SendConfirmation: args.sendConfirmation as boolean | undefined,
    Notes: args.notes as string | undefined,
  }) as Record<string, unknown>;
}

/**
 * Returns an error string when the argument combination can't produce a valid
 * request, or null when it's good to send. Kept separate from the handler so
 * it's unit-testable without touching the network.
 */
export function validatePaymentArgs(
  args: Record<string, unknown>,
): string | null {
  const designation = args.designation as string;
  const paymentType = (args.paymentType as string) ?? "PAYMENT";
  const amount = args.amount as number;

  if (!Number.isFinite(amount) || amount <= 0) {
    return "amount must be a positive number";
  }
  if (designation === "SUPPLIER" && args.supplierId === undefined) {
    return "supplierId is required when designation=SUPPLIER";
  }
  if (designation === "CLIENT" && args.clientId === undefined) {
    return "clientId is required when designation=CLIENT";
  }
  if (paymentType === "PAYMENT" && args.invoiceId === undefined) {
    return "invoiceId is required when paymentType=PAYMENT (for a purchase, pass the purchase ID)";
  }
  return null;
}

export async function handlePaymentTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const apiClient = getApiClient();

  try {
    switch (toolName) {
      case "quickfile_payment_get_methods": {
        const response = await apiClient.request<
          Record<string, never>,
          PayMethodsResponse
        >("Payment_GetPayMethods", {});

        return successResult({
          methods: response.PaymentMethods?.PaymentMethod ?? response,
        });
      }

      case "quickfile_payment_create": {
        const invalid = validatePaymentArgs(args);
        if (invalid) {
          return errorResult(invalid);
        }

        const paymentDetails = buildPaymentDetails(args);

        // Response element names aren't published for this method, so return
        // the raw body alongside the flags rather than guessing at a shape.
        const response = await apiClient.request<
          { PaymentDetails: typeof paymentDetails },
          Record<string, unknown>
        >("Payment_Create", { PaymentDetails: paymentDetails });

        const paymentId =
          (response.PaymentID as number | undefined) ??
          (response.PaymentId as number | undefined);

        return successResult({
          success: true,
          paymentId,
          invoiceId: args.invoiceId,
          amount: args.amount,
          response,
          message: paymentId
            ? `Payment ${paymentId} recorded against ${args.invoiceId}`
            : `Payment recorded against ${args.invoiceId}`,
        });
      }

      default:
        return errorResult(`Unknown payment tool: ${toolName}`);
    }
  } catch (error) {
    return handleToolError(error);
  }
}

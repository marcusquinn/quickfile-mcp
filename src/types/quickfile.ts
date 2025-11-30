/**
 * QuickFile API Types
 * Based on QuickFile API v1.2 documentation
 * https://api.quickfile.co.uk/
 */

// =============================================================================
// Credentials & Configuration
// =============================================================================

export interface QuickFileCredentials {
  accountNumber: string;
  apiKey: string;
  applicationId: string;
}

export interface QuickFileConfig {
  credentials: QuickFileCredentials;
  testMode?: boolean;
  apiVersion?: string;
}

// =============================================================================
// API Request/Response Structure
// =============================================================================

export interface QuickFileHeader {
  MessageType: 'Request' | 'Response';
  SubmissionNumber: string;
  Authentication: {
    AccNumber: string;
    MD5Value: string;
    ApplicationID: string;
  };
  TestMode?: boolean;
}

export interface QuickFileRequest<T = unknown> {
  payload: {
    Header: QuickFileHeader;
    Body: T;
  };
}

export interface QuickFileResponseMethod<T = unknown> {
  Header: {
    MessageType: 'Response';
    SubmissionNumber: string;
  };
  Body: T;
}

export interface QuickFileResponse<T = unknown> {
  [methodName: string]: QuickFileResponseMethod<T> | QuickFileError[] | undefined;
  Errors?: QuickFileError[];
}

export interface QuickFileError {
  ErrorCode: string;
  ErrorMessage: string;
}

// =============================================================================
// Client Types
// =============================================================================

export interface Client {
  ClientID: number;
  CompanyName?: string;
  Title?: string;
  FirstName?: string;
  LastName?: string;
  Address?: ClientAddress;
  Email?: string;
  Telephone?: string;
  Mobile?: string;
  Website?: string;
  VatNumber?: string;
  CompanyRegNo?: string;
  Currency?: string;
  TermDays?: number;
  Notes?: string;
  Contacts?: ClientContact[];
}

export interface ClientAddress {
  Address1?: string;
  Address2?: string;
  Town?: string;
  County?: string;
  Postcode?: string;
  Country?: string;
}

export interface ClientContact {
  ContactID?: number;
  FirstName: string;
  LastName: string;
  Email?: string;
  Telephone?: string;
  Mobile?: string;
  IsPrimary?: boolean;
}

export interface ClientSearchParams {
  CompanyName?: string;
  ContactName?: string;
  Email?: string;
  Postcode?: string;
  ReturnCount?: number;
  Offset?: number;
  OrderResultsBy?: 'CompanyName' | 'DateCreated' | 'ClientID';
  OrderDirection?: 'ASC' | 'DESC';
}

// =============================================================================
// Invoice Types
// =============================================================================

export type InvoiceType = 'INVOICE' | 'ESTIMATE' | 'RECURRING' | 'CREDIT';

export interface Invoice {
  InvoiceID: number;
  InvoiceNumber: string;
  InvoiceType: InvoiceType;
  ClientID: number;
  ClientName?: string;
  Currency: string;
  IssueDate: string;
  DueDate?: string;
  PaidDate?: string;
  Status: InvoiceStatus;
  NetAmount: number;
  VatAmount: number;
  GrossAmount: number;
  PaidAmount?: number;
  OutstandingAmount?: number;
  TermDays?: number;
  Notes?: string;
  InvoiceLines?: InvoiceLine[];
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PART_PAID' | 'OVERDUE' | 'CANCELLED';

export interface InvoiceLine {
  ItemID?: number;
  ItemName?: string;
  ItemDescription: string;
  UnitCost: number;
  Qty: number;
  NominalCode?: string;
  Tax1?: InvoiceLineTax;
  Tax2?: InvoiceLineTax;
  LineTotal?: number;
}

export interface InvoiceLineTax {
  TaxName: string;
  TaxPercentage: number;
  TaxAmount?: number;
}

export interface InvoiceSearchParams {
  InvoiceType?: InvoiceType;
  ClientID?: number;
  DateFrom?: string;
  DateTo?: string;
  Status?: InvoiceStatus;
  SearchKeyword?: string;
  ReturnCount?: number;
  Offset?: number;
  OrderResultsBy?: 'InvoiceNumber' | 'IssueDate' | 'DueDate' | 'ClientName' | 'GrossAmount';
  OrderDirection?: 'ASC' | 'DESC';
}

export interface InvoiceCreateParams {
  InvoiceType: InvoiceType;
  ClientID: number;
  Currency?: string;
  TermDays?: number;
  Language?: string;
  IssueDate?: string;
  InvoiceLines: InvoiceLine[];
  Notes?: string;
  PONumber?: string;
}

// =============================================================================
// Purchase Types
// =============================================================================

export interface Purchase {
  PurchaseID: number;
  PurchaseNumber?: string;
  SupplierID: number;
  SupplierName?: string;
  Currency: string;
  IssueDate: string;
  DueDate?: string;
  PaidDate?: string;
  Status: PurchaseStatus;
  NetAmount: number;
  VatAmount: number;
  GrossAmount: number;
  PaidAmount?: number;
  OutstandingAmount?: number;
  Notes?: string;
  PurchaseLines?: PurchaseLine[];
}

export type PurchaseStatus = 'UNPAID' | 'PAID' | 'PART_PAID' | 'CANCELLED';

export interface PurchaseLine {
  ItemDescription: string;
  UnitCost: number;
  Qty: number;
  NominalCode: string;
  Tax1?: InvoiceLineTax;
  LineTotal?: number;
}

export interface PurchaseSearchParams {
  SupplierID?: number;
  DateFrom?: string;
  DateTo?: string;
  Status?: PurchaseStatus;
  SearchKeyword?: string;
  ReturnCount?: number;
  Offset?: number;
  OrderResultsBy?: 'PurchaseDate' | 'DueDate' | 'SupplierName' | 'GrossAmount';
  OrderDirection?: 'ASC' | 'DESC';
}

export interface PurchaseCreateParams {
  SupplierID: number;
  Currency?: string;
  IssueDate?: string;
  DueDate?: string;
  PurchaseLines: PurchaseLine[];
  Notes?: string;
  SupplierRef?: string;
}

// =============================================================================
// Supplier Types
// =============================================================================

export interface Supplier {
  SupplierID: number;
  CompanyName?: string;
  Title?: string;
  FirstName?: string;
  LastName?: string;
  Address?: ClientAddress;
  Email?: string;
  Telephone?: string;
  Mobile?: string;
  Website?: string;
  VatNumber?: string;
  CompanyRegNo?: string;
  Currency?: string;
  TermDays?: number;
  Notes?: string;
}

export interface SupplierSearchParams {
  CompanyName?: string;
  ContactName?: string;
  Email?: string;
  Postcode?: string;
  ReturnCount?: number;
  Offset?: number;
  OrderResultsBy?: 'CompanyName' | 'DateCreated' | 'SupplierID';
  OrderDirection?: 'ASC' | 'DESC';
}

// =============================================================================
// Bank Types
// =============================================================================

export interface BankAccount {
  NominalCode: string;
  AccountName: string;
  AccountType: BankAccountType;
  Currency: string;
  CurrentBalance?: number;
  BankName?: string;
  SortCode?: string;
  AccountNumber?: string;
}

export type BankAccountType = 'CURRENT' | 'SAVINGS' | 'CREDIT_CARD' | 'LOAN' | 'CASH' | 'PAYPAL' | 'MERCHANT' | 'OTHER';

export interface BankTransaction {
  TransactionID: number;
  NominalCode: string;
  TransactionDate: string;
  Reference?: string;
  PayeePayer?: string;
  Amount: number;
  TransactionType: 'MONEY_IN' | 'MONEY_OUT';
  Tagged: boolean;
  Notes?: string;
}

export interface BankSearchParams {
  NominalCode: string;
  DateFrom?: string;
  DateTo?: string;
  Reference?: string;
  MinAmount?: number;
  MaxAmount?: number;
  Tagged?: boolean;
  ReturnCount?: number;
  Offset?: number;
  OrderResultsBy?: string;
  OrderDirection?: string;
}

export interface BankTransactionCreateParams {
  NominalCode: string;
  TransactionDate: string;
  Reference?: string;
  PayeePayer?: string;
  Amount: number;
  TransactionType: 'MONEY_IN' | 'MONEY_OUT';
  Notes?: string;
}

// =============================================================================
// Report Types
// =============================================================================

export interface ProfitAndLossReport {
  StartDate: string;
  EndDate: string;
  Income: ReportSection[];
  Expenses: ReportSection[];
  TotalIncome: number;
  TotalExpenses: number;
  NetProfit: number;
}

export interface ReportSection {
  NominalCode: string;
  NominalName: string;
  Amount: number;
}

export interface BalanceSheetReport {
  ReportDate: string;
  Assets: ReportSection[];
  Liabilities: ReportSection[];
  Equity: ReportSection[];
  TotalAssets: number;
  TotalLiabilities: number;
  TotalEquity: number;
}

export interface VatObligation {
  PeriodKey: string;
  StartDate: string;
  EndDate: string;
  DueDate: string;
  Status: 'O' | 'F'; // Open or Filed
  VatDueSales?: number;
  VatDueAcquisitions?: number;
  TotalVatDue?: number;
  VatReclaimedCurrPeriod?: number;
  NetVatDue?: number;
  TotalValueSalesExVat?: number;
  TotalValuePurchasesExVat?: number;
  TotalValueGoodsSuppliedExVat?: number;
  TotalAcquisitionsExVat?: number;
}

export interface AgeingReport {
  ReportType: 'CREDITOR' | 'DEBTOR';
  AsAtDate: string;
  Entries: AgeingEntry[];
  TotalCurrent: number;
  Total30Days: number;
  Total60Days: number;
  Total90Days: number;
  TotalOver90Days: number;
  GrandTotal: number;
}

export interface AgeingEntry {
  ID: number;
  Name: string;
  Current: number;
  Days30: number;
  Days60: number;
  Days90: number;
  Over90Days: number;
  Total: number;
}

export interface ChartOfAccountsEntry {
  NominalCode: string;
  NominalName: string;
  Category: string;
  SubCategory?: string;
  SystemAccount: boolean;
}

// =============================================================================
// System Types
// =============================================================================

export interface AccountDetails {
  AccountNumber: string;
  CompanyName: string;
  CompanyType: string;
  VatRegistered: boolean;
  VatNumber?: string;
  YearEndDate: string;
  Currency: string;
  Address?: ClientAddress;
  Email?: string;
  Telephone?: string;
}

export interface SystemEvent {
  EventID: number;
  EventType: string;
  EventDate: string;
  Description: string;
  UserName?: string;
  RelatedID?: number;
  RelatedType?: string;
}

export interface SystemEventSearchParams {
  EventType?: string;
  DateFrom?: string;
  DateTo?: string;
  RelatedID?: number;
  RelatedType?: string;
  ReturnCount?: number;
  Offset?: number;
}

export interface CreateNoteParams {
  EntityType: 'INVOICE' | 'PURCHASE' | 'CLIENT' | 'SUPPLIER';
  EntityID: number;
  NoteText: string;
}

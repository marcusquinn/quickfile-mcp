/** Shared types for QuickFile beta REST API authentication and VAT behavior. */

/**
 * Optional account-specific VAT posture.
 *
 * Configure with QUICKFILE_<ACCOUNT>_VAT_REGISTERED=true|false.
 * A VAT-registered or unconfigured account requires a rate on every mutation
 * line. A non-VAT-registered account requires omission and resolves to 0%.
 */
export interface BusinessProfile {
  vatRegistered: boolean;
}

/** Credentials loaded from one account-specific process environment variable. */
export interface QuickFileCredentials {
  account: string;
  bearerToken: string;
  businessProfile?: BusinessProfile;
}

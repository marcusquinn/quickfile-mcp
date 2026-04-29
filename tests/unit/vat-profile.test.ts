/**
 * Unit tests for resolveVatPercentage — the businessProfile-aware VAT rate
 * resolver used by invoice and purchase create operations.
 *
 * Decision table under test:
 * | businessProfile      | vatPercentage given? | Expected result           |
 * |----------------------|----------------------|---------------------------|
 * | absent               | yes                  | per-line value            |
 * | absent               | no                   | 20 (default)              |
 * | vatRegistered: false | yes (any value)      | Error (contradiction)     |
 * | vatRegistered: false | no                   | 0 (implicit)              |
 * | vatRegistered: true  | yes                  | per-line value            |
 * | vatRegistered: true  | no                   | Error (rate required)     |
 */

import { resolveVatPercentage } from "../../src/tools/utils";
import type { BusinessProfile } from "../../src/types/quickfile";

describe("resolveVatPercentage", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // No businessProfile configured (legacy / no-config behaviour)
  // ──────────────────────────────────────────────────────────────────────────
  describe("when no businessProfile is configured (undefined)", () => {
    it("returns the supplied vatPercentage when provided", () => {
      expect(resolveVatPercentage(20, undefined)).toBe(20);
      expect(resolveVatPercentage(0, undefined)).toBe(0);
      expect(resolveVatPercentage(5, undefined)).toBe(5);
    });

    it("returns 20 as the default when vatPercentage is undefined", () => {
      expect(resolveVatPercentage(undefined, undefined)).toBe(20);
    });

    it("returns 0 when vatPercentage is explicitly 0", () => {
      expect(resolveVatPercentage(0, undefined)).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // businessProfile.vatRegistered = false
  // ──────────────────────────────────────────────────────────────────────────
  describe("when businessProfile.vatRegistered is false", () => {
    const profile: BusinessProfile = { vatRegistered: false };

    it("returns 0 when vatPercentage is not provided", () => {
      expect(resolveVatPercentage(undefined, profile)).toBe(0);
    });

    it("throws a contradiction error when any vatPercentage is provided", () => {
      expect(() => resolveVatPercentage(20, profile)).toThrow(
        /Configuration contradiction.*vatRegistered=false/,
      );
    });

    it("throws a contradiction error when vatPercentage is 0 (explicit)", () => {
      // Even an explicit 0 is rejected — non-registered installs should not
      // be providing vatPercentage at all; it is always implicit 0.
      expect(() => resolveVatPercentage(0, profile)).toThrow(
        /Configuration contradiction.*vatRegistered=false/,
      );
    });

    it("throws a contradiction error when vatPercentage is a reduced rate (5%)", () => {
      expect(() => resolveVatPercentage(5, profile)).toThrow(
        /Configuration contradiction/,
      );
    });

    it("error message includes the supplied vatPercentage value", () => {
      expect(() => resolveVatPercentage(20, profile)).toThrow(
        /vatPercentage=20/,
      );
    });

    it("error message references credentials file", () => {
      expect(() => resolveVatPercentage(20, profile)).toThrow(
        /credentials\.json/,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // businessProfile.vatRegistered = true
  // ──────────────────────────────────────────────────────────────────────────
  describe("when businessProfile.vatRegistered is true", () => {
    const profile: BusinessProfile = { vatRegistered: true };

    it("returns the supplied vatPercentage when provided", () => {
      expect(resolveVatPercentage(20, profile)).toBe(20);
    });

    it("returns 0 when vatPercentage is explicitly zero-rated", () => {
      expect(resolveVatPercentage(0, profile)).toBe(0);
    });

    it("returns reduced rate (5%) when provided", () => {
      expect(resolveVatPercentage(5, profile)).toBe(5);
    });

    it("throws when vatPercentage is not provided", () => {
      expect(() => resolveVatPercentage(undefined, profile)).toThrow(
        /vatPercentage is required.*vatRegistered=true/,
      );
    });

    it("error message for missing rate mentions rates vary", () => {
      expect(() => resolveVatPercentage(undefined, profile)).toThrow(
        /rates vary/,
      );
    });

    it("error message references credentials file", () => {
      expect(() => resolveVatPercentage(undefined, profile)).toThrow(
        /credentials\.json/,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("returns 20 for undefined vatPercentage when profile is absent (not null)", () => {
      // TypeScript allows passing null via loose typing; confirm it falls
      // through to the default-20 path.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(resolveVatPercentage(undefined, null as any)).toBe(20);
    });

    it("handles fractional VAT rates correctly", () => {
      const profile: BusinessProfile = { vatRegistered: true };
      expect(resolveVatPercentage(17.5, profile)).toBe(17.5);
    });

    it("returns the per-line value unchanged without rounding", () => {
      expect(resolveVatPercentage(12.345, undefined)).toBe(12.345);
    });
  });
});

import { describe, it, expect } from "vitest";
import { normalizeEmail, normalizeName, normalizePhoneE164US } from "./normalize";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  JANE.Doe@Example.COM  ")).toBe("jane.doe@example.com");
  });

  it("handles undefined and empty input as empty string", () => {
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("normalizePhoneE164US", () => {
  it("converts 10 digits to +1-prefixed E.164", () => {
    expect(normalizePhoneE164US("5555551234")).toBe("+15555551234");
  });

  it("preserves 11 digits with leading 1", () => {
    expect(normalizePhoneE164US("15555551234")).toBe("+15555551234");
  });

  it("preserves an already-E.164 number", () => {
    expect(normalizePhoneE164US("+15555551234")).toBe("+15555551234");
  });

  it("strips junk characters from a US-formatted phone", () => {
    expect(normalizePhoneE164US("(555) 555-1234")).toBe("+15555551234");
    expect(normalizePhoneE164US("555.555.1234")).toBe("+15555551234");
  });

  it("returns empty string for nonsense input", () => {
    expect(normalizePhoneE164US("abc")).toBe("");
    expect(normalizePhoneE164US("")).toBe("");
    expect(normalizePhoneE164US(undefined)).toBe("");
  });

  it("rejects too-short or too-long digit runs", () => {
    expect(normalizePhoneE164US("123")).toBe("");
    expect(normalizePhoneE164US("123456789")).toBe(""); // 9 digits
    // 11-digit not starting with 1 is also rejected
    expect(normalizePhoneE164US("25555551234")).toBe("");
  });

  it("preserves international E.164 lengths between 10 and 15", () => {
    expect(normalizePhoneE164US("+442071838750")).toBe("+442071838750");
  });
});

describe("normalizeName", () => {
  it("trims surrounding whitespace and collapses internal whitespace", () => {
    expect(normalizeName("  jane  doe  ")).toBe("Jane Doe");
  });

  it("title-cases an all-uppercase name", () => {
    expect(normalizeName("JANE DOE")).toBe("Jane Doe");
  });

  it("title-cases an all-lowercase name", () => {
    expect(normalizeName("jane doe")).toBe("Jane Doe");
  });

  it("preserves mixed-case names like McDermott and O'Brien untouched", () => {
    expect(normalizeName("McDermott")).toBe("McDermott");
    expect(normalizeName("O'Brien")).toBe("O'Brien");
    expect(normalizeName("De La Cruz")).toBe("De La Cruz");
  });

  it("returns empty string for empty / undefined input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });

  it("title-cases across apostrophes and hyphens", () => {
    expect(normalizeName("o'brien")).toBe("O'Brien");
    expect(normalizeName("smith-jones")).toBe("Smith-Jones");
  });
});

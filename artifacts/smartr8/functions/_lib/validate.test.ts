import { describe, it, expect } from "vitest";
import { validateLeadSubmission } from "./validate";

function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "5555551234",
    funnel: "heloc",
    turnstile_token: "t_valid_token_value",
    consent_version: "2026-05-27.v1",
    consent_text: "I agree to be contacted.",
    ...overrides,
  };
}

describe("validateLeadSubmission", () => {
  it("accepts a valid payload from a v2 form", () => {
    const result = validateLeadSubmission(basePayload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.firstName).toBe("Jane");
      expect(result.data.funnel).toBe("heloc");
      expect(result.data.turnstile_token).toBe("t_valid_token_value");
    }
  });

  it("accepts a worksheet-funnel payload with minimal fields", () => {
    const result = validateLeadSubmission(
      basePayload({ funnel: "worksheet", phone: "" }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = validateLeadSubmission(basePayload({ firstName: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.firstName).toBeDefined();
  });

  it("rejects missing email", () => {
    const result = validateLeadSubmission(basePayload({ email: undefined }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBeDefined();
  });

  it("rejects a malformed email", () => {
    const result = validateLeadSubmission(basePayload({ email: "not-an-email" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toMatch(/email/i);
  });

  it("rejects missing turnstile_token", () => {
    const result = validateLeadSubmission(basePayload({ turnstile_token: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.turnstile_token).toBeDefined();
  });

  it("rejects missing consent_version", () => {
    const result = validateLeadSubmission(basePayload({ consent_version: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.consent_version).toBeDefined();
  });

  it("rejects consent_text over 2000 characters", () => {
    const tooLong = "x".repeat(2001);
    const result = validateLeadSubmission(basePayload({ consent_text: tooLong }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.consent_text).toBeDefined();
  });

  it("accepts consent_text exactly at the 2000 char boundary", () => {
    const atBoundary = "x".repeat(2000);
    const result = validateLeadSubmission(basePayload({ consent_text: atBoundary }));
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object input", () => {
    const result = validateLeadSubmission("not-an-object");
    expect(result.ok).toBe(false);
  });
});

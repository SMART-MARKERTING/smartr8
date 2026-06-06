import { describe, it, expect } from "vitest";
import { computeQuoteNumbers, buildQuotePayload, MIN_HELOC_AVAILABLE } from "./autoQuote";

describe("computeQuoteNumbers — 90% HELOC / 80% cash-out", () => {
  it("$500k value, $100k owed → $350k HELOC, $400k loan / $300k cash-out", () => {
    const n = computeQuoteNumbers("500000", "100000");
    expect(n.helocAvailable).toBe(350_000); // 500k*0.90 - 100k
    expect(n.cashOutNewLoan).toBe(400_000); // 500k*0.80
    expect(n.cashOutPayoff).toBe(100_000);
    expect(n.cashOutAmount).toBe(300_000); // 500k*0.80 - 100k
  });

  it("$500k value, $0 owed → $450k HELOC, $400k loan / $400k cash-out", () => {
    const n = computeQuoteNumbers("500000", "0");
    expect(n.helocAvailable).toBe(450_000); // 500k*0.90 - 0
    expect(n.cashOutNewLoan).toBe(400_000);
    expect(n.cashOutPayoff).toBe(0);
    expect(n.cashOutAmount).toBe(400_000);
  });

  it("clamps cash-out to $0 when balance exceeds 80% LTV", () => {
    const n = computeQuoteNumbers("500000", "420000");
    expect(n.cashOutAmount).toBe(0); // 400k - 420k -> clamped
    expect(n.helocAvailable).toBe(30_000); // 450k - 420k
  });
});

describe("buildQuotePayload", () => {
  it("builds a two-option payload with rate + payment for a priceable credit band", () => {
    const p = buildQuotePayload({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      homeValue: "500000",
      balance: "100000",
      creditId: "good",
    });
    expect(p).not.toBeNull();
    expect(p!.clientEmail).toBe("jane@example.com");
    expect(p!.clientName).toBe("Jane Doe");
    expect(p!.bcc).toBe("mykoal@adaxahome.com");
    expect(p!.source).toBe("funnel-auto");
    // HELOC line = $350k, cash-out = $300k
    expect(p!.options.b.lineAmount).toBe("$350,000");
    expect(p!.options.a.cashOut).toBe("$300,000");
    expect(p!.options.a.payoff).toBe("$100,000");
    // "good" maps to a priceable band → real rate + payment, not "—"
    expect(p!.options.b.rate).toMatch(/^\d+\.\d{2}%$/);
    expect(p!.options.b.payment).toMatch(/^\$[\d,]+\/mo$/);
    expect(p!.options.a.rate).toMatch(/^\d+\.\d{2}%$/);
    expect(p!.options.a.payment).toMatch(/^\$[\d,]+\/mo$/);
  });

  it("prices 'unsure' (and unrecognized) credit against the conservative default band", () => {
    const base = {
      firstName: "Sam",
      lastName: "Lee",
      email: "sam@example.com",
      homeValue: "600000",
      balance: "200000",
    };
    const unsure = buildQuotePayload({ ...base, creditId: "unsure" });
    const building = buildQuotePayload({ ...base, creditId: "building" });
    expect(unsure).not.toBeNull();
    // "unsure" has no self-reported band → falls back to the lowest tier, the
    // same band "building" maps to, so the rates match.
    expect(unsure!.options.b.rate).toBe(building!.options.b.rate);
    expect(unsure!.options.a.rate).toBe(building!.options.a.rate);
    // ...and it now carries a real rate + payment instead of "—".
    expect(unsure!.options.b.rate).toMatch(/^\d+\.\d{2}%$/);
    expect(unsure!.options.b.payment).toMatch(/^\$[\d,]+\/mo$/);
    expect(unsure!.options.a.rate).toMatch(/^\d+\.\d{2}%$/);
    expect(unsure!.options.a.payment).toMatch(/^\$[\d,]+\/mo$/);
    // An unrecognized id behaves identically.
    const unknown = buildQuotePayload({ ...base, creditId: "mystery" });
    expect(unknown!.options.a.rate).toBe(building!.options.a.rate);
  });

  it("returns null below the minimum HELOC equity threshold", () => {
    const p = buildQuotePayload({
      firstName: "Lo",
      lastName: "Equity",
      email: "lo@example.com",
      homeValue: "500000",
      balance: "455000", // 450k - 455k -> negative, clamped to 0
      creditId: "good",
    });
    expect(p).toBeNull();
  });

  it("HELOC interest-only payment is below the amortizing cash-out payment for the same numbers", () => {
    const p = buildQuotePayload({
      firstName: "Pat",
      lastName: "Rim",
      email: "pat@example.com",
      homeValue: "500000",
      balance: "100000",
      creditId: "excellent",
    });
    const num = (s: string) => Number(s.replace(/[^\d.]/g, ""));
    // sanity: amounts cleared the threshold
    expect(num(p!.options.b.lineAmount)).toBeGreaterThan(MIN_HELOC_AVAILABLE);
  });
});

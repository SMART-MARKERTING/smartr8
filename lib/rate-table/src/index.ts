/**
 * Shared rate estimate table for SMARTR8 web and mobile funnels.
 *
 * To update rates: edit RATE_TABLE below. Both the web and mobile experiences
 * will automatically pick up the change on the next build.
 *
 * Ranges are illustrative ballpark figures — actual rates depend on full
 * underwriting, LTV, property type, and lock period.
 *
 * Last reviewed: mid-2026
 */

export type FunnelId = "heloc" | "cashout" | "rate-reduction" | "purchase";

export interface RateRange {
  low: string;
  high: string;
  label: string;
}

export const RATE_TABLE: Record<FunnelId, Record<string, RateRange>> = {
  heloc: {
    "580 – 619": { low: "9.50", high: "11.50", label: "variable APR" },
    "620 – 659": { low: "9.00", high: "10.75", label: "variable APR" },
    "660 – 699": { low: "8.50", high: "10.00", label: "variable APR" },
    "700 – 739": { low: "8.00", high: "9.25",  label: "variable APR" },
    "740 – 779": { low: "7.75", high: "8.75",  label: "variable APR" },
    "780+":      { low: "7.50", high: "8.25",  label: "variable APR" },
  },
  cashout: {
    "580 – 619": { low: "8.25", high: "9.75", label: "30-yr fixed" },
    "620 – 659": { low: "7.75", high: "9.00", label: "30-yr fixed" },
    "660 – 699": { low: "7.25", high: "8.25", label: "30-yr fixed" },
    "700 – 739": { low: "6.88", high: "7.50", label: "30-yr fixed" },
    "740 – 779": { low: "6.50", high: "7.13", label: "30-yr fixed" },
    "780+":      { low: "6.25", high: "6.88", label: "30-yr fixed" },
  },
  "rate-reduction": {
    "580 – 619": { low: "7.88", high: "9.25", label: "30-yr fixed" },
    "620 – 659": { low: "7.25", high: "8.50", label: "30-yr fixed" },
    "660 – 699": { low: "6.88", high: "7.75", label: "30-yr fixed" },
    "700 – 739": { low: "6.50", high: "7.13", label: "30-yr fixed" },
    "740 – 779": { low: "6.13", high: "6.75", label: "30-yr fixed" },
    "780+":      { low: "5.88", high: "6.50", label: "30-yr fixed" },
  },
  purchase: {
    "580 – 619": { low: "7.88", high: "9.25", label: "30-yr fixed" },
    "620 – 659": { low: "7.25", high: "8.50", label: "30-yr fixed" },
    "660 – 699": { low: "6.88", high: "7.75", label: "30-yr fixed" },
    "700 – 739": { low: "6.50", high: "7.13", label: "30-yr fixed" },
    "740 – 779": { low: "6.13", high: "6.75", label: "30-yr fixed" },
    "780+":      { low: "5.88", high: "6.50", label: "30-yr fixed" },
  },
};

/**
 * Normalize a credit score string from funnel form format (plain hyphen
 * "580 - 619") to the table key format (en dash "580 – 619").
 */
function normalizeScore(creditScore: string): string {
  return creditScore.replace(/\s*-\s*/g, " – ");
}

export function getRateEstimate(
  creditScore: string,
  funnel: string
): RateRange | null {
  if (!creditScore || creditScore === "Not sure") return null;
  const funnelKey = funnel as FunnelId;
  const table = RATE_TABLE[funnelKey];
  if (!table) return null;
  const normalized = normalizeScore(creditScore);
  return table[normalized] ?? null;
}

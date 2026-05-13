import { useEffect } from "react";
import {
  getRateEstimate,
  loadRateContext,
  loadRateContextFromSearch,
  clearRateContext,
  type RateRange,
  type FunnelId,
} from "@/lib/rateEstimate";

interface RateEstimateCardProps {
  creditScore?: string;
  funnel?: FunnelId;
}

/**
 * Shows a ballpark rate estimate based on the credit score collected during
 * the funnel.
 *
 * Resolution order (first match wins):
 *  1. Props passed directly by the parent
 *  2. sessionStorage (populated by funnel submit handlers)
 *  3. URL search params `?credit=...&funnel=...` (durable fallback for refreshes)
 *
 * sessionStorage is cleared after the first successful render so stale data
 * from a previous session doesn't reappear on future visits.
 *
 * Returns null if no context is available or the credit score is "Not sure".
 */
export function RateEstimateCard({ creditScore, funnel }: RateEstimateCardProps) {
  let resolvedScore = creditScore;
  let resolvedFunnel = funnel;
  let resolvedFromSession = false;

  if (!resolvedScore || !resolvedFunnel) {
    const ctx = loadRateContext();
    if (ctx) {
      resolvedScore = resolvedScore ?? ctx.creditScore;
      resolvedFunnel = resolvedFunnel ?? ctx.funnel;
      resolvedFromSession = true;
    }
  }

  if (!resolvedScore || !resolvedFunnel) {
    const ctx = loadRateContextFromSearch(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (ctx) {
      resolvedScore = resolvedScore ?? ctx.creditScore;
      resolvedFunnel = resolvedFunnel ?? ctx.funnel;
    }
  }

  const hasData = !!(resolvedScore && resolvedFunnel);

  useEffect(() => {
    if (hasData && resolvedFromSession) {
      clearRateContext();
    }
  }, [hasData, resolvedFromSession]);

  if (!resolvedScore || !resolvedFunnel) return null;

  const estimate: RateRange | null = getRateEstimate(resolvedScore, resolvedFunnel);
  if (!estimate) return null;

  const funnelLabel: Record<FunnelId, string> = {
    heloc: "HELOC",
    cashout: "Cash-Out Refi",
    "rate-reduction": "Rate Reduction",
    purchase: "Purchase",
  };

  return (
    <div
      className="w-full rounded-xl border px-6 py-5 text-left"
      style={{
        backgroundColor: "rgba(19,72,90,0.06)",
        borderColor: "rgba(19,72,90,0.18)",
      }}
      data-testid="rate-estimate-card"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p
            className="text-xs font-bold tracking-widest uppercase mb-1"
            style={{ color: "#13485A" }}
          >
            Your Estimated Rate · {funnelLabel[resolvedFunnel]}
          </p>
          <p
            className="text-3xl font-bold tabular-nums"
            style={{ color: "#13485A" }}
          >
            {estimate.low}% – {estimate.high}%{" "}
            <span className="text-base font-medium opacity-70">
              {estimate.label}
            </span>
          </p>
        </div>
        <div
          className="text-xs rounded-lg px-4 py-3 leading-relaxed max-w-xs"
          style={{
            backgroundColor: "rgba(19,72,90,0.08)",
            color: "#13485A",
          }}
        >
          Based on a credit score of{" "}
          <span className="font-semibold">{resolvedScore}</span>. Actual rate
          depends on LTV, property type, full underwriting, and lock period.
          Not a commitment to lend.
        </div>
      </div>
    </div>
  );
}

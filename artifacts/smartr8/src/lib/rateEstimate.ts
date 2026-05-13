/**
 * Client-side rate estimate helpers for the web funnel.
 *
 * The rate table itself lives in @workspace/rate-table — update it there
 * and both the web and mobile experiences will stay in sync automatically.
 */

export type { FunnelId, RateRange } from "@workspace/rate-table";
export { RATE_TABLE, getRateEstimate } from "@workspace/rate-table";

/** sessionStorage key used to hand off lead data to confirmation pages */
export const RATE_ESTIMATE_SESSION_KEY = "smartr8_rate_context";

import type { FunnelId } from "@workspace/rate-table";

export interface RateContext {
  creditScore: string;
  funnel: FunnelId;
}

export function saveRateContext(ctx: RateContext): void {
  try {
    sessionStorage.setItem(RATE_ESTIMATE_SESSION_KEY, JSON.stringify(ctx));
  } catch {
    // sessionStorage may be unavailable in certain browser contexts
  }
}

export function loadRateContext(): RateContext | null {
  try {
    const raw = sessionStorage.getItem(RATE_ESTIMATE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RateContext;
  } catch {
    return null;
  }
}

export function clearRateContext(): void {
  try {
    sessionStorage.removeItem(RATE_ESTIMATE_SESSION_KEY);
  } catch {
    // sessionStorage may be unavailable in certain browser contexts
  }
}

/**
 * Read rate context from the current page's URL search params.
 * URL params `credit` and `funnel` are added by funnel submit handlers as a
 * durable fallback that survives page refreshes (unlike sessionStorage).
 */
export function loadRateContextFromSearch(search: string): RateContext | null {
  try {
    const params = new URLSearchParams(search);
    const creditScore = params.get("credit");
    const funnel = params.get("funnel") as FunnelId | null;
    if (!creditScore || !funnel) return null;
    return { creditScore, funnel };
  } catch {
    return null;
  }
}

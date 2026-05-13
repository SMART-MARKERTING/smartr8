/**
 * Client-side rate estimate helpers for the mobile funnel.
 *
 * The rate table itself lives in @workspace/rate-table — update it there
 * and both the web and mobile experiences will stay in sync automatically.
 */

export type { FunnelId, RateRange } from "@workspace/rate-table";
export { RATE_TABLE, getRateEstimate } from "@workspace/rate-table";

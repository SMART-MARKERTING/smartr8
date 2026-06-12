// Compliance + licensing config for the conversion funnels.
//
// The exported names mirror the {{PLACEHOLDER}} contract shared with the
// mykoal.com repo so the TrustBlock / ComplianceFooter component API matches
// across both sites. Values here are the real, public, site-wide figures that
// are ALREADY rendered in <Footer/> and the funnel trust rows (NMLS numbers,
// licensed states, EHO) — so live pages show real text, not "{{...}}".
//
// Genuinely unknown / compliance-pending fields stay as literal {{PLACEHOLDER}}
// tokens so they are obvious on-page and grep-able until legal fills them in.

/** {{LO_NAME}} */
export const LO_NAME = "Mykoal DeShazo";
/** {{NMLS_ID}} — loan officer NMLS. */
export const NMLS_ID = "1912347";
/** {{COMPANY_NMLS_ID}} — Adaxa Home, LLC company NMLS. */
export const COMPANY_NMLS_ID = "2380533";
/** Brokerage / company legal name. */
export const COMPANY_NAME = "Adaxa Home, LLC";
/** {{EQUAL_HOUSING_TEXT}} */
export const EQUAL_HOUSING_TEXT = "Equal Housing Opportunity";

/** {{LICENSED_STATES}} — the states the LO is licensed in. */
export const LICENSED_STATES = [
  "AZ", "CO", "CT", "FL", "MI", "MN", "OR", "PA", "TX", "VA", "WA",
] as const;

/** Human-readable licensed-states sentence, reused verbatim in FAQ schema. */
export const LICENSED_STATES_TEXT = `Licensed in ${LICENSED_STATES.join(", ")}.`;

// ── Compliance-pending placeholders ─────────────────────────────────────────
// Kept as literal {{PLACEHOLDER}} tokens until legal/compliance supplies the
// approved copy. These render verbatim on-page on purpose.

/** {{COMPLIANCE_REVIEW_DATE}} — date the funnel copy was last compliance-reviewed. */
export const COMPLIANCE_REVIEW_DATE = "{{COMPLIANCE_REVIEW_DATE}}";

/** {{VA_DISCLAIMER_TEXT}} — required VA-page disclaimer. Compliance-pending. */
export const VA_DISCLAIMER_TEXT = "{{VA_DISCLAIMER_TEXT}}";

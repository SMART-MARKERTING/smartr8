// Single source of truth for the TCPA consent text + version, plus the
// post-submit transactional notice rendered below every form's submit button.
//
// CONSENT_TEXT is stored verbatim in the D1 tcpa_consents row alongside the
// lead. CONSENT_VERSION is bumped any time the wording changes so we can
// prove which version a given consent record agreed to. Old records keep
// their original version (column is per-row).
//
// VITE_TCPA_CONSENT_VERSION env override exists so an operator can flip
// the version (e.g., for an A/B copy test or a hotfix) without redeploying.
// Falls back to the hardcoded default below when the env var isn't set.
//
// SUBMIT_NOTICE is the transactional acknowledgment shown below the submit
// button on every contact form — it conveys implied consent for THIS
// inquiry (which is required to submit) separate from the OPTIONAL
// marketing-SMS consent in CONSENT_TEXT.
//
// CONSENT_TEXT 2026-06-01.v4 — rewritten to follow Telnyx's 10DLC opt-in
// template after the DeShazo Wealth campaign (TCR ID CPO2A0R) was rejected
// for missing required A2P phrases. Includes: brand name, marketing
// use-case qualifier, STOP/HELP, message frequency, msg & data rates,
// "consent is not a condition of purchase", and the explicit "mobile
// information will not be sold or shared" privacy carve-out.

export const CONSENT_VERSION =
  (import.meta.env.VITE_TCPA_CONSENT_VERSION as string | undefined) ||
  "2026-06-01.v4";

export const CONSENT_TEXT =
  "By providing my phone number and checking this box, I agree to receive " +
  "recurring SMS messages about mortgage and home-equity loan options from " +
  "Mykoal DeShazo (NMLS #1912347) and Adaxa Home, LLC (NMLS #2380533). I " +
  "am opting into marketing texts. Message frequency may vary. Standard " +
  "Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for " +
  "help. Consent is not a condition of purchase. My mobile information " +
  "will not be sold or shared with third parties for promotional or " +
  "marketing purposes.";

export const SUBMIT_NOTICE =
  "By clicking Submit, I request that Mykoal DeShazo and Adaxa Home contact " +
  "me about my inquiry using the contact information I provided. I acknowledge " +
  "the Privacy Policy and Terms of Service.";

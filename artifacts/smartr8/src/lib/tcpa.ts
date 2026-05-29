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
// marketing consent in CONSENT_TEXT.

export const CONSENT_VERSION =
  (import.meta.env.VITE_TCPA_CONSENT_VERSION as string | undefined) ||
  "2026-05-29.v1";

export const CONSENT_TEXT =
  "Optional: I consent to receive calls, texts, and emails from Mykoal " +
  "DeShazo (NMLS #1912347) and Adaxa Home (NMLS #2380533) about " +
  "mortgage and home-equity options, including via autodialer or " +
  "prerecorded messages. Consent isn't required. Msg & data rates may " +
  "apply. Reply STOP to opt out.";

export const SUBMIT_NOTICE =
  "By clicking Submit, I request that Mykoal DeShazo and Adaxa Home contact " +
  "me about my inquiry using the contact information I provided. I acknowledge " +
  "the Privacy Policy and Terms of Service.";

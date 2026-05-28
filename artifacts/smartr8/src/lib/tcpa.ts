// Single source of truth for the TCPA consent text + version, plus the
// post-submit transactional notice rendered below every form's submit button.
//
// CONSENT_TEXT is stored verbatim in the D1 tcpa_consents row alongside the
// lead. CONSENT_VERSION is bumped any time the wording changes so we can
// prove which version a given consent record agreed to. Old records keep
// their original version (column is per-row).
//
// SUBMIT_NOTICE is the transactional acknowledgment shown below the submit
// button on every contact form — it conveys implied consent for THIS
// inquiry (which is required to submit) separate from the OPTIONAL marketing
// consent in CONSENT_TEXT.

export const CONSENT_VERSION = "2026-05-28.v2";

export const CONSENT_TEXT =
  "Optional: By checking this box, I consent to receive calls, SMS/MMS texts, " +
  "and emails from Mykoal DeShazo (NMLS #1912347) and Adaxa Home (NMLS #2380533) " +
  "at the phone number and email I provided regarding mortgage and home-equity " +
  "loan options. Calls and texts may use an autodialer, automated technology, " +
  "or artificial/prerecorded voice. Consent is not required to submit this form " +
  "or purchase goods or services. Message and data rates may apply. Message " +
  "frequency may vary. Reply STOP to opt out or HELP for help. I may also " +
  "revoke consent by contacting Mykoal directly.";

export const SUBMIT_NOTICE =
  "By clicking Submit, I request that Mykoal DeShazo and Adaxa Home contact " +
  "me about my inquiry using the contact information I provided. I acknowledge " +
  "the Privacy Policy and Terms of Service.";

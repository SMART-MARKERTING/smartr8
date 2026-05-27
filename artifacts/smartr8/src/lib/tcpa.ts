// Single source of truth for the TCPA consent text + version.
//
// CONSENT_TEXT is stored verbatim in the D1 tcpa_consents row alongside
// the lead. CONSENT_VERSION is bumped any time the wording changes so we
// can prove which version a given consent record agreed to.

export const CONSENT_VERSION = "2026-05-27.v1";

export const CONSENT_TEXT =
  "By checking this box and submitting this form, I agree that Mykoal DeShazo " +
  "(NMLS #1912347) and Adaxa Home (NMLS #2380533) may contact me at the email " +
  "and phone number provided, including by autodialed calls, prerecorded " +
  "messages, SMS and MMS texts, and email regarding mortgage loan options, " +
  "even if my number is on a Do Not Call list. Message and data rates may " +
  "apply. Consent is not a condition of any purchase. I may revoke consent " +
  "at any time by replying STOP to any text or contacting Mykoal directly. " +
  "I also acknowledge the Privacy Policy and Terms of Service.";

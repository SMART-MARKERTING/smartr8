// @ts-nocheck
// POST /api/crm-lead
//
// Thin, secure proxy from the product funnels (DSCR, Cash Out Refi, Rate and
// Term Refi, Purchase) to the CRM lead-intake webhook at
// https://crm.smartr8.com/webhooks/lead. The webhook is secret-gated (?key=…)
// and that key must never ship in the browser bundle, so the funnels POST to
// this same-origin endpoint and the Function attaches the key server-side and
// forwards the lead on.
//
// Pipeline:
//   1. JSON parse + honeypot + <8s on-page bot drop (silent 200, same as
//      /api/submit-lead so spam never reaches the CRM).
//   2. Turnstile siteverify (when a token is supplied).
//   3. Build the CRM payload. `loanType` is the product tag the CRM uses to
//      enroll the lead into the matching drip campaign; `consent` reflects the
//      OPTIONAL SMS-consent checkbox so the CRM only texts opted-in leads.
//   4. Forward to the CRM webhook (key carried in CRM_LEAD_WEBHOOK or the
//      built-in default URL). Best-effort: a CRM failure still returns success
//      to the visitor so a transient CRM blip never loses the lead from the
//      user's perspective (the funnel has already captured intent).

import { log } from "../_lib/log";
import { verifyTurnstile } from "../_lib/turnstile";
import { handleLeadEmail } from "../_lib/leadEmail";
import type { Env } from "../_lib/types";

// Built-in default mirrors functions/_lib/orchestrate.ts so the funnels work
// out of the box; env.CRM_LEAD_WEBHOOK overrides it (e.g. to rotate the key).
const CRM_LEAD_WEBHOOK_URL =
  "https://crm.smartr8.com/webhooks/lead?key=4519413906c139e16484f518fdd8968c";

const VALID_LOAN_TYPES = new Set(["HELOC", "DSCR", "CASHOUT_REFI", "RT_REFI", "PURCHASE"]);

const ALLOWED_ORIGINS = new Set(["https://smartr8.com", "https://www.smartr8.com"]);
function isAllowedOrigin(o) {
  return ALLOWED_ORIGINS.has(o) || /^https:\/\/[^.]+\.pages\.dev$/.test(o);
}
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smartr8.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  // Honeypot: a filled hidden field means a bot. Silent success so the bot
  // gets no signal that it was caught.
  if (body.honeypot && String(body.honeypot).trim().length > 0) {
    log("info", "crm_lead.honeypot_drop", {});
    return jsonResponse({ success: true }, 200, cors);
  }
  // Sub-8s submissions are almost always bots auto-filling the form on load.
  if (body.pageLoadTime && body.pageLoadTime > 0) {
    const elapsed = Date.now() - body.pageLoadTime;
    if (elapsed < 8_000) {
      log("info", "crm_lead.too_fast_drop", { elapsed });
      return jsonResponse({ success: true }, 200, cors);
    }
  }

  const firstName = str(body.firstName) || str(body.first_name);
  const lastName = str(body.lastName) || str(body.last_name);
  const email = str(body.email);
  const phone = str(body.phone);
  const loanType = str(body.loanType).toUpperCase();
  const smsConsent = body.consent === true || body.consent === "true";

  // Qualifying criteria → the CRM lead's Quote/loan-details panel + DOB.
  const homeValue = str(body.home_value) || str(body.homeValue);
  const mortgageBalance = str(body.mortgage_balance) || str(body.mortgageBalance);
  const credit = str(body.credit) || str(body.creditScore);
  const dob = str(body.dob);
  const criteriaNotes = [
    homeValue ? `Home Value: ${homeValue}` : "",
    mortgageBalance ? `Mortgage Balance: ${mortgageBalance}` : "",
    credit ? `Credit Score: ${credit}` : "",
    dob ? `DOB: ${dob}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (!email && !phone) {
    return jsonResponse({ success: false, error: "Enter an email or phone number." }, 400, cors);
  }
  if (!VALID_LOAN_TYPES.has(loanType)) {
    return jsonResponse({ success: false, error: "Unknown loan type." }, 400, cors);
  }
  // A ticked SMS-consent box requires a phone number to text — enforce it
  // server-side too (the form enforces it as well).
  if (smsConsent && !phone) {
    return jsonResponse({ success: false, error: "A phone number is required to opt into texts." }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";

  // Turnstile is verified when a token is supplied. The funnels render the
  // widget, so a missing token on a real submission is unusual; we still
  // forward token-less submissions (audited) rather than lose a lead, matching
  // /api/submit-lead's posture.
  if (body.turnstile_token) {
    const ts = await verifyTurnstile((env as Env).TURNSTILE_SECRET_KEY, String(body.turnstile_token), ip);
    if (!ts.ok) return jsonResponse({ success: false, error: `turnstile: ${ts.error}` }, 403, cors);
  }

  // Payload for the CRM webhook. `loanType` is not a CRM "known field", so it
  // lands in the lead's `custom` map — which is exactly where the campaign
  // filter reads it to enroll the lead into the right drip. `tags` is sent too
  // so the loan type shows on the lead once the CRM honors it.
  const payload = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    source: str(body.source) || "smartr8.com",
    // Submitting the funnel implies email consent; the optional checkbox is the SMS
    // opt-in. The CRM reads `smsOptIn` for SMS consent and `consent` for email.
    consent: true,
    smsOptIn: smsConsent ? "yes" : "no",
    loanType,
    tags: [loanType],
    consent_text: str(body.consent_text),
    consent_version: str(body.consent_version),
    // Structured quote fields (CRM maps these into the lead's custom Quote panel) +
    // a readable notes summary (mirrors the HELOC funnel; the CRM also parses it).
    home_value: homeValue,
    mortgage_balance: mortgageBalance,
    credit,
    dob,
    notes: criteriaNotes,
    page_url: str(body.page_url),
    utm_source: str(body.utm_source),
    utm_medium: str(body.utm_medium),
    utm_campaign: str(body.utm_campaign),
    utm_content: str(body.utm_content),
    utm_term: str(body.utm_term),
  };

  // Send the branded "thanks for reaching out" email (the same transactional email
  // the older capture funnels send) so every funnel lead gets one welcome. No-ops if
  // RESEND_API_KEY is not bound; KV dedup applies when CF_KV_NAMESPACE is set.
  const funnelForSubject =
    { CASHOUT_REFI: "cash-out", PURCHASE: "purchase", RT_REFI: "rate-reduction", HELOC: "heloc", DSCR: "dscr" }[loanType] || "";
  if (email && firstName) {
    const emailJob = handleLeadEmail(env, { firstName, email, funnel: funnelForSubject });
    if (typeof waitUntil === "function") waitUntil(emailJob);
    else await emailJob;
  }

  const url = (env as Env).CRM_LEAD_WEBHOOK || CRM_LEAD_WEBHOOK_URL;
  const forward = (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        log("warn", "crm_lead.webhook_failed", { status: res.status, body: text.slice(0, 200), loanType });
      } else {
        log("info", "crm_lead.webhook_ok", { loanType });
      }
    } catch (e) {
      log("warn", "crm_lead.webhook_error", { err: e instanceof Error ? e.message : String(e), loanType });
    }
  })();

  // Don't make the visitor wait on the CRM round-trip; let it finish after the
  // response is sent. We still report success — the lead is captured intent.
  if (typeof waitUntil === "function") waitUntil(forward);
  else await forward;

  return jsonResponse({ success: true }, 200, cors);
}

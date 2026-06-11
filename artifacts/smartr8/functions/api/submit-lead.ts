// @ts-nocheck
// POST /api/submit-lead
//
// Validation pipeline:
//   1. JSON parse  + honeypot + <8s bot drop (existing legacy filters)
//   2. zod schema validation (field-level errors -> 400)
//   3. Turnstile siteverify
//   4. Per-IP rate limit (5/min) via CF_KV_NAMESPACE (legacy belt-and-suspenders)
//   5. Normalize (email, phone E.164, names)
//   6. Build canonical Lead
//   7. processLead (D1 audit + dedup KV + sync LM + async GHL/Resend/Sendblue)
//
// Browser-side LeadMailbox fallback (when LM IP-blocks the Worker) is
// PRESERVED as a tertiary path: orchestrator returns the fallbackPayload
// inside the leadmailbox result and we relay it to the client so the
// existing src/lib/submitLead.ts browser-fallback fetch can fire.

import { log } from "../_lib/log";
import { normalizeEmail, normalizeName, normalizePhoneE164US } from "../_lib/normalize";
import { processLead } from "../_lib/orchestrate";
import { verifyTurnstile } from "../_lib/turnstile";
import type { Env, Lead, TcpaConsent } from "../_lib/types";
import { validateLeadSubmission } from "../_lib/validate";

const ALLOWED_ORIGINS = new Set(["https://smartr8.com", "https://www.smartr8.com"]);
function isAllowedOrigin(o) { return ALLOWED_ORIGINS.has(o) || /^https:\/\/[^.]+\.pages\.dev$/.test(o); }
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smartr8.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, cors);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Invalid JSON body" }, 400, cors); }

  // Legacy: honeypot silent-drop
  if (body.honeypot && String(body.honeypot).trim().length > 0) {
    log("info", "submit_lead.honeypot_drop", {});
    return jsonResponse({ success: true }, 200, cors);
  }
  // Legacy: <8s on-page silent-drop
  if (body.pageLoadTime && body.pageLoadTime > 0) {
    const elapsed = Date.now() - body.pageLoadTime;
    if (elapsed < 8_000) {
      log("info", "submit_lead.too_fast_drop", { elapsed });
      return jsonResponse({ success: true }, 200, cors);
    }
  }

  // Zod validation
  const v = validateLeadSubmission(body);
  if (!v.ok) return jsonResponse({ success: false, errors: v.errors }, 400, cors);

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";
  const userAgent = request.headers.get("User-Agent") ?? "";
  // Explicit clientIp for downstream forwarding to LeadMailbox (LM rejects
  // Cloudflare egress IPs without an X-Forwarded-For from the real visitor).
  const clientIp = request.headers.get("CF-Connecting-IP") || "";

  // Turnstile is verified only when a token is supplied. Legacy forms
  // that haven't been migrated to <TcpaConsent /> yet send no token and
  // pass through (still rate-limited and audited).
  if (v.data.turnstile_token) {
    const ts = await verifyTurnstile((env as Env).TURNSTILE_SECRET_KEY, v.data.turnstile_token, ip);
    if (!ts.ok) return jsonResponse({ success: false, error: `turnstile: ${ts.error}` }, 403, cors);
  }

  // Per-IP rate limit (5/min) via CF_KV_NAMESPACE — belt-and-suspenders.
  if ((env as Env).CF_KV_NAMESPACE) {
    try {
      const key = `rate:${ip}`;
      const raw = await (env as Env).CF_KV_NAMESPACE!.get(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= 5) {
        return jsonResponse({ success: false, error: "Too many requests, please try again later" }, 429, cors);
      }
      await (env as Env).CF_KV_NAMESPACE!.put(key, String(count + 1), { expirationTtl: 60 });
    } catch (e) {
      log("warn", "submit_lead.rate_limit_error", { err: e instanceof Error ? e.message : String(e) });
    }
  }

  // Normalize + build canonical Lead
  const firstName = normalizeName(v.data.firstName);
  const lastName = normalizeName(v.data.lastName);
  const email = normalizeEmail(v.data.email);
  const phone = normalizePhoneE164US(v.data.phone);
  if (v.data.phone && !phone) {
    return jsonResponse({ success: false, errors: { phone: "Phone must be a valid US number" } }, 400, cors);
  }

  // Loan purpose / use-of-funds. The HELOC funnels send it inside additionalFields
  // (helocPurpose / helocPurposes); a funnel may also send it as a top-level loanPurpose.
  // Capture it (+ timeline) so the CRM gets the Goal, not just qualifying numbers.
  const af = (v.data.additionalFields ?? {}) as Record<string, unknown>;
  const afStr = (val: unknown): string =>
    Array.isArray(val) ? val.map((x) => String(x)).filter(Boolean).join(", ") : val == null ? "" : String(val);
  let loanPurpose = String(v.data.loanPurpose || "").trim();
  let timeline = "";
  for (const [k, val] of Object.entries(af)) {
    const s = afStr(val).trim();
    if (!s) continue;
    if (!loanPurpose && /purpose|^use$|loan_?goal|^goal$/i.test(k)) loanPurpose = s;
    else if (!timeline && /^timeline$/i.test(k)) timeline = s;
  }

  const notesParts = [];
  if (v.data.homeValue) notesParts.push(`Home Value: ${v.data.homeValue}`);
  if (v.data.mortgageBalance) notesParts.push(`Mortgage Balance: ${v.data.mortgageBalance}`);
  if (v.data.creditScore) notesParts.push(`Credit Score: ${v.data.creditScore}`);
  if (loanPurpose) notesParts.push(`Loan Purpose: ${loanPurpose}`);
  if (timeline) notesParts.push(`Timeline: ${timeline}`);
  if (v.data.dob) notesParts.push(`DOB: ${v.data.dob}`);
  if (v.data.notes) notesParts.push(v.data.notes);

  // Structured quote inputs → forwarded to the CRM, which pre-fills its quote panel from them.
  const quoteFields: Record<string, string> = {};
  if (v.data.homeValue) quoteFields.home_value = String(v.data.homeValue);
  if (v.data.mortgageBalance) quoteFields.mortgage_balance = String(v.data.mortgageBalance);
  if (v.data.creditScore) quoteFields.credit = String(v.data.creditScore);
  if (loanPurpose) quoteFields.loan_goal = loanPurpose; // CRM "Quote / loan details" → Goal field

  const lead: Lead = {
    lead_id: crypto.randomUUID(),
    created_at: Date.now(),
    funnel: v.data.funnel as Lead["funnel"],
    first_name: firstName,
    last_name: lastName,
    email,
    phone_e164: phone,
    address1: v.data.address || "",
    loan_request: v.data.loanRequest || "",
    notes: notesParts.join("\n"),
    quote_fields: quoteFields,
    source: "smartr8.com",
    referrer: v.data.referrer || "",
    landing_page: v.data.page_url,
    utm_source: v.data.utm_source,
    utm_medium: v.data.utm_medium,
    utm_campaign: v.data.utm_campaign,
    utm_content: v.data.utm_content,
    utm_term: v.data.utm_term,
    ip,
    user_agent: userAgent,
  };

  // Build the TCPA consent record only when the user actively checked the
  // optional consent box (consent === true). The text + version fields are
  // sent on every submission regardless of the checkbox so we know which
  // disclosure was SHOWN — the boolean tells us whether they agreed to it.
  const consent: TcpaConsent | null = v.data.consent === true && v.data.consent_text && v.data.consent_version
    ? {
        consent_id: crypto.randomUUID(),
        lead_id: lead.lead_id,
        consent_version: v.data.consent_version,
        consent_text: v.data.consent_text,
        ip,
        user_agent: userAgent,
        page_url: v.data.page_url,
        created_at: lead.created_at,
      }
    : null;

  const result = await processLead(lead, consent, env as Env, { waitUntil }, clientIp);

  // Browser-side LM fallback preserved: when LM IP-blocked the Worker, the
  // orchestrator surfaces the payload here so the client can replay it.
  const lmPayload = !result.leadmailbox.ok && result.leadmailbox.fallbackPayload
    ? result.leadmailbox.fallbackPayload
    : null;

  return jsonResponse(
    {
      success: true,
      lead_id: result.lead_id,
      duplicate: result.duplicate === true,
      lmPayload, // null unless the Worker's LM call was IP-blocked
    },
    200,
    cors,
  );
}

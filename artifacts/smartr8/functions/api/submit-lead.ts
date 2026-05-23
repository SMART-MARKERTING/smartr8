// @ts-nocheck
// Cloudflare Pages Function — POST /api/submit-lead
// Deployed automatically with Cloudflare Pages at /api/submit-lead.
// This file is NOT compiled by Vite; it runs in the Cloudflare Workers edge runtime.
//
// Required bindings (set in Cloudflare Pages dashboard → Settings → Functions):
//   CF_KV_NAMESPACE  — KV namespace for rate-limiting + duplicate detection
//
// LeadMailbox is called client-side (from the browser) to avoid Cloudflare egress IP blocks.
// This Worker handles: bot detection, rate limiting, KV dedup, and Formspree notifications.

import { handleLeadEmail } from "../_lib/leadEmail";

const ALLOWED_ORIGINS = new Set(["https://smartr8.com", "https://www.smartr8.com"]);

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[^.]+\.pages\.dev$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smartr8.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function loanRequest(funnelType) {
  return (
    { heloc: "HELOC", cashout: "Cash-Out Refinance", "rate-reduction": "Rate & Term Refinance", purchase: "Purchase" }[funnelType] ?? "Other"
  );
}

function buildNotes(body, isDuplicate) {
  const af = body.additionalFields ?? {};
  const lines = [];
  if (isDuplicate) lines.push("DUPLICATE_RECENT\n");
  lines.push(
    `Funnel: ${body.funnelType}`,
    `Submitted: ${body.submittedAt ?? new Date().toISOString()}`,
    "Source: smartr8.com",
    `Page URL: ${body.referer ?? ""}`,
    "",
    "ANSWERS:",
  );
  if (body.homeValue) lines.push(`- Home value range: ${body.homeValue}`);
  if (body.mortgageBalance) lines.push(`- Mortgage balance range: ${body.mortgageBalance}`);

  // Legacy HELOC/purchase keys with human-readable labels
  const legacyKeys = new Set();
  const addF = (label, key) => {
    legacyKeys.add(key);
    const v = af[key];
    if (v) lines.push(`- ${label}: ${Array.isArray(v) ? v.join(", ") : v}`);
  };
  addF("Use of funds", "helocPurposes");
  addF("Use of funds", "cashPurposes");
  addF("Timeline", "timeline");
  addF("Cash needed", "cashNeeded");
  addF("Current rate", "currentRate");
  addF("Primary goal", "primaryGoal");
  addF("Property type", "propertyType");
  addF("Loan type interest", "loanType");
  addF("Down payment", "downPayment");
  addF("Purchase price", "purchasePrice");
  addF("Goal", "goal");

  // Catch-all: render unified funnel fields + anything else not handled above
  for (const [key, val] of Object.entries(af)) {
    if (legacyKeys.has(key)) continue;
    if (val === undefined || val === null || val === "") continue;
    lines.push(`- ${key}: ${Array.isArray(val) ? val.join(", ") : val}`);
  }

  if (body.trackingId) lines.push("", `Tracking ID: ${body.trackingId}`);
  if (body.utmSource || body.utmMedium || body.utmCampaign || body.utmContent) {
    lines.push("", "UTM:");
    if (body.utmSource) lines.push(`- Source: ${body.utmSource}`);
    if (body.utmMedium) lines.push(`- Medium: ${body.utmMedium}`);
    if (body.utmCampaign) lines.push(`- Campaign: ${body.utmCampaign}`);
    if (body.utmContent) lines.push(`- Content: ${body.utmContent}`);
  }
  return lines.join("\n");
}

function buildLeadMailboxPayload(body, isDuplicate) {
  return {
    FirstName: body.firstName,
    LastName: body.lastName,
    Email: body.email,
    MobilePhone: (body.phone ?? "").replace(/\D/g, ""),
    DOB: body.dob ?? "",
    Phys_Address: body.address ?? "",
    Phys_City: body.city ?? "",
    Phys_State: body.state ?? "",
    Phys_Zip: body.zip ?? "",
    Credit_Rating: body.creditScore ?? "",
    Prop_Value: body.homeValue ?? "",
    Existing_Loan_Amount: body.mortgageBalance ?? "",
    Loan_Request: loanRequest(body.funnelType),
    Notes: buildNotes(body, isDuplicate),
  };
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Only accept POST
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  // Honeypot — bot filled a hidden field, silently accept
  if (body.honeypot && body.honeypot.trim().length > 0) {
    console.log("[smartr8] honeypot triggered — silent drop");
    return jsonResponse({ success: true }, 200, cors);
  }

  // Time-on-page < 8s — likely bot, silently accept
  if (body.pageLoadTime && body.pageLoadTime > 0) {
    const elapsed = Date.now() - body.pageLoadTime;
    if (elapsed < 8_000) {
      console.log(`[smartr8] submission too fast (${elapsed}ms) — silent drop`);
      return jsonResponse({ success: true }, 200, cors);
    }
  }

  // Required-field validation (phone is optional)
  const missing = ["firstName", "lastName", "email"].filter((f) => !body[f]?.trim());
  if (missing.length > 0) {
    return jsonResponse({ success: false, error: `Missing required fields: ${missing.join(", ")}` }, 400, cors);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return jsonResponse({ success: false, error: "Invalid email address" }, 400, cors);
  }
  // Phone is optional. Only validate the length if one was actually provided.
  const digits = (body.phone ?? "").replace(/\D/g, "");
  if (digits.length > 0 && digits.length < 10) {
    return jsonResponse({ success: false, error: "Phone number must be at least 10 digits" }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";

  // Rate limiting (5 per IP per minute) — requires KV binding
  if (env.CF_KV_NAMESPACE) {
    try {
      const rateKey = `rate:${ip}`;
      const raw = await env.CF_KV_NAMESPACE.get(rateKey);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= 5) {
        return jsonResponse({ success: false, error: "Too many requests, please try again later" }, 429, cors);
      }
      await env.CF_KV_NAMESPACE.put(rateKey, String(count + 1), { expirationTtl: 60 });
    } catch (e) {
      console.error("[smartr8] KV rate-limit error (skipping):", e);
    }
  }

  // Duplicate detection — same email or phone within 60 minutes
  let isDuplicate = false;
  if (env.CF_KV_NAMESPACE) {
    try {
      const emailKey = `dup:${body.email.toLowerCase()}`;
      const phoneKey = digits ? `dup:${digits}` : null;
      const [ed, pd] = await Promise.all([
        env.CF_KV_NAMESPACE.get(emailKey),
        phoneKey ? env.CF_KV_NAMESPACE.get(phoneKey) : Promise.resolve(null),
      ]);
      isDuplicate = !!(ed || pd);
      const puts = [env.CF_KV_NAMESPACE.put(emailKey, "1", { expirationTtl: 3600 })];
      if (phoneKey) puts.push(env.CF_KV_NAMESPACE.put(phoneKey, "1", { expirationTtl: 3600 }));
      await Promise.all(puts);
    } catch (e) {
      console.error("[smartr8] KV duplicate-check error (skipping):", e);
    }
  }

  // Fire the "thanks for starting" lead email server-side (non-blocking).
  // Its own KV dedup prevents re-sending on duplicate/retry submits.
  waitUntil(
    handleLeadEmail(env, {
      firstName: body.firstName,
      email: body.email,
      phone: body.phone,
      funnel: body.funnelType,
      leadId: body.trackingId,
    }).catch((e) => console.error("[leadEmail] submit-lead trigger error:", e)),
  );

  const lmPayload = buildLeadMailboxPayload(body, isDuplicate);

  // Call LeadMailbox from the Worker, forwarding the user's real IP.
  // LeadMailbox blocks Cloudflare egress IPs, but honors X-Forwarded-For
  // so the user's actual IP is used for validation instead.
  const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";
  let lmSuccess = false;
  try {
    const lmRes = await fetch(LM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
        "True-Client-IP": ip,
      },
      body: JSON.stringify(lmPayload),
    });
    const lmText = await lmRes.text();
    try {
      const lmData = JSON.parse(lmText);
      lmSuccess = lmData.code === 0;
      console.log(`[smartr8] LeadMailbox response: code=${lmData.code} msg=${lmData.message ?? lmData.msg ?? ""}`);
    } catch {
      lmSuccess = lmRes.ok;
      console.log(`[smartr8] LeadMailbox raw response: ${lmText.slice(0, 200)}`);
    }
  } catch (e) {
    console.error("[smartr8] LeadMailbox fetch error:", e);
  }

  // Formspree email notification — use waitUntil so CF doesn't cancel it before it fires
  const FORMSPREE = "https://formspree.io/f/meennekb";
  waitUntil(
    fetch(FORMSPREE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `New Lead — ${body.funnelType ?? body.funnel ?? "unknown"} — ${body.firstName} ${body.lastName}`,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        funnel: body.funnelType ?? body.funnel ?? "",
        homeValue: body.homeValue ?? "",
        mortgageBalance: body.mortgageBalance ?? "",
        creditScore: body.creditScore ?? "",
        state: body.state ?? "",
        zip: body.zip ?? "",
        additionalFields: body.additionalFields ?? {},
        trackingId: body.trackingId ?? "",
        lmSuccess,
      }),
    }).catch((e) => console.error("[smartr8] Formspree error:", e))
  );

  console.log(`[smartr8] validated lead — ${body.funnelType} — ${body.firstName} ${body.lastName} — lmSuccess=${lmSuccess}`);
  // Return lmPayload so browser can retry LM directly if Worker's call was blocked
  return jsonResponse({ success: true, lmPayload: lmSuccess ? null : lmPayload }, 200, cors);
}

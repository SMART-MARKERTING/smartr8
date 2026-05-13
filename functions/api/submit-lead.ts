// @ts-nocheck
// Cloudflare Pages Function — POST /api/submit-lead
// Deployed automatically with Cloudflare Pages at /api/submit-lead.
// This file is NOT compiled by Vite; it runs in the Cloudflare Workers edge runtime.
//
// Required bindings (set in Cloudflare Pages dashboard → Settings → Functions):
//   CF_KV_NAMESPACE  — KV namespace for rate-limiting + duplicate detection
//   FALLBACK_NOTIFICATION_EMAIL — email address for fallback alerts (default: mykoal@smartr8.com)

const LEADMAILBOX_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";
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
  const addF = (label, key) => {
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
    MobilePhone: body.phone.replace(/\D/g, ""),
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

async function sendFallbackEmail(env, body, errMsg) {
  const to = env.FALLBACK_NOTIFICATION_EMAIL ?? "mykoal@smartr8.com";
  const subject = `LEAD FALLBACK — ${body.funnelType} — ${body.firstName} ${body.lastName}`;
  const text = [
    `LeadMailbox submission failed: ${errMsg}`,
    "",
    `Name: ${body.firstName} ${body.lastName}`,
    `Email: ${body.email}`,
    `Phone: ${body.phone}`,
    "",
    buildNotes(body, false),
  ].join("\n");
  try {
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "noreply@smartr8.com", name: "SMARTR8 Lead System" },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
  } catch (e) {
    console.error("[smartr8] MailChannels fallback error:", e);
  }
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
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

  // Required-field validation
  const missing = ["firstName", "lastName", "email", "phone"].filter((f) => !body[f]?.trim());
  if (missing.length > 0) {
    return jsonResponse({ success: false, error: `Missing required fields: ${missing.join(", ")}` }, 400, cors);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return jsonResponse({ success: false, error: "Invalid email address" }, 400, cors);
  }
  const digits = body.phone.replace(/\D/g, "");
  if (digits.length < 10) {
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
      const phoneKey = `dup:${digits}`;
      const [ed, pd] = await Promise.all([
        env.CF_KV_NAMESPACE.get(emailKey),
        env.CF_KV_NAMESPACE.get(phoneKey),
      ]);
      isDuplicate = !!(ed || pd);
      await Promise.all([
        env.CF_KV_NAMESPACE.put(emailKey, "1", { expirationTtl: 3600 }),
        env.CF_KV_NAMESPACE.put(phoneKey, "1", { expirationTtl: 3600 }),
      ]);
    } catch (e) {
      console.error("[smartr8] KV duplicate-check error (skipping):", e);
    }
  }

  // Send to LeadMailbox
  const lmPayload = buildLeadMailboxPayload(body, isDuplicate);
  let leadId;
  let fallback = false;

  try {
    const lmRes = await fetch(LEADMAILBOX_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lmPayload),
    });
    const lmData = await lmRes.json();
    if (lmData.code === 0) {
      leadId = lmData.leadid;
    } else {
      throw new Error(`code=${lmData.code} msg=${lmData.message ?? "unknown"}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[smartr8] LeadMailbox error:", msg);
    fallback = true;
    context.waitUntil(sendFallbackEmail(env, body, msg));
  }

  return jsonResponse({ success: true, leadId, fallback }, 200, cors);
}

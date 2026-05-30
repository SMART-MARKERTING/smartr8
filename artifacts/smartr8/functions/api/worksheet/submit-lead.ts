// @ts-nocheck
// Cloudflare Pages Function — POST /api/worksheet/submit-lead
// Handles internal worksheet email delivery (PDF attachment via Resend)
// and public worksheet lead capture.
//
// Required env bindings (Cloudflare Pages dashboard → Settings → Environment variables):
//   RESEND_API_KEY — Resend API key for sending emails
//   (also accepts RE_worksheet as an alternative name)

import { log } from "../../_lib/log";
import { normalizeEmail, normalizeName, normalizePhoneE164US } from "../../_lib/normalize";
import { processLead } from "../../_lib/orchestrate";
import { verifyTurnstile } from "../../_lib/turnstile";

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

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Returns { ok: boolean, error?: string }
async function sendResendEmail({ apiKey, to, subject, html, pdfBase64, fileName }) {
  const body = {
    from: "Mykoal DeShazo <mykoal@mykoal.com>",
    reply_to: "mykoal@adaxahome.com",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (pdfBase64 && fileName) {
    body.attachments = [{ filename: fileName, content: pdfBase64 }];
  }

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error("[resend] Network error calling Resend API:", networkErr);
    return { ok: false, error: `Network error: ${networkErr}` };
  }

  if (!res.ok) {
    let resBody = "";
    try { resBody = await res.text(); } catch {}
    console.error(`[resend] API error — status=${res.status} to=${Array.isArray(to) ? to.join(",") : to} body=${resBody}`);
    return { ok: false, error: `Resend ${res.status}: ${resBody}` };
  }

  const resBody = await res.json().catch(() => ({}));
  console.log(`[resend] Email sent — id=${resBody.id} to=${Array.isArray(to) ? to.join(",") : to}`);
  return { ok: true };
}

function buildClientEmailHtml(clientName, advisorName) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #1F2A44; color: #fff; padding: 16px 24px; border-radius: 4px 4px 0 0;">
    <strong style="font-size: 18px;">Adaxa Home LLC</strong>
    <span style="float: right; color: #C9A74D; font-weight: 600;">Loan Benefits Worksheet</span>
  </div>
  <div style="background: #fff; border: 1px solid #e5e5e5; padding: 24px; border-radius: 0 0 4px 4px;">
    <p>Hi ${clientName || "there"},</p>
    <p>
      Attached is your personalized <strong>Loan Benefits Worksheet</strong>, prepared by
      <strong>${advisorName || "Mykoal DeShazo"}</strong>.
    </p>
    <p>
      This worksheet shows exactly how a refinance + debt consolidation strategy could lower your
      monthly payment, reduce your total interest cost, and get you debt-free years sooner.
    </p>
    <p>
      Have questions? Reply to this email or call me directly at <strong>(480) 206-9290</strong>.
      I'm happy to walk through the numbers together.
    </p>
    <p style="margin-top: 24px;">
      Warm regards,<br>
      <strong>${advisorName || "Mykoal DeShazo"}</strong><br>
      Vice President | Senior Loan Officer<br>
      Adaxa Home LLC<br>
      (480) 206-9290 · mykoal@adaxahome.com<br>
      NMLS #1912347 · Company NMLS #2380533
    </p>
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;">
    <p style="font-size: 10px; color: #888; line-height: 1.5;">
      Adaxa Home LLC | Company NMLS #2380533. Mykoal DeShazo NMLS #1912347.
      Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA.
      Verify licensing at www.nmlsconsumeraccess.org.
      This document is for informational purposes only and does not constitute a commitment to lend.
    </p>
  </div>
</body>
</html>
`;
}

function buildAdvisorNotificationHtml(data) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #1F2A44; color: #fff; padding: 16px 24px; border-radius: 4px 4px 0 0;">
    <strong>New Worksheet Lead — Adaxa Home</strong>
  </div>
  <div style="background: #fff; border: 1px solid #e5e5e5; padding: 24px; border-radius: 0 0 4px 4px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #666; width: 40%;">Name</td><td style="padding: 6px 0;"><strong>${data.firstName ?? ""} ${data.lastName ?? ""}</strong></td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;">${data.email ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0;">${data.phone ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">State</td><td style="padding: 6px 0;">${data.state ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Source</td><td style="padding: 6px 0;">${data.source ?? "Loan Benefits Worksheet"}</td></tr>
    </table>
    ${data.worksheetSummary ? `<p style="font-size: 12px; color: #666; margin-top: 12px; padding: 10px; background: #f9f9f9; border-radius: 4px;">${data.worksheetSummary}</p>` : ""}
  </div>
</body>
</html>
`;
}

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";
const FORMSPREE = "https://formspree.io/f/meennekb";

async function submitToLeadMailbox(payload, clientIp) {
  // Forward the visitor's real IP so LM doesn't reject the call as a
  // Cloudflare egress IP. Skip the headers entirely when the IP is unknown
  // or empty — sending a header literally saying "unknown" trips LM's
  // foreign-IP guard the same way the Cloudflare egress does.
  const headers = { "Content-Type": "application/json" };
  if (clientIp && clientIp !== "unknown") {
    headers["X-Forwarded-For"] = clientIp;
    headers["True-Client-IP"] = clientIp;
    headers["X-Real-IP"] = clientIp;
  }
  try {
    const lmRes = await fetch(LM_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const lmText = await lmRes.text();
    let lmSuccess = false;
    try { lmSuccess = JSON.parse(lmText).code === 0; } catch { lmSuccess = lmRes.ok; }
    console.log(`[lm] submit — name="${payload.FirstName} ${payload.LastName}" ok=${lmSuccess} response=${lmText.slice(0, 200)}`);
    return lmSuccess;
  } catch (e) {
    console.error("[lm] LeadMailbox error:", e);
    return false;
  }
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";

  // Resolve Resend API key — log which name was found (never log the value)
  const resendKey = env.RESEND_API_KEY || env.RE_worksheet;
  if (!resendKey) {
    console.error("[resend] CRITICAL: No Resend API key found. Checked RESEND_API_KEY and RE_worksheet. Set one in Cloudflare Pages → Settings → Environment variables.");
  } else {
    const keyName = env.RESEND_API_KEY ? "RESEND_API_KEY" : "RE_worksheet";
    console.log(`[resend] Key resolved via: ${keyName}`);
  }

  // ─── Internal path: advisor sending worksheet PDF to a client ───────────────
  if (body.source === "worksheet-internal") {
    if (!body.clientEmail || !body.pdfBase64) {
      return jsonResponse({ success: false, error: "Missing clientEmail or pdfBase64" }, 400, cors);
    }

    const clientName = body.clientName || "";
    const nameParts = clientName.trim().split(/\s+/);
    const firstName = body.clientFirstName || nameParts[0] || "Client";
    const lastName = body.clientLastName || nameParts.slice(1).join(" ") || "";

    console.log(`[worksheet] internal send — to=${body.clientEmail} client="${firstName} ${lastName}"`);

    let emailResult = { ok: false, error: "No Resend key" };
    if (resendKey) {
      emailResult = await sendResendEmail({
        apiKey: resendKey,
        to: body.clientEmail,
        subject: `Your Loan Benefits Worksheet — ${clientName || "See attached"}`,
        html: buildClientEmailHtml(clientName, body.advisorName),
        pdfBase64: body.pdfBase64,
        fileName: body.fileName || "Loan-Benefits-Worksheet.pdf",
      });
    }

    // Log to LeadMailbox as manual send
    const lmPayload = {
      FirstName: firstName,
      LastName: lastName,
      Email: body.clientEmail,
      MobilePhone: "",
      Phys_State: "",
      Loan_Request: "Worksheet Internal Send",
      Notes: [
        "Funnel: worksheet-internal",
        "Tag: manual send by Mykoal",
        `Submitted: ${new Date().toISOString()}`,
        `Source: smartr8.com/worksheet/internal`,
        body.worksheetSummary ? `\nWorksheet summary:\n${body.worksheetSummary}` : "",
      ].filter(Boolean).join("\n"),
    };
    waitUntil(submitToLeadMailbox(lmPayload, ip));

    return jsonResponse({ success: true, emailOk: emailResult.ok, emailError: emailResult.error }, 200, cors);
  }

  // ─── Self-serve path: public user emailing worksheet to themselves ───────────
  if (body.source === "worksheet-self") {
    if (!body.clientEmail || !body.pdfBase64) {
      return jsonResponse({ success: false, error: "Missing clientEmail or pdfBase64" }, 400, cors);
    }

    // Accept explicit fields OR parse from clientName for backward compat
    const clientName = body.clientName || `${body.firstName || ""} ${body.lastName || ""}`.trim();
    const nameParts = clientName.split(/\s+/);
    const firstName = body.firstName || nameParts[0] || "Unknown";
    const lastName = body.lastName || nameParts.slice(1).join(" ") || "";

    console.log(`[worksheet] self-send — to=${body.clientEmail} client="${firstName} ${lastName}"`);

    let emailResult = { ok: false, error: "No Resend key" };
    if (resendKey) {
      emailResult = await sendResendEmail({
        apiKey: resendKey,
        to: body.clientEmail,
        subject: `Your Loan Benefits Worksheet — ${clientName || "See attached"}`,
        html: buildClientEmailHtml(clientName, "Mykoal DeShazo"),
        pdfBase64: body.pdfBase64,
        fileName: body.fileName || "Loan-Benefits-Worksheet.pdf",
      });
    }

    console.log(`[worksheet] self-send result — emailOk=${emailResult.ok}${emailResult.error ? ` error=${emailResult.error}` : ""}`);

    const lmPayload = {
      FirstName: firstName,
      LastName: lastName,
      Email: body.clientEmail,
      MobilePhone: body.phone ? body.phone.replace(/\D/g, "") : "",
      Phys_State: body.state ?? "",
      Loan_Request: "Worksheet Self-Send",
      Notes: [
        "Funnel: worksheet-self",
        `Submitted: ${new Date().toISOString()}`,
        `Source: smartr8.com/worksheet`,
        body.trackingId ? `Tracking ID: ${body.trackingId}` : "",
        body.worksheetSummary ? `\nWorksheet summary:\n${body.worksheetSummary}` : "",
      ].filter(Boolean).join("\n"),
    };

    const lmSuccess = await submitToLeadMailbox(lmPayload, ip);

    if (resendKey) {
      waitUntil(
        sendResendEmail({
          apiKey: resendKey,
          to: "mykoal@adaxahome.com",
          subject: `New Worksheet Self-Send — ${clientName}`,
          html: buildAdvisorNotificationHtml({ firstName, lastName, email: body.clientEmail, phone: body.phone, state: body.state, worksheetSummary: body.worksheetSummary, source: "worksheet-self" }),
        }).then(r => { if (!r.ok) console.error("[resend] advisor self-send notification failed:", r.error); })
      );
    }

    waitUntil(
      fetch(FORMSPREE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `New Worksheet Self-Send — ${clientName}`,
          firstName, lastName, email: body.clientEmail,
          phone: body.phone ?? "", state: body.state ?? "",
          source: "worksheet-self",
          worksheetSummary: body.worksheetSummary ?? "",
          lmSuccess,
        }),
      }).catch((e) => console.error("[worksheet] Formspree self-send error:", e))
    );

    return jsonResponse({ success: true, emailOk: emailResult.ok, emailError: emailResult.error }, 200, cors);
  }

  // ─── Public path: worksheet unlock-lead — routed through processLead ─────
  // GHL workflows now own advisor notification + nurture; D1 owns the
  // backup audit row. The legacy advisor email + Formspree POST that
  // used to live here are intentionally gone.
  const missing = ["firstName", "lastName", "email"].filter((f) => !body[f]?.trim());
  if (missing.length > 0) {
    return jsonResponse({ success: false, error: `Missing: ${missing.join(", ")}` }, 400, cors);
  }

  // Turnstile: verify only when the client sent a token. Matches the
  // /api/submit-lead behavior so older cached clients without the
  // <TcpaConsent /> widget still pass through (and are flagged via the
  // structured warn log below).
  if (body.turnstile_token) {
    const ts = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, body.turnstile_token, ip);
    if (!ts.ok) {
      return jsonResponse({ success: false, error: `turnstile: ${ts.error}` }, 403, cors);
    }
  }

  const userAgent = request.headers.get("User-Agent") ?? "";
  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  const email = normalizeEmail(body.email);
  const phoneE164 = normalizePhoneE164US(body.phone);
  if (body.phone && !phoneE164) {
    return jsonResponse({ success: false, errors: { phone: "Phone must be a valid US number" } }, 400, cors);
  }

  const propertyState = (body.state ?? "").trim();

  const lead = {
    lead_id: crypto.randomUUID(),
    created_at: Date.now(),
    funnel: "worksheet",
    first_name: firstName,
    last_name: lastName,
    email,
    phone_e164: phoneE164,
    property_state: propertyState,
    loan_request: "Worksheet Lead",
    notes: [
      body.worksheetSummary ? `Worksheet summary:\n${body.worksheetSummary}` : "",
      body.trackingId ? `Tracking ID: ${body.trackingId}` : "",
    ].filter(Boolean).join("\n\n"),
    source: "smartr8.com",
    landing_page: body.page_url || "smartr8.com/worksheet",
    ip,
    user_agent: userAgent,
  };

  const hasTurnstile = Boolean(body.turnstile_token);
  const hasConsentText = Boolean(body.consent_text);
  const hasConsentVersion = Boolean(body.consent_version);
  const hasConsentChecked = body.consent === true;
  let consent = null;
  if (hasTurnstile && hasConsentText && hasConsentVersion) {
    // Fields are present (form rendered the widget). Only record consent
    // when the user actively checked the optional box; an unchecked submit
    // is an explicit opt-out and we must NOT write a tcpa_consents row.
    if (hasConsentChecked) {
      consent = {
        consent_id: crypto.randomUUID(),
        lead_id: lead.lead_id,
        consent_version: body.consent_version,
        consent_text: body.consent_text,
        ip,
        user_agent: userAgent,
        page_url: body.page_url || "smartr8.com/worksheet",
        created_at: lead.created_at,
      };
    }
  } else {
    // Surfaces stale frontend caches that haven't picked up the
    // <TcpaConsent /> widget yet. Lead still flows; consent row skipped.
    log("warn", "worksheet.branch3.missing_tcpa_fields", {
      lead_id: lead.lead_id,
      has_turnstile: hasTurnstile,
      has_consent_text: hasConsentText,
      has_consent_version: hasConsentVersion,
    });
  }

  console.log(`[worksheet] public lead — ${firstName} ${lastName} <${email}> state=${propertyState || "—"} lead_id=${lead.lead_id}`);

  const result = await processLead(lead, consent, env, { waitUntil }, ip);

  const lmPayload = !result.leadmailbox.ok && result.leadmailbox.fallbackPayload
    ? result.leadmailbox.fallbackPayload
    : null;

  return jsonResponse(
    {
      success: true,
      lead_id: result.lead_id,
      duplicate: result.duplicate === true,
      lmPayload,
    },
    200,
    cors,
  );
}

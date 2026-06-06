// @ts-nocheck
// POST /api/voice-message
//
// Webhook-tool endpoint for the Telnyx AI voice receptionist ("Sam"). When Sam
// takes a message on a call, her `take_message` Webhook tool POSTs the caller's
// details here and reads the JSON `result` back to the caller as confirmation.
//
// This is the voice analog of functions/api/crm-lead.ts: it forwards the
// message into the same secret-gated CRM webhook (crm.smartr8.com/webhooks/lead)
// so phone messages land in the CRM alongside web leads — but tagged
// "voice-message" and WITHOUT a loanType, so they show up for follow-up without
// being enrolled into a mortgage drip campaign or SMS sequence.
//
// Telnyx Webhook tool config (in the AI Assistant builder):
//   Method:  POST
//   URL:     https://smartr8.com/api/voice-message
//   Header:  Authorization: Bearer <VOICE_WEBHOOK_SECRET>   (optional, see below)
//   Body params (JSON): caller_name, callback_number, message, department
//
// Auth: if VOICE_WEBHOOK_SECRET is bound, the Authorization bearer token must
// match or the request is rejected. If it's unset, the endpoint still works
// (so it deploys cleanly before the secret is provisioned) but logs a warning.

import { log } from "../_lib/log";
import type { Env } from "../_lib/types";

// Built-in default mirrors functions/api/crm-lead.ts; env.CRM_LEAD_WEBHOOK
// overrides it (e.g. to rotate the key).
const CRM_LEAD_WEBHOOK_URL =
  "https://crm.smartr8.com/webhooks/lead?key=4519413906c139e16484f518fdd8968c";

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Split a spoken full name ("Jane Q Public") into first/last. The assistant
// captures one name string, so first token is first name, remainder is last.
function splitName(full) {
  const parts = str(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;

  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  // Optional shared-secret gate. Telnyx sends it as an Authorization header on
  // the Webhook tool. When the secret is unset we still serve (clean deploy).
  const secret = (env as Env).VOICE_WEBHOOK_SECRET;
  if (secret) {
    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (token !== secret) {
      log("warn", "voice_message.unauthorized", {});
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }
  } else {
    log("warn", "voice_message.no_secret_configured", {});
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const callerName = str(body.caller_name) || str(body.name);
  const callbackNumber = str(body.callback_number) || str(body.phone);
  const message = str(body.message) || str(body.notes);
  const department = str(body.department);

  // A useful message needs at least a callback number and the message text so
  // the team can actually follow up. If either is missing, tell Sam to ask for
  // it rather than saving a dead-end record.
  if (!callbackNumber) {
    return jsonResponse(
      { ok: false, result: "I still need a callback number before I can take the message." },
      200,
    );
  }
  if (!message) {
    return jsonResponse(
      { ok: false, result: "I still need the message itself before I can pass it along." },
      200,
    );
  }

  const { first, last } = splitName(callerName);
  const notes = department
    ? `Voice message for ${department}: ${message}`
    : `Voice message: ${message}`;

  // Payload for the CRM webhook. No loanType is sent (this is not a mortgage
  // lead), so the CRM's loan-drip filter won't enroll it; smsOptIn is "no"
  // because the caller didn't opt into texts via this flow. The "voice-message"
  // tag makes these easy to find/route in the CRM.
  const payload = {
    first_name: first,
    last_name: last,
    email: "",
    phone: callbackNumber,
    source: "voice-receptionist",
    consent: true,
    smsOptIn: "no",
    notes,
    tags: department ? ["voice-message", department] : ["voice-message"],
    department,
    page_url: "telnyx:ai-receptionist",
  };

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
        log("warn", "voice_message.webhook_failed", { status: res.status, body: text.slice(0, 200), department });
      } else {
        log("info", "voice_message.webhook_ok", { department });
      }
    } catch (e) {
      log("warn", "voice_message.webhook_error", { err: e instanceof Error ? e.message : String(e), department });
    }
  })();

  // Don't make the live call wait on the CRM round-trip; confirm to Sam right
  // away so she can tell the caller, and let the forward finish in the
  // background (the message is already captured from the caller's perspective).
  if (typeof waitUntil === "function") waitUntil(forward);
  else await forward;

  return jsonResponse(
    { ok: true, result: "Got it — I've taken your message and the team will follow up at the number you gave me." },
    200,
  );
}

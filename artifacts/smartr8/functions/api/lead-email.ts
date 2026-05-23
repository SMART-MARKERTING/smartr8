// @ts-nocheck
// POST /api/lead-email — transactional lead-email endpoint (per spec contract).
//
// The PRIMARY trigger path is the capture Workers (submit-lead.ts and
// worksheet/submit-lead.ts) calling handleLeadEmail() directly via waitUntil,
// so every lead is covered server-side. This endpoint exists for future or
// direct callers and reuses the same shared module (and its KV idempotency
// and IP rate limiting).

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

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";

  const result = await handleLeadEmail(
    env,
    {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      funnel: body.funnel,
      funnelLength: body.funnelLength,
      leadId: body.leadId,
    },
    ip,
  );

  if (result.success) {
    return jsonResponse({ success: true, emailId: result.emailId ?? null, skipped: result.skipped ?? false }, 200, cors);
  }

  const status = result.error === "rate limited"
    ? 429
    : (typeof result.error === "string" && result.error.includes("required") ? 400 : 502);
  return jsonResponse({ success: false, error: result.error || "send failed" }, status, cors);
}

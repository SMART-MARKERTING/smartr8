// @ts-nocheck
// POST /api/admin/remove-opportunity  { lead_id }
//
// Removes a lead's open opportunity(ies) from the GoHighLevel pipeline — i.e.
// deletes the card from the board. The GHL contact and the D1 lead row are
// left intact (scope: pipeline opportunity only). On success the D1 row's
// ghl_status is set to 'removed' as a lightweight audit trail.
//
// Auth: `X-Admin-Token` header must equal the WORKSHEET_ADMIN_PASS env var.

import { ghlDeleteOpportunity, ghlFindOpportunitiesByContact } from "../../_lib/ghl";

const ALLOWED_ORIGINS = new Set(["https://smartr8.com", "https://www.smartr8.com"]);
function isAllowedOrigin(o) {
  return ALLOWED_ORIGINS.has(o) || /^https:\/\/[^.]+\.pages\.dev$/.test(o);
}
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smartr8.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  };
}
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function isAuthed(request, env) {
  const token = request.headers.get("X-Admin-Token") ?? "";
  const valid = env.WORKSHEET_ADMIN_PASS;
  if (!valid) return false;
  if (token && token === valid) return true;
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 200));
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405, cors);

  if (!env.WORKSHEET_ADMIN_PASS) {
    return jsonResponse({ ok: false, error: "Admin auth not configured" }, 503, cors);
  }
  if (!(await isAuthed(request, env))) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400, cors);
  }
  const leadId = (body?.lead_id ?? "").trim();
  if (!leadId) return jsonResponse({ ok: false, error: "Missing lead_id" }, 400, cors);

  const db = env.LEADS_DB;
  if (!db) return jsonResponse({ ok: false, error: "Leads database not bound" }, 503, cors);

  const row = await db.prepare("SELECT ghl_contact_id FROM leads WHERE lead_id = ?").bind(leadId).first();
  if (!row) return jsonResponse({ ok: false, error: "Lead not found" }, 404, cors);

  const contactId = row.ghl_contact_id;
  if (!contactId) {
    return jsonResponse(
      { ok: false, error: "This lead has no linked GHL contact, so it isn't on the pipeline." },
      409,
      cors,
    );
  }

  const found = await ghlFindOpportunitiesByContact(env, contactId);
  if (!found.ok) {
    const hint = found.scopeError
      ? " (the GHL token is missing the opportunities.readonly scope)"
      : "";
    return jsonResponse(
      { ok: false, error: `Couldn't look up the pipeline opportunity${hint}.`, detail: found.error },
      found.scopeError ? 403 : 502,
      cors,
    );
  }

  const opps = found.opportunities ?? [];
  // Narrow to the configured Web Leads pipeline when set (ghlFind already
  // filters server-side, but double-check in case GHL ignores the param).
  const targets = env.GHL_PIPELINE_ID ? opps.filter((o) => !o.pipelineId || o.pipelineId === env.GHL_PIPELINE_ID) : opps;

  if (targets.length === 0) {
    return jsonResponse({ ok: true, removed: 0, message: "No pipeline opportunity found for this lead." }, 200, cors);
  }

  let removed = 0;
  const errors = [];
  for (const o of targets) {
    const del = await ghlDeleteOpportunity(env, o.id);
    if (del.ok) removed += 1;
    else errors.push(del.error);
  }

  if (removed > 0) {
    await db
      .prepare("UPDATE leads SET ghl_status = 'removed' WHERE lead_id = ?")
      .bind(leadId)
      .run()
      .catch(() => {});
  }

  return jsonResponse(
    {
      ok: errors.length === 0,
      removed,
      ...(errors.length ? { error: `Removed ${removed}; ${errors.length} failed.`, errors } : {}),
    },
    errors.length ? 502 : 200,
    cors,
  );
}

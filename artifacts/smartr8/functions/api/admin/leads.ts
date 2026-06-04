// @ts-nocheck
// GET /api/admin/leads — list recent leads from D1 for the in-site admin tool.
//
// Auth: the request must carry an `X-Admin-Token` header equal to the
// WORKSHEET_ADMIN_PASS env var (the same shared password the internal
// worksheet tool uses). This endpoint returns PII, so it is always gated.

const ALLOWED_ORIGINS = new Set(["https://smartr8.com", "https://www.smartr8.com"]);
function isAllowedOrigin(o) {
  return ALLOWED_ORIGINS.has(o) || /^https:\/\/[^.]+\.pages\.dev$/.test(o);
}
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smartr8.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  };
}
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// The admin password may be stored under any of these env var names. Some
// hosting UIs cap the variable-name length, so WORKSHEET_ADMIN_PASS (20 chars)
// can't always be saved — WORKSHEET_ADN_PASS / ADN_PASS / ADMIN_PASS are
// accepted as shorter fallbacks. A token matching ANY configured value passes,
// and values are trimmed so a stray newline in the secret won't block login.
function adminSecrets(env) {
  return [env.WORKSHEET_ADMIN_PASS, env.WORKSHEET_ADN_PASS, env.ADN_PASS, env.ADMIN_PASS]
    .filter(Boolean)
    .map((s) => String(s).trim());
}

async function isAuthed(request, env) {
  const token = (request.headers.get("X-Admin-Token") ?? "").trim();
  const secrets = adminSecrets(env);
  if (secrets.length === 0) {
    console.warn("[admin/leads] no admin password env var set — denying");
    return false;
  }
  if (token && secrets.includes(token)) return true;
  // Small randomized delay to blunt brute-force timing.
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 200));
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET") return jsonResponse({ ok: false, error: "Method not allowed" }, 405, cors);

  if (adminSecrets(env).length === 0) {
    return jsonResponse({ ok: false, error: "Admin auth not configured" }, 503, cors);
  }
  if (!(await isAuthed(request, env))) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401, cors);
  }

  const db = env.LEADS_DB;
  if (!db) return jsonResponse({ ok: false, error: "Leads database not bound" }, 503, cors);

  const url = new URL(request.url);
  const reqLimit = parseInt(url.searchParams.get("limit") ?? "200", 10);
  const limit = Math.min(Math.max(Number.isFinite(reqLimit) ? reqLimit : 200, 1), 500);

  try {
    const { results } = await db
      .prepare(
        `SELECT lead_id, created_at, funnel, first_name, last_name, email, phone_e164,
                property_state, ghl_contact_id, ghl_status, ghl_upsert_status, leadmailbox_status
           FROM leads
          ORDER BY created_at DESC
          LIMIT ?`,
      )
      .bind(limit)
      .all();
    return jsonResponse({ ok: true, leads: results ?? [] }, 200, cors);
  } catch (e) {
    return jsonResponse({ ok: false, error: `Query failed: ${e instanceof Error ? e.message : String(e)}` }, 500, cors);
  }
}

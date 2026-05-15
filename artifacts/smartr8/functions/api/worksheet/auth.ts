// @ts-nocheck
// Cloudflare Pages Function — POST /api/worksheet/auth
// Validates username + password for the internal worksheet tool.
//
// Required env bindings (Cloudflare Pages dashboard → Settings → Environment variables):
//   WORKSHEET_ADMIN_USER — admin username
//   WORKSHEET_ADMIN_PASS — admin password

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
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400, cors);
  }

  const { username, password } = body ?? {};

  if (!username || !password) {
    return jsonResponse({ success: false, error: "Missing credentials" }, 400, cors);
  }

  const validUser = env.WORKSHEET_ADMIN_USER;
  const validPass = env.WORKSHEET_ADMIN_PASS;

  // Fallback: if env vars not set, deny access
  if (!validUser || !validPass) {
    console.warn("[worksheet/auth] WORKSHEET_ADMIN_USER or WORKSHEET_ADMIN_PASS not set — denying");
    return jsonResponse({ success: false, error: "Auth not configured" }, 503, cors);
  }

  if (username === validUser && password === validPass) {
    console.log("[worksheet/auth] successful login");
    return jsonResponse({ success: true }, 200, cors);
  }

  // Timing-safe: delay on failure to prevent brute-force timing attacks
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
  console.warn("[worksheet/auth] failed login attempt");
  return jsonResponse({ success: false, error: "Invalid credentials" }, 401, cors);
}

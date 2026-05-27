// Cloudflare Turnstile server-side verification.
//
// Each capture endpoint calls verifyTurnstile() exactly once per request;
// the result is cached for the request lifetime via the optional cache
// argument.

import { log } from "./log";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileResult {
  ok: boolean;
  error?: string;
}

/**
 * Verify a Turnstile token. `secret` is env.TURNSTILE_SECRET_KEY, `token`
 * is the value the client posts as `turnstile_token`, and `remoteip` is
 * CF-Connecting-IP.
 */
export async function verifyTurnstile(
  secret: string | undefined,
  token: string,
  remoteip: string,
): Promise<TurnstileResult> {
  if (!secret) {
    log("error", "turnstile.missing_secret", {});
    return { ok: false, error: "turnstile not configured" };
  }
  if (!token) return { ok: false, error: "missing token" };

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteip && remoteip !== "unknown") form.set("remoteip", remoteip);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
  } catch (e) {
    log("error", "turnstile.network_error", { err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: "network error" };
  }
  if (!res.ok) {
    log("warn", "turnstile.http_error", { status: res.status });
    return { ok: false, error: `siteverify ${res.status}` };
  }
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; "error-codes"?: string[] };
  if (body.success) return { ok: true };
  log("warn", "turnstile.invalid", { codes: body["error-codes"] ?? [] });
  return { ok: false, error: (body["error-codes"] ?? []).join(",") || "invalid" };
}

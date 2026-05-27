// Sendblue iMessage / SMS / RCS destination helper.
//
// Two-step flow:
//   1. GET /api/evaluate-service?number=...    -> determine iMessage|SMS|RCS
//   2. POST /api/send-message                  -> deliver the opener
//
// Opener constraints: GSM-7 safe, no dashes / em dashes / smart quotes /
// emoji, under 160 chars. send_style: "invisible" only on iMessage.

import { log } from "./log";
import type { Env, Lead, SendblueResult } from "./types";

const SENDBLUE_BASE = "https://api.sendblue.com";

function funnelLabel(funnel: string): string {
  const f = String(funnel || "").toLowerCase();
  if (f.startsWith("heloc")) return "HELOC";
  if (f === "worksheet") return "refinance worksheet";
  if (f === "cash-out" || f === "cashout" || f === "rate-reduction" || f === "purchase") return "mortgage";
  return "mortgage";
}

/**
 * Build the SMS/iMessage opener. Pure ASCII, no em dashes, no apostrophe
 * fanciness, no emoji, no smart quotes. Stays under 160 chars on all
 * supported funnels.
 */
export function buildOpener(firstName: string, funnel: string): string {
  // Note the apostrophe in "it's" is a regular ASCII apostrophe (U+0027),
  // which is GSM-7 safe.
  const label = funnelLabel(funnel);
  const name = (firstName || "").trim().split(/\s+/)[0] || "there";
  return `Hey ${name}, it's Mykoal from Adaxa Home. Saw you started a ${label} inquiry. Got 2 min to chat now or want me to call later? Reply STOP to opt out. NMLS 1912347`;
}

interface EvaluateResponse {
  service?: string; // "iMessage" | "SMS" | "RCS" expected
  number?: string;
}
interface SendMessageResponse {
  handle?: string;
  message_handle?: string;
  status?: string;
  error_message?: string;
}

function authHeaders(env: Env): Record<string, string> | null {
  if (!env.SENDBLUE_API_KEY_ID || !env.SENDBLUE_API_SECRET_KEY) return null;
  return {
    "sb-api-key-id": env.SENDBLUE_API_KEY_ID,
    "sb-api-secret-key": env.SENDBLUE_API_SECRET_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function sendToSendblue(env: Env, lead: Lead): Promise<SendblueResult> {
  const headers = authHeaders(env);
  if (!headers) {
    log("warn", "sendblue.missing_credentials", { lead_id: lead.lead_id });
    return { ok: false, error: "Sendblue credentials not configured" };
  }
  if (!env.SENDBLUE_FROM_NUMBER) {
    log("warn", "sendblue.missing_from_number", { lead_id: lead.lead_id });
    return { ok: false, error: "SENDBLUE_FROM_NUMBER not set" };
  }
  if (!lead.phone_e164) {
    log("info", "sendblue.no_phone_skip", { lead_id: lead.lead_id });
    return { ok: false, error: "no phone on lead" };
  }

  // ── Step A: evaluate service ─────────────────────────────────────────
  let service: string | undefined;
  try {
    const url = `${SENDBLUE_BASE}/api/evaluate-service?number=${encodeURIComponent(lead.phone_e164)}`;
    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      log("warn", "sendblue.evaluate_error", { lead_id: lead.lead_id, status: res.status, body: text.slice(0, 240) });
      return { ok: false, error: `Sendblue evaluate ${res.status}: ${text.slice(0, 240)}` };
    }
    const data = (text ? (JSON.parse(text) as EvaluateResponse) : {}) as EvaluateResponse;
    service = data.service;
  } catch (e) {
    log("error", "sendblue.evaluate_network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: `Sendblue evaluate network: ${e instanceof Error ? e.message : String(e)}` };
  }

  // ── Step B: send the opener ──────────────────────────────────────────
  const body: Record<string, unknown> = {
    from_number: env.SENDBLUE_FROM_NUMBER,
    number: lead.phone_e164,
    content: buildOpener(lead.first_name, lead.funnel),
  };
  if (service === "iMessage") body.send_style = "invisible";

  try {
    const res = await fetch(`${SENDBLUE_BASE}/api/send-message`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      log("warn", "sendblue.send_error", { lead_id: lead.lead_id, status: res.status, body: text.slice(0, 240) });
      return { ok: false, error: `Sendblue send ${res.status}: ${text.slice(0, 240)}`, service };
    }
    const data = (text ? (JSON.parse(text) as SendMessageResponse) : {}) as SendMessageResponse;
    const messageHandle = data.handle ?? data.message_handle;
    log("info", "sendblue.ok", { lead_id: lead.lead_id, service, messageHandle });
    return { ok: true, messageHandle, service };
  } catch (e) {
    log("error", "sendblue.send_network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: `Sendblue send network: ${e instanceof Error ? e.message : String(e)}`, service };
  }
}

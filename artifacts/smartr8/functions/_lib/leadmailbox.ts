// LeadMailbox destination helper.
//
// Hits the existing endpoint that the legacy submit-lead Workers used.
// LeadMailbox rejects requests from Cloudflare egress IPs, so we forward
// the user's real IP via X-Forwarded-For (and X-Real-IP / True-Client-IP
// belt-and-suspenders). Returns a fallbackPayload when the call is
// IP-blocked so callers can choose to relay it from the browser.

import { log } from "./log";
import type { Lead, LeadMailboxResult } from "./types";

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsites";
// NOTE: the live URL in the legacy code is .../adax01/DeshazosWebsite (no
// trailing s). Preserve that exactly:
const LM_ENDPOINT_LIVE = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";

function loanRequestFromLead(lead: Lead): string {
  if (lead.loan_request && lead.loan_request.trim()) return lead.loan_request.trim();
  switch (lead.funnel) {
    case "cash-out":
    case "cashout":
      return "Cash-Out Refinance";
    case "rate-reduction":
      return "Rate and Term Refinance";
    case "purchase":
      return "Purchase";
    case "heloc":
    case "heloc-v2":
    case "heloc-quick":
    case "heloc-quick-v2":
      return "HELOC";
    case "worksheet":
      return "Worksheet Lead";
    default:
      return "Web Lead";
  }
}

function buildPayload(lead: Lead): Record<string, string> {
  const phoneDigits = (lead.phone_e164 || "").replace(/\D/g, "");
  const notesLines: string[] = [
    `Funnel: ${lead.funnel}`,
    `Lead ID: ${lead.lead_id}`,
    `Submitted: ${new Date(lead.created_at).toISOString()}`,
    "Source: smartr8.com",
  ];
  if (lead.landing_page) notesLines.push(`Page URL: ${lead.landing_page}`);
  if (lead.referrer) notesLines.push(`Referrer: ${lead.referrer}`);
  if (lead.notes && lead.notes.trim()) {
    notesLines.push("", "Answers:", lead.notes.trim());
  }
  if (lead.utm_source || lead.utm_medium || lead.utm_campaign || lead.utm_content || lead.utm_term) {
    notesLines.push("", "UTM:");
    if (lead.utm_source) notesLines.push(`- Source: ${lead.utm_source}`);
    if (lead.utm_medium) notesLines.push(`- Medium: ${lead.utm_medium}`);
    if (lead.utm_campaign) notesLines.push(`- Campaign: ${lead.utm_campaign}`);
    if (lead.utm_content) notesLines.push(`- Content: ${lead.utm_content}`);
    if (lead.utm_term) notesLines.push(`- Term: ${lead.utm_term}`);
  }
  return {
    FirstName: lead.first_name,
    LastName: lead.last_name || "",
    Email: lead.email,
    MobilePhone: phoneDigits,
    Phys_Address: lead.address1 || "",
    Loan_Request: loanRequestFromLead(lead),
    Notes: notesLines.join("\n"),
  };
}

export async function submitToLeadMailbox(lead: Lead): Promise<LeadMailboxResult> {
  const payload = buildPayload(lead);
  const ip = lead.ip && lead.ip !== "unknown" ? lead.ip : "";

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ip) {
      headers["X-Forwarded-For"] = ip;
      headers["X-Real-IP"] = ip;
      headers["True-Client-IP"] = ip;
    }
    const res = await fetch(LM_ENDPOINT_LIVE, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const body = await res.text().catch(() => "");
    let ok = res.ok;
    // LeadMailbox returns a JSON body with code === 0 for success even on 200.
    try {
      const parsed = JSON.parse(body) as { code?: number };
      if (typeof parsed.code === "number") ok = parsed.code === 0;
    } catch {
      // Fall back to HTTP-level ok.
    }
    if (ok) {
      log("info", "leadmailbox.ok", { lead_id: lead.lead_id, http: res.status });
      return { ok: true };
    }
    // 403/blocked = IP filtering. Return fallbackPayload so callers can
    // choose to relay it from the browser (preserving the legacy behaviour).
    if (res.status === 403) {
      log("warn", "leadmailbox.ip_blocked", { lead_id: lead.lead_id });
      return { ok: false, error: `LM 403 ip_blocked`, fallbackPayload: payload };
    }
    log("warn", "leadmailbox.rejected", { lead_id: lead.lead_id, status: res.status, body: body.slice(0, 240) });
    return { ok: false, error: `LM ${res.status}: ${body.slice(0, 240)}` };
  } catch (e) {
    log("error", "leadmailbox.network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: e instanceof Error ? e.message : String(e), fallbackPayload: payload };
  }
}

// Re-export so tests can target the historical URL constant.
export const LEADMAILBOX_URL = LM_ENDPOINT_LIVE;
// Suppress the now-unused alt URL definition; kept above for visual diff
// reference against the legacy file.
void LM_ENDPOINT;

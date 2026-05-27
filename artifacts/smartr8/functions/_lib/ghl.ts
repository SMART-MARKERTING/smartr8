// GoHighLevel destination helper.
//
// Two-step flow:
//   1. POST /contacts/upsert   -> returns contactId
//   2. POST /opportunities/    -> places the contact on the "Web Leads"
//                                 pipeline at the "New Lead" stage
//
// Auth: Authorization: Bearer ${SMARTR8_LEAD_CAPTURE_PROD} (PIT labeled
// "smartr8-lead-capture-prod" in GHL), Version: 2021-07-28,
// Content-Type/Accept JSON.
//
// Custom field IDs (loan_request, notes) come from env so labels can be
// changed in GHL without code edits. Run scripts/fetch-ghl-ids.ts to
// populate them.

import { log } from "./log";
import type { Env, GhlResult, Lead } from "./types";

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

interface UpsertResponse {
  contact?: { id?: string };
  // GHL sometimes returns the contact at the root depending on endpoint.
  id?: string;
}

function funnelLabel(funnel: string): string {
  const f = String(funnel || "").toLowerCase();
  if (f.startsWith("heloc")) return "HELOC";
  if (f === "worksheet") return "refinance worksheet";
  if (f === "cash-out" || f === "cashout" || f === "rate-reduction" || f === "purchase") return "mortgage";
  return "mortgage";
}

/** Log a 403/scope error distinctly so dev catches it quickly. */
function logScopeError(stage: string, lead_id: string, status: number, body: string): void {
  log("error", "ghl.scope_error", {
    stage,
    lead_id,
    http: status,
    body: body.slice(0, 300),
    hint: "Verify PIT grants the required scopes (contacts.write, opportunities.write, etc.)",
  });
}

export async function sendToGhl(env: Env, lead: Lead): Promise<GhlResult> {
  const token = env.SMARTR8_LEAD_CAPTURE_PROD;
  const locationId = env.GHL_LOCATION_ID;
  if (!token) {
    log("warn", "ghl.missing_token", { lead_id: lead.lead_id });
    return { ok: false, error: "SMARTR8_LEAD_CAPTURE_PROD not set" };
  }
  if (!locationId) {
    log("warn", "ghl.missing_location", { lead_id: lead.lead_id });
    return { ok: false, error: "GHL_LOCATION_ID not set" };
  }

  // ── Step 1: upsert contact ──────────────────────────────────────────────
  const customFields: Array<{ id: string; field_value: string }> = [];
  if (env.GHL_CF_LOAN_REQUEST && lead.loan_request) {
    customFields.push({ id: env.GHL_CF_LOAN_REQUEST, field_value: lead.loan_request });
  }
  if (env.GHL_CF_NOTES && lead.notes) {
    customFields.push({ id: env.GHL_CF_NOTES, field_value: lead.notes });
  }

  const upsertBody: Record<string, unknown> = {
    locationId,
    firstName: lead.first_name,
    lastName: lead.last_name || "",
    email: lead.email,
    source: lead.source || "smartr8.com",
    tags: [`funnel:${lead.funnel}`, "Web Lead"],
  };
  if (lead.phone_e164) upsertBody.phone = lead.phone_e164;
  if (lead.address1) upsertBody.address1 = lead.address1;
  if (customFields.length > 0) upsertBody.customFields = customFields;

  let contactId: string | undefined;
  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(upsertBody),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) logScopeError("upsert", lead.lead_id, res.status, text);
      else log("warn", "ghl.upsert_error", { lead_id: lead.lead_id, status: res.status, body: text.slice(0, 240) });
      return { ok: false, error: `GHL upsert ${res.status}: ${text.slice(0, 240)}`, scopeError: res.status === 401 || res.status === 403 };
    }
    const data = (text ? (JSON.parse(text) as UpsertResponse) : {}) as UpsertResponse;
    contactId = data.contact?.id || data.id;
    if (!contactId) {
      log("warn", "ghl.upsert_no_contact_id", { lead_id: lead.lead_id, body: text.slice(0, 240) });
      return { ok: false, error: "GHL upsert returned no contact id" };
    }
  } catch (e) {
    log("error", "ghl.upsert_network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: `GHL upsert network: ${e instanceof Error ? e.message : String(e)}` };
  }

  // ── Step 2: opportunity create on Web Leads / New Lead ──────────────────
  if (!env.GHL_PIPELINE_ID || !env.GHL_PIPELINE_STAGE_NEW) {
    log("warn", "ghl.opportunity_skipped_missing_pipeline_env", { lead_id: lead.lead_id });
    // Contact upsert succeeded; return ok with contactId so the orchestrator
    // can still tag and proceed. The retry cron will not re-attempt this.
    return { ok: true, contactId };
  }
  const oppBody = {
    pipelineId: env.GHL_PIPELINE_ID,
    locationId,
    pipelineStageId: env.GHL_PIPELINE_STAGE_NEW,
    contactId,
    name: `${lead.first_name} ${lead.last_name || ""} | ${funnelLabel(lead.funnel)}`.trim(),
    status: "open",
    monetaryValue: 0,
  };
  try {
    const res = await fetch(`${GHL_BASE}/opportunities/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(oppBody),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) logScopeError("opportunity", lead.lead_id, res.status, text);
      else log("warn", "ghl.opportunity_error", { lead_id: lead.lead_id, status: res.status, body: text.slice(0, 240) });
      return {
        ok: false,
        contactId,
        error: `GHL opportunity ${res.status}: ${text.slice(0, 240)}`,
        scopeError: res.status === 401 || res.status === 403,
      };
    }
  } catch (e) {
    log("error", "ghl.opportunity_network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, contactId, error: `GHL opportunity network: ${e instanceof Error ? e.message : String(e)}` };
  }

  log("info", "ghl.ok", { lead_id: lead.lead_id, contactId });
  return { ok: true, contactId };
}

/** Fire-and-forget tag add. Used by orchestrate.ts after Sendblue ok=true. */
export async function tagContact(env: Env, contactId: string, tags: string[]): Promise<void> {
  const token = env.SMARTR8_LEAD_CAPTURE_PROD;
  if (!token) return;
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ tags }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log("warn", "ghl.tag_error", { contactId, status: res.status, body: body.slice(0, 240) });
    }
  } catch (e) {
    log("warn", "ghl.tag_network_error", { contactId, err: e instanceof Error ? e.message : String(e) });
  }
}

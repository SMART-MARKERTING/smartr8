// GoHighLevel destination helper.
//
// The Worker's job is to upsert the contact (with tags + custom fields in
// the body, one API call) and then create an opportunity in the Web Leads
// pipeline. All outbound messaging (SMS via send_blue, email nurture)
// happens INSIDE GHL workflows. This helper never sends SMS or texts.
//
// Auth: Authorization: Bearer ${SMARTR8_LEAD_CAPTURE_PROD} (PIT labeled
// "smartr8-lead-capture-prod" in GHL), Version: 2021-07-28,
// Content-Type/Accept JSON.

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
  id?: string; // some endpoints return contact at the root
}

function funnelLabel(funnel: string): string {
  const f = String(funnel || "").toLowerCase();
  if (f.startsWith("heloc")) return "HELOC";
  if (f === "worksheet") return "refinance worksheet";
  if (f === "cash-out" || f === "cashout" || f === "rate-reduction" || f === "purchase") return "mortgage";
  return "mortgage";
}

/** Property-state lookup from a Lead. Prefer the explicit
 *  property_state field (worksheet captures state directly); fall back
 *  to a trailing ", XX" parse of address1 for funnels that only carry
 *  a full address. */
function propertyStateFor(lead: Lead): string {
  if (lead.property_state && lead.property_state.trim()) {
    return lead.property_state.trim().toUpperCase();
  }
  const m = (lead.address1 || "").match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
  return m ? m[1] : "";
}

/** Log 401/403 as scope errors distinctly so dev catches them quickly. */
function logScopeError(stage: string, lead_id: string, status: number, body: string): void {
  log("error", "ghl.scope_error", {
    stage,
    lead_id,
    http: status,
    body: body.slice(0, 300),
    hint: "Verify PIT grants required scopes (contacts.write, opportunities.write, locations/customFields.readonly).",
  });
}

/**
 * Upsert a contact in GHL. Tags + custom fields ride in the same body,
 * so this is one API call. Returns contactId for the downstream
 * opportunity create. Triggers GHL's "Contact Created with web lead tag"
 * workflow on success.
 */
export async function ghlUpsert(env: Env, lead: Lead): Promise<GhlResult> {
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

  const propertyState = propertyStateFor(lead);

  // TODO: "heloc" hardcoded because all current smartr8.com funnels
  // are HELOC. When non-HELOC funnels launch (purchase, refi, VA),
  // pass funnel through and pick the right tag.
  const tags = ["web lead", "heloc"];

  const customFields = [
    { id: env.GHL_CF_LOAN_TYPE, value: "HELOC" },
    { id: env.GHL_CF_PROPERTY_STATE, value: propertyState || "" },
    { id: env.GHL_CF_TCPA_CONSENT, value: "yes" },
    { id: env.GHL_CF_CONVERSATION_SUMMARY, value: lead.notes || "" },
  ].filter((cf): cf is { id: string; value: string } => Boolean(cf.id && cf.value));

  const body: Record<string, unknown> = {
    locationId,
    firstName: lead.first_name,
    lastName: lead.last_name || "",
    email: lead.email,
    source: lead.source || "smartr8.com",
    tags,
  };
  if (lead.phone_e164) body.phone = lead.phone_e164;
  if (lead.address1) body.address1 = lead.address1;
  if (customFields.length > 0) body.customFields = customFields;

  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) logScopeError("upsert", lead.lead_id, res.status, text);
      else log("warn", "ghl.upsert_error", { lead_id: lead.lead_id, status: res.status, body: text.slice(0, 240) });
      return {
        ok: false,
        error: `GHL upsert ${res.status}: ${text.slice(0, 240)}`,
        scopeError: res.status === 401 || res.status === 403,
      };
    }
    const data = (text ? (JSON.parse(text) as UpsertResponse) : {}) as UpsertResponse;
    const contactId = data.contact?.id || data.id;
    if (!contactId) {
      log("warn", "ghl.upsert_no_contact_id", { lead_id: lead.lead_id, body: text.slice(0, 240) });
      return { ok: false, error: "GHL upsert returned no contact id" };
    }
    log("info", "ghl.upsert_ok", { lead_id: lead.lead_id, contactId });
    return { ok: true, contactId };
  } catch (e) {
    log("error", "ghl.upsert_network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: `GHL upsert network: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Create an opportunity in the Web Leads pipeline. Called sequentially
 * after a successful upsert. Returns ok regardless of pipeline env
 * configuration: if the pipeline env vars are missing, this is a no-op
 * and we log a warning (the contact still landed in GHL via the upsert).
 */
export async function ghlCreateOpportunity(env: Env, lead: Lead, contactId: string): Promise<GhlResult> {
  const token = env.SMARTR8_LEAD_CAPTURE_PROD;
  const locationId = env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    return { ok: false, error: "GHL token or locationId missing" };
  }
  if (!env.GHL_PIPELINE_ID || !env.GHL_PIPELINE_STAGE_NEW) {
    log("warn", "ghl.opportunity_skipped_missing_pipeline_env", { lead_id: lead.lead_id });
    return { ok: true, contactId };
  }
  const body = {
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
      body: JSON.stringify(body),
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
    log("info", "ghl.opportunity_ok", { lead_id: lead.lead_id, contactId });
    return { ok: true, contactId };
  } catch (e) {
    log("error", "ghl.opportunity_network_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, contactId, error: `GHL opportunity network: ${e instanceof Error ? e.message : String(e)}` };
  }
}

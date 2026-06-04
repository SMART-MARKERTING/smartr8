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

// Loan-type tag by funnel id. The GHL "Tag by Loan Type" router branches off
// this tag to assign, route, and start the SMS/email nurture, so every active
// funnel maps to a loan type — no lead lands untagged (untagged leads fall to
// the router's None branch and are never auto-routed or texted). HELOC funnels
// map to "heloc"; the refinance/purchase worksheet funnels all share
// "mortgage" because the worksheet funnel id doesn't distinguish product (the
// specific product rides in the lead notes / loan_request for the LO).
const FUNNEL_LOAN_TYPE: Record<string, string> = {
  heloc: "heloc",
  "heloc-v2": "heloc",
  "heloc-quick": "heloc",
  "heloc-quick-v2": "heloc",
  cashout: "mortgage",
  "cash-out": "mortgage",
  "rate-reduction": "mortgage",
  purchase: "mortgage",
  worksheet: "mortgage",
};

// Legacy fallback: loan-type tag by ad-campaign landing-page path. Retained so
// a lead whose funnel id isn't recognized still tags correctly off the URL.
const FUNNEL_TAG_MAP: Record<string, string> = {
  "/heloc-v2": "heloc",
  "/heloc/quick-v2": "heloc",
};

/** Build the GHL contact tag set from a Lead. Always includes "web lead",
 *  then appends a loan-type tag derived from the funnel id (preferred) and,
 *  as a fallback, the landing-page path. Deduped so a lead matching both
 *  sources carries the loan-type tag only once. */
function tagsFor(lead: Lead): string[] {
  const tags = ["web lead"];
  const byFunnel = FUNNEL_LOAN_TYPE[String(lead.funnel || "").toLowerCase()];
  if (byFunnel) tags.push(byFunnel);
  try {
    const url = new URL(lead.landing_page ?? "");
    const pathname = url.pathname.replace(/\/$/, "") || url.pathname;
    const byPath = FUNNEL_TAG_MAP[pathname];
    if (byPath) tags.push(byPath);
  } catch {
    // Missing or malformed landing_page — the funnel-based tag still applies.
  }
  return Array.from(new Set(tags));
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

  const tags = tagsFor(lead);

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

export interface GhlOpportunity {
  id: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  name?: string;
}

/**
 * Find a contact's opportunities. Used by the admin tool to locate the
 * pipeline card(s) to remove. Narrows to GHL_PIPELINE_ID when set. Requires
 * the PIT to grant opportunities.readonly.
 */
export async function ghlFindOpportunitiesByContact(
  env: Env,
  contactId: string,
): Promise<{ ok: boolean; opportunities?: GhlOpportunity[]; error?: string; scopeError?: boolean }> {
  const token = env.SMARTR8_LEAD_CAPTURE_PROD;
  const locationId = env.GHL_LOCATION_ID;
  if (!token || !locationId) return { ok: false, error: "GHL token or locationId missing" };

  const url = new URL(`${GHL_BASE}/opportunities/search`);
  url.searchParams.set("location_id", locationId);
  url.searchParams.set("contact_id", contactId);
  if (env.GHL_PIPELINE_ID) url.searchParams.set("pipeline_id", env.GHL_PIPELINE_ID);

  try {
    const res = await fetch(url.toString(), { headers: authHeaders(token) });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const scope = res.status === 401 || res.status === 403;
      if (scope) logScopeError("opportunity_search", contactId, res.status, text);
      else log("warn", "ghl.opportunity_search_error", { contactId, status: res.status, body: text.slice(0, 240) });
      return { ok: false, error: `GHL opportunity search ${res.status}: ${text.slice(0, 240)}`, scopeError: scope };
    }
    const data = (text ? JSON.parse(text) : {}) as { opportunities?: GhlOpportunity[] };
    const opportunities = (data.opportunities ?? []).map((o) => ({
      id: o.id,
      pipelineId: o.pipelineId,
      pipelineStageId: o.pipelineStageId,
      status: o.status,
      name: o.name,
    }));
    return { ok: true, opportunities };
  } catch (e) {
    log("error", "ghl.opportunity_search_network_error", { contactId, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: `GHL opportunity search network: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Delete a single opportunity (removes the card from the pipeline). The
 * contact is left intact. Requires the PIT to grant opportunities.write.
 */
export async function ghlDeleteOpportunity(env: Env, opportunityId: string): Promise<GhlResult> {
  const token = env.SMARTR8_LEAD_CAPTURE_PROD;
  if (!token) return { ok: false, error: "SMARTR8_LEAD_CAPTURE_PROD not set" };
  try {
    const res = await fetch(`${GHL_BASE}/opportunities/${opportunityId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const scope = res.status === 401 || res.status === 403;
      if (scope) logScopeError("opportunity_delete", opportunityId, res.status, text);
      else log("warn", "ghl.opportunity_delete_error", { opportunityId, status: res.status, body: text.slice(0, 240) });
      return { ok: false, error: `GHL opportunity delete ${res.status}: ${text.slice(0, 240)}`, scopeError: scope };
    }
    log("info", "ghl.opportunity_delete_ok", { opportunityId });
    return { ok: true };
  } catch (e) {
    log("error", "ghl.opportunity_delete_network_error", { opportunityId, err: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: `GHL opportunity delete network: ${e instanceof Error ? e.message : String(e)}` };
  }
}

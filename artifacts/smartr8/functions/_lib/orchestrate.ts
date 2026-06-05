// Lead-capture orchestrator.
//
// Sync: LeadMailbox (the LO actively watches that inbox).
// Async (ctx.waitUntil):
//   - GHL chain: contact upsert (with tags + custom fields in body)
//     -> sequentially, opportunity create on the Web Leads pipeline.
//     Tags ride with the upsert; no separate /contacts/{id}/tags call.
//     The upsert triggers GHL's "Contact Created with web lead tag"
//     workflow, which routes by loan-type tags, assigns by timezone,
//     and handles all SMS and nurture downstream.
//   - Resend confirmation (parallel to the GHL chain; independent).
//
// The Worker does NOT send SMS. The Sendblue API is integrated only
// inside GHL's send_blue connector and is never called from this codebase.
//
// D1 row is written before any side-effect fires so the audit row exists
// even if every destination fails. KV dedup runs first; a hit within 10
// minutes is recorded as 'deduped' and returns early.

import { ghlCreateOpportunity, ghlUpsert } from "./ghl";
import { submitToLeadMailbox } from "./leadmailbox";
import { log } from "./log";
import { sendResendConfirmation } from "./resend";
import type { Env, GhlResult, Lead, LeadMailboxResult, TcpaConsent } from "./types";

const DEDUP_TTL_SECONDS = 600; // 10 minutes

// External CRM webhook (carries its own ?key=). Hardcoded so it works with no
// env setup; env.CRM_LEAD_WEBHOOK overrides it (e.g. to rotate the key later).
const CRM_LEAD_WEBHOOK_URL =
  "https://crm.smartr8.com/webhooks/lead?key=4519413906c139e16484f518fdd8968c";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function dedupKeyFor(lead: Lead): Promise<string> {
  const norm = `${lead.email.toLowerCase()}|${(lead.phone_e164 || "").trim()}|${lead.funnel}`;
  return `lead_dedup:${await sha256Hex(norm)}`;
}

interface OrchestrateContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface OrchestrateResult {
  ok: boolean;
  lead_id: string;
  duplicate?: boolean;
  leadmailbox: LeadMailboxResult;
}

/**
 * Process a validated, normalized Lead.
 *
 * `clientIp` is the visitor's real CF-Connecting-IP at the originating
 * request — forwarded to LeadMailbox as X-Forwarded-For so LM doesn't
 * reject the call as "foreign IP" from the Cloudflare egress range.
 */
export async function processLead(
  lead: Lead,
  consent: TcpaConsent | null,
  env: Env,
  ctx: OrchestrateContext,
  clientIp: string = "",
): Promise<OrchestrateResult> {
  const kv = env.LEAD_DEDUP;
  const db = env.LEADS_DB;

  // Express SMS opt-in — true only when the visitor checked the TCPA "Text me
  // about my application" box (which is the only thing that produces a non-null
  // `consent`). Forwarded to the CRM as `smsOptIn`; the CRM sets sms_consent from
  // it and its drip skips the text step without it, so THIS is what decides
  // "texted or not". Box checked → texted; box unchecked → not. Rides the
  // dedup-hit forward too, so a re-submit that opts in still upgrades consent.
  const smsOptIn = consent != null;

  // ── Dedup window ────────────────────────────────────────────────────
  const key = await dedupKeyFor(lead);
  if (kv) {
    try {
      const seen = await kv.get(key);
      if (seen) {
        log("info", "orchestrate.deduped", { lead_id: lead.lead_id, key });
        await safeInsertLead(db, { ...lead, lead_id: lead.lead_id }).catch(() => {});
        if (db) {
          await db
            .prepare("UPDATE leads SET leadmailbox_status = 'deduped' WHERE lead_id = ?")
            .bind(lead.lead_id)
            .run()
            .catch(() => {});
        }
        // Forward to the CRM even on a dedup hit so the text/drip goes out regardless of
        // duplicate status. LeadMailbox/GHL/Resend stay deduped (no double advisor pings);
        // the CRM cancels + restarts the lead's drip, so rapid re-submits yield one text.
        ctx.waitUntil(runCrmWebhook(env, lead, smsOptIn));
        return {
          ok: true,
          lead_id: lead.lead_id,
          duplicate: true,
          leadmailbox: { ok: false, error: "deduped" },
        };
      }
    } catch (e) {
      log("warn", "orchestrate.kv_read_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Audit row + consent row + dedup mark ────────────────────────────
  await safeInsertLead(db, lead);
  if (consent) await safeInsertConsent(db, consent);
  if (kv) {
    try {
      await kv.put(key, "1", { expirationTtl: DEDUP_TTL_SECONDS });
    } catch (e) {
      log("warn", "orchestrate.kv_put_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Sync: LeadMailbox ───────────────────────────────────────────────
  const lmResult = await submitToLeadMailbox(lead, clientIp);
  await updateLeadmailboxStatus(db, lead.lead_id, lmResult);

  // ── Async: GHL chain (upsert -> opportunity) + Resend + CRM webhook ──
  ctx.waitUntil(runGhlChain(env, db, lead));
  ctx.waitUntil(runResend(env, db, lead));
  ctx.waitUntil(runCrmWebhook(env, lead, smsOptIn));

  return { ok: true, lead_id: lead.lead_id, leadmailbox: lmResult };
}

// ───────────────────────────────────────────────────────────────────────
// D1 helpers
// ───────────────────────────────────────────────────────────────────────

async function safeInsertLead(db: Env["LEADS_DB"], lead: Lead): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO leads (
          lead_id, created_at, funnel, first_name, last_name, email, phone_e164,
          address1, property_state, loan_request, notes, source, referrer, landing_page,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        lead.lead_id,
        lead.created_at,
        lead.funnel,
        lead.first_name,
        lead.last_name ?? "",
        lead.email,
        lead.phone_e164 ?? "",
        lead.address1 ?? "",
        lead.property_state ?? null,
        lead.loan_request ?? "",
        lead.notes ?? "",
        lead.source ?? "smartr8.com",
        lead.referrer ?? "",
        lead.landing_page ?? "",
        lead.utm_source ?? "",
        lead.utm_medium ?? "",
        lead.utm_campaign ?? "",
        lead.utm_content ?? "",
        lead.utm_term ?? "",
        lead.ip ?? "",
        lead.user_agent ?? "",
      )
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_insert_lead_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

async function safeInsertConsent(db: Env["LEADS_DB"], c: TcpaConsent): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO tcpa_consents (
          consent_id, lead_id, consent_version, consent_text, ip, user_agent, page_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(c.consent_id, c.lead_id, c.consent_version, c.consent_text, c.ip, c.user_agent, c.page_url, c.created_at)
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_insert_consent_error", { lead_id: c.lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

async function updateLeadmailboxStatus(db: Env["LEADS_DB"], lead_id: string, r: LeadMailboxResult): Promise<void> {
  if (!db) return;
  const status = r.ok ? "sent" : "failed";
  try {
    await db
      .prepare(
        `UPDATE leads
           SET leadmailbox_status = ?,
               leadmailbox_attempts = leadmailbox_attempts + 1,
               leadmailbox_last_error = ?
         WHERE lead_id = ?`,
      )
      .bind(status, r.error ?? null, lead_id)
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_update_lm_error", { lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

async function updateGhlUpsertStatus(
  db: Env["LEADS_DB"],
  lead_id: string,
  r: GhlResult,
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `UPDATE leads
           SET ghl_upsert_status = ?,
               ghl_contact_id = COALESCE(?, ghl_contact_id),
               ghl_upsert_attempts = ghl_upsert_attempts + 1,
               ghl_upsert_last_error = ?
         WHERE lead_id = ?`,
      )
      .bind(r.ok ? "sent" : "failed", r.contactId ?? null, r.error ?? null, lead_id)
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_update_ghl_upsert_error", { lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

async function updateGhlOpportunityStatus(
  db: Env["LEADS_DB"],
  lead_id: string,
  r: GhlResult,
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        `UPDATE leads
           SET ghl_status = ?,
               ghl_attempts = ghl_attempts + 1,
               ghl_last_error = ?
         WHERE lead_id = ?`,
      )
      .bind(r.ok ? "sent" : "failed", r.error ?? null, lead_id)
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_update_ghl_opp_error", { lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

// ───────────────────────────────────────────────────────────────────────
// Async destination runners
// ───────────────────────────────────────────────────────────────────────

/** Upsert -> sequentially opportunity create. Each step writes its own status. */
async function runGhlChain(env: Env, db: Env["LEADS_DB"], lead: Lead): Promise<void> {
  const upsert = await ghlUpsert(env, lead);
  await updateGhlUpsertStatus(db, lead.lead_id, upsert);
  if (!upsert.ok || !upsert.contactId) {
    // Cannot create an opportunity without a contactId. Leave ghl_status
    // at 'pending' so the retry cron can re-attempt after the upsert
    // succeeds on a future retry.
    return;
  }
  const opp = await ghlCreateOpportunity(env, lead, upsert.contactId);
  await updateGhlOpportunityStatus(db, lead.lead_id, opp);
}

async function runResend(env: Env, db: Env["LEADS_DB"], lead: Lead): Promise<void> {
  const r = await sendResendConfirmation(env, lead);
  if (!db) return;
  try {
    await db
      .prepare(
        `UPDATE leads
           SET resend_status = ?, resend_attempts = resend_attempts + 1, resend_last_error = ?
         WHERE lead_id = ?`,
      )
      .bind(r.ok ? "sent" : "failed", r.error ?? null, lead.lead_id)
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_update_resend_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Forward the lead to the external CRM webhook. Uses the built-in
 * CRM_LEAD_WEBHOOK_URL (which carries its own ?key=), overridable via
 * env.CRM_LEAD_WEBHOOK. Best-effort: failures are logged, not retried, and
 * never block the response. Runs only for accepted leads — processLead returns
 * early on a dedup hit, before this fires, so the CRM isn't double-posted
 * within the dedup window.
 */
async function runCrmWebhook(env: Env, lead: Lead, smsOptIn = false): Promise<void> {
  const url = env.CRM_LEAD_WEBHOOK || CRM_LEAD_WEBHOOK_URL;
  if (!url) return;
  const payload = {
    lead_id: lead.lead_id,
    created_at: lead.created_at,
    funnel: lead.funnel,
    first_name: lead.first_name,
    last_name: lead.last_name ?? "",
    email: lead.email,
    phone: lead.phone_e164 ?? "",
    // The CRM derives sms_consent from this (smsOptIn === "yes" && phone present)
    // and its drip skips the text step without it — this is the consent gate.
    smsOptIn: smsOptIn ? "yes" : "no",
    property_state: lead.property_state ?? "",
    loan_request: lead.loan_request ?? "",
    notes: lead.notes ?? "",
    source: lead.source ?? "smartr8.com",
    landing_page: lead.landing_page ?? "",
    utm_source: lead.utm_source ?? "",
    utm_medium: lead.utm_medium ?? "",
    utm_campaign: lead.utm_campaign ?? "",
    utm_content: lead.utm_content ?? "",
    utm_term: lead.utm_term ?? "",
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log("warn", "orchestrate.crm_webhook_failed", { lead_id: lead.lead_id, status: res.status, body: body.slice(0, 200) });
    } else {
      log("info", "orchestrate.crm_webhook_ok", { lead_id: lead.lead_id });
    }
  } catch (e) {
    log("warn", "orchestrate.crm_webhook_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
  }
}

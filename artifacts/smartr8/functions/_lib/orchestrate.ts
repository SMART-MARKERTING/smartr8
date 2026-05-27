// Lead-capture orchestrator.
//
// Sync: LeadMailbox (the LO actively watches that inbox).
// Async (ctx.waitUntil): GHL upsert+opportunity, Resend confirmation,
// Sendblue evaluate+send. Each updates its own D1 status columns.
// On Sendblue ok=true, fire-and-forget tag "first_text_sent" on the
// GHL contact (gates downstream GHL nurture without double-texting).
//
// D1 row written before any side-effect fires so the audit row exists
// even if every destination fails. KV dedup runs first; a hit within 10
// minutes is recorded as 'deduped' and returns early.

import { sendToGhl, tagContact } from "./ghl";
import { submitToLeadMailbox } from "./leadmailbox";
import { log } from "./log";
import { sendResendConfirmation } from "./resend";
import { sendToSendblue } from "./sendblue";
import type { Env, Lead, LeadMailboxResult, TcpaConsent } from "./types";

const DEDUP_TTL_SECONDS = 600; // 10 minutes

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
 * Caller has already verified Turnstile and inserted the canonical Lead.
 */
export async function processLead(
  lead: Lead,
  consent: TcpaConsent | null,
  env: Env,
  ctx: OrchestrateContext,
): Promise<OrchestrateResult> {
  const kv = env.LEAD_DEDUP;
  const db = env.LEADS_DB;

  // ── Dedup window ────────────────────────────────────────────────────
  const key = await dedupKeyFor(lead);
  if (kv) {
    try {
      const seen = await kv.get(key);
      if (seen) {
        log("info", "orchestrate.deduped", { lead_id: lead.lead_id, key });
        // Best-effort: write a minimal D1 row reflecting the dedup so
        // the audit trail still captures the attempt.
        await safeInsertLead(db, { ...lead, lead_id: lead.lead_id }).catch(() => {});
        if (db) {
          await db
            .prepare("UPDATE leads SET leadmailbox_status = 'deduped' WHERE lead_id = ?")
            .bind(lead.lead_id)
            .run()
            .catch(() => {});
        }
        return {
          ok: true,
          lead_id: lead.lead_id,
          duplicate: true,
          leadmailbox: { ok: false, error: "deduped" },
        };
      }
    } catch (e) {
      log("warn", "orchestrate.kv_read_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
      // Fall through; do not block lead capture on KV failure.
    }
  }

  // ── Audit row + consent row + dedup mark (in parallel best-effort) ──
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
  const lmResult = await submitToLeadMailbox(lead);
  await updateLeadmailboxStatus(db, lead.lead_id, lmResult);

  // ── Async: GHL, Resend, Sendblue ────────────────────────────────────
  ctx.waitUntil(runGhl(env, db, lead));
  ctx.waitUntil(runResend(env, db, lead));
  ctx.waitUntil(runSendblue(env, db, lead));

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
          address1, loan_request, notes, source, referrer, landing_page,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

// ───────────────────────────────────────────────────────────────────────
// Async destination runners (each updates its own status columns)
// ───────────────────────────────────────────────────────────────────────

async function runGhl(env: Env, db: Env["LEADS_DB"], lead: Lead): Promise<void> {
  const r = await sendToGhl(env, lead);
  if (!db) return;
  try {
    await db
      .prepare(
        `UPDATE leads
           SET ghl_status = ?, ghl_contact_id = ?, ghl_attempts = ghl_attempts + 1, ghl_last_error = ?
         WHERE lead_id = ?`,
      )
      .bind(r.ok ? "sent" : "failed", r.contactId ?? null, r.error ?? null, lead.lead_id)
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_update_ghl_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
  }
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

async function runSendblue(env: Env, db: Env["LEADS_DB"], lead: Lead): Promise<void> {
  const r = await sendToSendblue(env, lead);
  if (!db) {
    if (r.ok) {
      log("info", "orchestrate.sendblue_ok_no_db_skip_tag", { lead_id: lead.lead_id });
    }
    return;
  }
  try {
    await db
      .prepare(
        `UPDATE leads
           SET sendblue_status = ?,
               sendblue_message_handle = ?,
               sendblue_service = ?,
               sendblue_attempts = sendblue_attempts + 1,
               sendblue_last_error = ?
         WHERE lead_id = ?`,
      )
      .bind(
        r.ok ? "sent" : "failed",
        r.messageHandle ?? null,
        r.service ?? null,
        r.error ?? null,
        lead.lead_id,
      )
      .run();
  } catch (e) {
    log("error", "orchestrate.d1_update_sendblue_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
  }

  if (r.ok) {
    // Tag the contact so future GHL nurture workflows can branch off
    // "first_text_sent" instead of "Contact Created" (avoids double-text
    // races with any existing GHL send_blue workflow).
    try {
      const row = await db
        .prepare("SELECT ghl_contact_id FROM leads WHERE lead_id = ?")
        .bind(lead.lead_id)
        .first<{ ghl_contact_id: string | null }>();
      if (row && row.ghl_contact_id) {
        await tagContact(env, row.ghl_contact_id, ["first_text_sent"]);
      }
    } catch (e) {
      log("warn", "orchestrate.tag_contact_lookup_error", { lead_id: lead.lead_id, err: e instanceof Error ? e.message : String(e) });
    }
  }
}

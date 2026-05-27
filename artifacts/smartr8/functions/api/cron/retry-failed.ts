// @ts-nocheck
// POST /api/cron/retry-failed
//
// Replays failed destinations for D1 rows where:
//   - leadmailbox_status / ghl_upsert_status / ghl_status / resend_status = 'failed'
//   - attempts < 5 for that destination
//   - the row is older than 60 seconds (avoid retrying mid-flight rows)
// Caps at 5 attempts: rows hitting the cap are marked 'dead_letter'.
//
// Triggered by the companion Worker at cloudflare-workers/retry-cron/
// every 5 minutes. Authenticated via the shared X-Cron-Secret header.

import { ghlCreateOpportunity, ghlUpsert } from "../../_lib/ghl";
import { submitToLeadMailbox } from "../../_lib/leadmailbox";
import { log } from "../../_lib/log";
import { sendResendConfirmation } from "../../_lib/resend";
import type { Env, Lead } from "../../_lib/types";

const MAX_ATTEMPTS = 5;
const MIN_AGE_SECONDS = 60;
const BATCH_LIMIT = 25;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface FailedRow extends Lead {
  leadmailbox_status: string;
  leadmailbox_attempts: number;
  ghl_upsert_status: string;
  ghl_upsert_attempts: number;
  ghl_contact_id: string | null;
  ghl_status: string;
  ghl_attempts: number;
  resend_status: string;
  resend_attempts: number;
}

export async function onRequestPost(context) {
  const { request, env } = context as { request: Request; env: Env };
  const secret = request.headers.get("X-Cron-Secret") ?? "";
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.LEADS_DB) {
    return jsonResponse({ ok: false, error: "LEADS_DB not bound" }, 500);
  }

  const cutoff = Date.now() - MIN_AGE_SECONDS * 1000;
  const rows = await env.LEADS_DB
    .prepare(
      `SELECT * FROM leads
        WHERE created_at < ?
          AND (
            (leadmailbox_status  = 'failed' AND leadmailbox_attempts  < ?)
            OR (ghl_upsert_status = 'failed' AND ghl_upsert_attempts < ?)
            OR (ghl_status        = 'failed' AND ghl_attempts        < ?)
            OR (resend_status     = 'failed' AND resend_attempts     < ?)
          )
        ORDER BY created_at ASC
        LIMIT ?`,
    )
    .bind(cutoff, MAX_ATTEMPTS, MAX_ATTEMPTS, MAX_ATTEMPTS, MAX_ATTEMPTS, BATCH_LIMIT)
    .all<FailedRow>();

  const candidates = rows.results ?? [];
  if (candidates.length === 0) {
    return jsonResponse({ ok: true, retried: 0 });
  }

  let retried = 0;
  for (const row of candidates) {
    const lead: Lead = rowToLead(row);

    // LeadMailbox retry
    if (row.leadmailbox_status === "failed" && row.leadmailbox_attempts < MAX_ATTEMPTS) {
      const r = await submitToLeadMailbox(lead);
      const nextAttempts = row.leadmailbox_attempts + 1;
      const status = r.ok ? "sent" : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET leadmailbox_status = ?, leadmailbox_attempts = ?, leadmailbox_last_error = ? WHERE lead_id = ?")
        .bind(status, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
    }

    // GHL upsert retry (drives the "Contact Created with web lead tag" workflow)
    let contactIdForOpportunity: string | null = row.ghl_contact_id;
    if (row.ghl_upsert_status === "failed" && row.ghl_upsert_attempts < MAX_ATTEMPTS) {
      const r = await ghlUpsert(env, lead);
      const nextAttempts = row.ghl_upsert_attempts + 1;
      const status = r.ok ? "sent" : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET ghl_upsert_status = ?, ghl_contact_id = COALESCE(?, ghl_contact_id), ghl_upsert_attempts = ?, ghl_upsert_last_error = ? WHERE lead_id = ?")
        .bind(status, r.contactId ?? null, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      if (r.ok && r.contactId) contactIdForOpportunity = r.contactId;
      retried++;
    }

    // GHL opportunity retry (only possible if a contactId exists)
    if (
      row.ghl_status === "failed" &&
      row.ghl_attempts < MAX_ATTEMPTS &&
      contactIdForOpportunity
    ) {
      const r = await ghlCreateOpportunity(env, lead, contactIdForOpportunity);
      const nextAttempts = row.ghl_attempts + 1;
      const status = r.ok ? "sent" : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET ghl_status = ?, ghl_attempts = ?, ghl_last_error = ? WHERE lead_id = ?")
        .bind(status, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
    }

    // Resend retry
    if (row.resend_status === "failed" && row.resend_attempts < MAX_ATTEMPTS) {
      const r = await sendResendConfirmation(env, lead);
      const nextAttempts = row.resend_attempts + 1;
      const status = r.ok ? "sent" : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET resend_status = ?, resend_attempts = ?, resend_last_error = ? WHERE lead_id = ?")
        .bind(status, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
    }
  }

  log("info", "retry_failed.complete", { candidates: candidates.length, retried });
  return jsonResponse({ ok: true, candidates: candidates.length, retried });
}

function rowToLead(row: FailedRow): Lead {
  return {
    lead_id: row.lead_id,
    created_at: row.created_at,
    funnel: row.funnel as Lead["funnel"],
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email ?? "",
    phone_e164: row.phone_e164 ?? "",
    address1: row.address1 ?? "",
    loan_request: row.loan_request ?? "",
    notes: row.notes ?? "",
    source: row.source ?? "smartr8.com",
    referrer: row.referrer ?? "",
    landing_page: row.landing_page ?? "",
    utm_source: row.utm_source ?? "",
    utm_medium: row.utm_medium ?? "",
    utm_campaign: row.utm_campaign ?? "",
    utm_content: row.utm_content ?? "",
    utm_term: row.utm_term ?? "",
    ip: row.ip ?? "",
    user_agent: row.user_agent ?? "",
  };
}

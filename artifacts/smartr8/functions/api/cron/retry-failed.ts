// @ts-nocheck
// POST /api/cron/retry-failed
//
// Replays failed destinations for D1 rows that:
//   - have any of {ghl, resend, sendblue, leadmailbox} status = 'failed'
//   - have attempts < 5 for that destination
//   - haven't been attempted in the last 60 seconds
// Caps at 5 attempts: rows that hit the cap are marked 'dead_letter'.
//
// Triggered by the companion Worker at cloudflare-workers/retry-cron/
// every 5 minutes. Authenticated via the shared X-Cron-Secret header.

import { sendToGhl, tagContact } from "../../_lib/ghl";
import { submitToLeadMailbox } from "../../_lib/leadmailbox";
import { log } from "../../_lib/log";
import { sendResendConfirmation } from "../../_lib/resend";
import { sendToSendblue } from "../../_lib/sendblue";
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
  ghl_status: string;
  ghl_attempts: number;
  ghl_contact_id: string | null;
  resend_status: string;
  resend_attempts: number;
  sendblue_status: string;
  sendblue_attempts: number;
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

  // Find rows with any failed destination, capped to a batch.
  // `created_at` is epoch ms; require it to be older than 60s ago.
  const cutoff = Date.now() - MIN_AGE_SECONDS * 1000;
  const rows = await env.LEADS_DB
    .prepare(
      `SELECT * FROM leads
        WHERE created_at < ?
          AND (
            (leadmailbox_status = 'failed' AND leadmailbox_attempts < ?)
            OR (ghl_status         = 'failed' AND ghl_attempts         < ?)
            OR (resend_status      = 'failed' AND resend_attempts      < ?)
            OR (sendblue_status    = 'failed' AND sendblue_attempts    < ?)
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
      const status = r.ok
        ? "sent"
        : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET leadmailbox_status = ?, leadmailbox_attempts = ?, leadmailbox_last_error = ? WHERE lead_id = ?")
        .bind(status, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
    }

    // GHL retry
    if (row.ghl_status === "failed" && row.ghl_attempts < MAX_ATTEMPTS) {
      const r = await sendToGhl(env, lead);
      const nextAttempts = row.ghl_attempts + 1;
      const status = r.ok
        ? "sent"
        : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET ghl_status = ?, ghl_contact_id = ?, ghl_attempts = ?, ghl_last_error = ? WHERE lead_id = ?")
        .bind(status, r.contactId ?? row.ghl_contact_id, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
    }

    // Resend retry
    if (row.resend_status === "failed" && row.resend_attempts < MAX_ATTEMPTS) {
      const r = await sendResendConfirmation(env, lead);
      const nextAttempts = row.resend_attempts + 1;
      const status = r.ok
        ? "sent"
        : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET resend_status = ?, resend_attempts = ?, resend_last_error = ? WHERE lead_id = ?")
        .bind(status, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
    }

    // Sendblue retry
    if (row.sendblue_status === "failed" && row.sendblue_attempts < MAX_ATTEMPTS) {
      const r = await sendToSendblue(env, lead);
      const nextAttempts = row.sendblue_attempts + 1;
      const status = r.ok
        ? "sent"
        : nextAttempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      await env.LEADS_DB
        .prepare("UPDATE leads SET sendblue_status = ?, sendblue_message_handle = ?, sendblue_service = ?, sendblue_attempts = ?, sendblue_last_error = ? WHERE lead_id = ?")
        .bind(status, r.messageHandle ?? null, r.service ?? null, nextAttempts, r.error ?? null, lead.lead_id)
        .run();
      retried++;
      if (r.ok && row.ghl_contact_id) {
        // tag-after-text side effect on successful retry too
        await tagContact(env, row.ghl_contact_id, ["first_text_sent"]);
      }
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

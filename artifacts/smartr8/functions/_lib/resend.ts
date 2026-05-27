// Resend destination helper. Thin wrapper around the existing
// functions/_lib/leadEmail.ts module so the orchestrator and the
// /api/lead-email endpoint share one implementation.

import { handleLeadEmail } from "./leadEmail";
import type { DestinationResult, Env, Lead } from "./types";

export async function sendResendConfirmation(env: Env, lead: Lead): Promise<DestinationResult> {
  // handleLeadEmail expects { firstName, email, phone, funnel, leadId }.
  // Map our canonical Lead onto that shape.
  const res = await handleLeadEmail(env as unknown as Parameters<typeof handleLeadEmail>[0], {
    firstName: lead.first_name,
    email: lead.email,
    phone: lead.phone_e164 || "",
    funnel: lead.funnel,
    leadId: lead.lead_id,
  });
  if (res.success) return { ok: true };
  return { ok: false, error: res.error };
}

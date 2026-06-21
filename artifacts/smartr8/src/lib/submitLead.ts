export type FunnelId = "heloc" | "cashout" | "rate-reduction" | "purchase";

export interface LeadPayload {
  funnel: FunnelId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  homeValue?: string;
  mortgageBalance?: string;
  creditScore?: string;
  dob?: string;
  additionalFields?: Record<string, string | string[]>;
  honeypot?: string;
  pageLoadTime?: number;
}

export interface SubmitResult {
  success: boolean;
  leadId?: string;
  error?: string;
}

export function getOrCreateTrackingId(): string {
  try {
    const key = "smartr8_tid";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function getParam(name: string): string {
  try {
    return new URLSearchParams(window.location.search).get(name) ?? "";
  } catch {
    return "";
  }
}

function formatDob(raw: string): string {
  const parts = raw.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : raw;
}

export async function submitLead(payload: LeadPayload): Promise<SubmitResult> {
  const body = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    address: payload.address ?? "",
    city: payload.city ?? "",
    state: payload.state ?? "",
    zip: payload.zip ?? "",
    homeValue: payload.homeValue ?? "",
    mortgageBalance: payload.mortgageBalance ?? "",
    creditScore: payload.creditScore ?? "",
    dob: formatDob(payload.dob ?? ""),
    funnelType: payload.funnel,
    additionalFields: payload.additionalFields ?? {},
    honeypot: payload.honeypot ?? "",
    pageLoadTime: payload.pageLoadTime ?? 0,
    submittedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    utmSource: getParam("utm_source"),
    utmMedium: getParam("utm_medium"),
    utmCampaign: getParam("utm_campaign"),
    utmContent: getParam("utm_content"),
    referer: document.referrer,
    trackingId: getOrCreateTrackingId(),
  };

  // Call the Worker. It handles bot checks, deduping, LeadMailbox, and Formspree server-side.
  try {
    const res = await fetch("/api/submit-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await res.json()) as SubmitResult;

    // NOTE: Meta Pixel `Lead` event is intentionally NOT fired here.
    // It is fired exactly once per lead from the matching whats-next page
    // (HelocWhatsnext / CashOutWhatsnext / RateReductionWhatsnext /
    // PurchaseWhatsnext / WhatsNext) so a single funnel = a single Lead.
    return { success: result.success, leadId: result.leadId, error: result.error };
  } catch {
    return { success: false, error: "Could not reach the secure submission service. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified funnel helpers (used by /worksheet unified funnel + /whats-next)
// ─────────────────────────────────────────────────────────────────────────────

export type FunnelEntryButton =
  | "cash-out"
  | "rate-reduction"
  | "home-equity"
  | "heloc"
  | "purchase";

/** Maps the home-button entry product to a LM-compatible funnel id. */
function funnelFromEntry(entry: FunnelEntryButton): FunnelId {
  if (entry === "heloc") return "heloc";
  if (entry === "purchase") return "purchase";
  if (entry === "rate-reduction") return "rate-reduction";
  // home-equity and cash-out both POST as cashout to LM since LM has no separate code
  return "cashout";
}

export interface FunnelCompletionPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  entryButton: FunnelEntryButton;
  honeypot?: string;
  /** Full snapshot of every captured funnel answer — sent in Notes. */
  funnelAnswers: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Submit a unified-funnel lead to LeadMailbox at funnel completion (before fork).
 * Reuses the existing /api/submit-lead Worker → LM + Formspree pipeline.
 * Adds an "Entry-Button" + "Funnel-Source" tag so Mykoal can see which path
 * the lead came from.
 */
export async function submitFunnelCompletion(
  p: FunnelCompletionPayload,
): Promise<SubmitResult> {
  const additionalFields: Record<string, string> = {
    "Funnel-Source": "smartr8-unified-funnel",
    "Entry-Button": p.entryButton,
  };
  // Flatten funnelAnswers into stringified additionalFields for the Notes block
  for (const [k, v] of Object.entries(p.funnelAnswers)) {
    if (v === undefined || v === null || v === "") continue;
    additionalFields[k] = String(v);
  }
  return submitLead({
    funnel: funnelFromEntry(p.entryButton),
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    additionalFields,
    honeypot: p.honeypot,
    pageLoadTime: 0,
  });
}

export type NextStepAction =
  | "scheduled-call"
  | "instant-heloc-options"
  | "full-application";

/**
 * Append a "next-step action" lightweight record to LeadMailbox so Mykoal
 * can see what the lead did on /whats-next. LeadMailbox has no native update
 * API; we POST a second slim record tagged so it can be correlated by email.
 *
 * Reads contact info from sessionStorage (stored by the unified funnel).
 * No-op if contact info is unavailable (lead came via a path that didn't
 * capture name/email — we don't want to POST a junk record without identity).
 */
export async function appendNextStepAction(
  action: NextStepAction,
  meta: { source?: string; entryButton?: FunnelEntryButton } = {},
): Promise<void> {
  let contact: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } = {};
  try {
    const raw = sessionStorage.getItem("smartr8_funnel_contact_v1");
    if (raw) contact = JSON.parse(raw);
  } catch {}
  if (!contact.email || !contact.firstName) return;

  const labels: Record<NextStepAction, string> = {
    "scheduled-call": "Clicked: Schedule a Call (Cal.com)",
    "instant-heloc-options": "Clicked: See Instant HELOC Options",
    "full-application": "Clicked: Start Full Application (LendingPad)",
  };

  await submitLead({
    funnel: meta.entryButton ? funnelFromEntry(meta.entryButton) : "cashout",
    firstName: contact.firstName,
    lastName: contact.lastName ?? "",
    email: contact.email,
    phone: contact.phone ?? "",
    additionalFields: {
      "Funnel-Source": "smartr8-whats-next-action",
      "Next-Step-Action": action,
      "Action-Label": labels[action],
      "Whats-Next-Source": meta.source ?? "",
    },
    pageLoadTime: 0,
  }).catch(() => {});
}

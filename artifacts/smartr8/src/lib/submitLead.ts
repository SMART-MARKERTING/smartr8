export type FunnelId = "heloc" | "cashout" | "rate-reduction" | "purchase" | "legal" | "see-my-options";

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";

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
  /** Optional attribution override for routes that hand off into a funnel. */
  pageUrlOverride?: string;
  /** When set, opts into the strict v2 server pipeline (Turnstile +
   *  TCPA audit). Forms not yet migrated to <TcpaConsent /> can omit
   *  these fields and the server still accepts them. */
  turnstile_token?: string;
  consent?: boolean;
  consent_version?: string;
  consent_text?: string;
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

function loanRequest(funnelType: FunnelId): string {
  if (funnelType === "cashout") return "Cash-Out Refinance";
  if (funnelType === "rate-reduction") return "Rate and Term Refinance";
  if (funnelType === "purchase") return "Purchase";
  if (funnelType === "heloc") return "HELOC";
  if (funnelType === "legal") return "LegalZoom Partner Lead";
  if (funnelType === "see-my-options") return "Program Finder";
  return "Refinance";
}

function buildLmPayload(payload: LeadPayload): Record<string, string> {
  const digits = (payload.phone ?? "").replace(/\D/g, "");
  const extra = payload.additionalFields ?? {};
  const notes: string[] = [`Funnel: ${payload.funnel}`];
  if (payload.homeValue) notes.push(`Home Value: ${payload.homeValue}`);
  if (payload.mortgageBalance) notes.push(`Mortgage Balance: ${payload.mortgageBalance}`);
  if (payload.creditScore) notes.push(`Credit Score: ${payload.creditScore}`);
  Object.entries(extra).forEach(([k, v]) => {
    notes.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
  });
  return {
    FirstName: payload.firstName,
    LastName: payload.lastName,
    Email: payload.email,
    MobilePhone: digits,
    DOB: formatDob(payload.dob ?? ""),
    Phys_Address: payload.address ?? "",
    Phys_City: payload.city ?? "",
    Phys_State: payload.state ?? "",
    Phys_Zip: payload.zip ?? "",
    Credit_Rating: payload.creditScore ?? "",
    Prop_Value: payload.homeValue ?? "",
    Existing_Loan_Amount: payload.mortgageBalance ?? "",
    Loan_Request: loanRequest(payload.funnel),
    Notes: notes.join("\n"),
  };
}

export async function submitLead(payload: LeadPayload): Promise<SubmitResult> {
  // Pre-build LM payload client-side for browser fallback (used only if Worker's LM call fails)
  const lmPayload = buildLmPayload(payload);

  // Fields are named for the new v2 server (functions/api/submit-lead.ts
  // zod schema). Legacy aliases (funnelType, utmSource, referer) are
  // kept alongside the new names so any older consumer still sees them;
  // the server's zod schema tolerates unknown fields.
  const utm_source = getParam("utm_source");
  const utm_medium = getParam("utm_medium");
  const utm_campaign = getParam("utm_campaign");
  const utm_content = getParam("utm_content");
  const utm_term = getParam("utm_term");
  const body: Record<string, unknown> = {
    funnel: payload.funnel,
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
    additionalFields: payload.additionalFields ?? {},
    honeypot: payload.honeypot ?? "",
    pageLoadTime: payload.pageLoadTime ?? 0,
    submittedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    referrer: document.referrer,
    page_url: payload.pageUrlOverride || (typeof window !== "undefined" ? window.location.href : ""),
    trackingId: getOrCreateTrackingId(),
    // Legacy aliases for backwards compatibility
    funnelType: payload.funnel,
    utmSource: utm_source,
    utmMedium: utm_medium,
    utmCampaign: utm_campaign,
    utmContent: utm_content,
    referer: document.referrer,
  };
  if (payload.turnstile_token) {
    body.turnstile_token = payload.turnstile_token;
    if (payload.consent !== undefined) body.consent = payload.consent;
    if (payload.consent_version) body.consent_version = payload.consent_version;
    if (payload.consent_text) body.consent_text = payload.consent_text;
  }

  // Call the Worker — it tries LM server-side (with user IP forwarding) + Formspree + KV dedup.
  // If the Worker's LM call was blocked by IP filtering, it returns lmPayload so the browser
  // can fire LM directly as a fallback from the user's real IP.
  try {
    const res = await fetch("/api/submit-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await res.json()) as SubmitResult & {
      lead_id?: string;
      lmPayload?: Record<string, string> | null;
    };

    // Browser fallback: fires if Worker's LM call was IP-blocked (lmPayload non-null).
    // keepalive:true survives page navigation like sendBeacon but is a normal fetch,
    // so browser tracking-prevention does not target it the way it does beacons.
    if (result.lmPayload) {
      fetch(LM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(result.lmPayload),
      }).catch(() => {});
    }

    // NOTE: Meta Pixel `Lead` event is intentionally NOT fired here.
    // It is fired exactly once per lead from the matching whats-next page
    // (HelocWhatsnext / CashOutWhatsnext / RateReductionWhatsnext /
    // PurchaseWhatsnext / WhatsNext) so a single funnel = a single Lead.
    return { success: result.success, leadId: result.leadId ?? result.lead_id, error: result.error };
  } catch {
    // Worker failed — fire LM from browser as last resort
    fetch(LM_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(lmPayload),
    }).catch(() => {});
    // Still show success — Lead event will fire on the whats-next page once redirect lands.
    return { success: true };
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
  /** Required by the v2 server pipeline. Forwarded straight through to submitLead. */
  turnstile_token?: string;
  consent?: boolean;
  consent_version?: string;
  consent_text?: string;
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
    turnstile_token: p.turnstile_token,
    consent: p.consent,
    consent_version: p.consent_version,
    consent_text: p.consent_text,
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

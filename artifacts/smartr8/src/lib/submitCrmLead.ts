// Lead submission for the product funnels (DSCR, Cash Out Refi, Rate and Term
// Refi, Purchase). Posts to the same-origin /api/crm-lead proxy, which attaches
// the CRM webhook secret server-side and forwards to
// https://crm.smartr8.com/webhooks/lead. The `loanType` tag rides along so the
// CRM enrolls the lead into the matching drip campaign.

export type LoanType = "HELOC" | "DSCR" | "CASHOUT_REFI" | "RT_REFI" | "PURCHASE" | "VA";

export interface CrmLeadPayload {
  loanType: LoanType;
  firstName: string;
  lastName: string;
  email: string;
  /** Optional — only needed when the SMS-consent box is ticked. */
  phone?: string;
  /** True only when the visitor ticked the optional SMS-consent checkbox. */
  consent: boolean;
  consent_text?: string;
  consent_version?: string;
  /** Qualifying criteria — pre-fill the CRM lead's Quote/loan-details panel. */
  homeValue?: string;
  mortgageBalance?: string;
  creditScore?: string;
  /** Loan purpose / use-of-funds → the CRM "Goal" field. */
  loanPurpose?: string;
  /** MM/DD/YYYY (optional). */
  dob?: string;
  /** Honeypot field value (must be empty for a real submission). */
  honeypot?: string;
  /** Epoch ms the funnel mounted; the proxy drops sub-8s bot submissions. */
  pageLoadTime?: number;
  /** Cloudflare Turnstile token from the bot-check widget. */
  turnstile_token?: string;
}

export interface SubmitResult {
  success: boolean;
  error?: string;
}

function getParam(name: string): string {
  try {
    return new URLSearchParams(window.location.search).get(name) ?? "";
  } catch {
    return "";
  }
}

export async function submitCrmLead(payload: CrmLeadPayload): Promise<SubmitResult> {
  const body: Record<string, unknown> = {
    loanType: payload.loanType,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone ?? "",
    consent: payload.consent,
    consent_text: payload.consent_text ?? "",
    consent_version: payload.consent_version ?? "",
    // Qualifying criteria → CRM custom quote fields (home_value / mortgage_balance / credit) + DOB.
    home_value: payload.homeValue ?? "",
    mortgage_balance: payload.mortgageBalance ?? "",
    credit: payload.creditScore ?? "",
    loan_goal: payload.loanPurpose ?? "",
    dob: payload.dob ?? "",
    honeypot: payload.honeypot ?? "",
    pageLoadTime: payload.pageLoadTime ?? 0,
    turnstile_token: payload.turnstile_token ?? "",
    // source = the funnel URL so Mykoal can see which page captured the lead.
    source: typeof window !== "undefined" ? window.location.pathname.replace(/^\//, "") || "smartr8.com" : "smartr8.com",
    page_url: typeof window !== "undefined" ? window.location.href : "",
    utm_source: getParam("utm_source"),
    utm_medium: getParam("utm_medium"),
    utm_campaign: getParam("utm_campaign"),
    utm_content: getParam("utm_content"),
    utm_term: getParam("utm_term"),
  };

  try {
    const res = await fetch("/api/crm-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await res.json().catch(() => ({}))) as SubmitResult;
    return { success: !!result.success, error: result.error };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

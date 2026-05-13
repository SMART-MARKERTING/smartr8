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
  fallback?: boolean;
  leadId?: string;
  error?: string;
}

function getOrCreateTrackingId(): string {
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

  const res = await fetch("/api/submit-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return res.json() as Promise<SubmitResult>;
}

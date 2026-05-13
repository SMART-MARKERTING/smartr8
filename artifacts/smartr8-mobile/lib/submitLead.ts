const FORMSPREE_ENDPOINT = "https://formspree.io/f/maqvlqrg";

export type FunnelId = "heloc" | "cashout" | "rate-reduction" | "purchase";

export interface LeadPayload {
  funnel: FunnelId;
  subjectLine: string;
  loanPurpose: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  homeValue?: string;
  mortgageBalance?: string;
  creditScore: string;
  dob: string;
  additionalFields: Record<string, string | string[]>;
}

export async function submitLead(payload: LeadPayload): Promise<void> {
  const submittedAt = new Date().toISOString();

  const body: Record<string, string> = {
    _subject: payload.subjectLine,
    source: "smartr8-mobile-app",
    loan_purpose: payload.loanPurpose,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    property_state: payload.state,
    zip: payload.zip,
    creditScore: payload.creditScore,
    dob: payload.dob,
    consent: "true",
    submittedAt,
  };

  if (payload.homeValue) body.homeValue = payload.homeValue;
  if (payload.mortgageBalance) body.mortgageBalance = payload.mortgageBalance;

  Object.entries(payload.additionalFields).forEach(([k, v]) => {
    body[k] = Array.isArray(v) ? v.join(", ") : v;
  });

  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Formspree responded with ${response.status}`);
  }
}

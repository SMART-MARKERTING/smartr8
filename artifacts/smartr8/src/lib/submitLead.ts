const FORMSPREE_ENDPOINT = "https://formspree.io/f/maqvlqrg";
const LOAN_OFFICER_AI_WEBHOOK = "REPLACE_WITH_LOAN_OFFICER_AI_WEBHOOK_URL";

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

  const fd = new FormData();
  fd.append("_subject", payload.subjectLine);
  fd.append("loan_purpose", payload.loanPurpose);
  fd.append("firstName", payload.firstName);
  fd.append("lastName", payload.lastName);
  fd.append("email", payload.email);
  fd.append("phone", payload.phone);
  fd.append("address", payload.address);
  fd.append("city", payload.city);
  fd.append("property_state", payload.state);
  fd.append("zip", payload.zip);
  if (payload.homeValue) fd.append("homeValue", payload.homeValue);
  if (payload.mortgageBalance) fd.append("mortgageBalance", payload.mortgageBalance);
  fd.append("creditScore", payload.creditScore);
  fd.append("dob", payload.dob);
  fd.append("consent", "true");
  Object.entries(payload.additionalFields).forEach(([k, v]) => {
    fd.append(k, Array.isArray(v) ? v.join(", ") : v);
  });

  const webhookBody = JSON.stringify({
    source: "smartr8.com",
    funnel: payload.funnel,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    zip: payload.zip,
    homeValue: payload.homeValue,
    mortgageBalance: payload.mortgageBalance,
    creditScore: payload.creditScore,
    dob: payload.dob,
    loanPurpose: payload.loanPurpose,
    additionalFields: payload.additionalFields,
    submittedAt,
  });

  const formspreeP = fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    body: fd,
    headers: { Accept: "application/json" },
  }).catch((err) => console.error("Formspree error:", err));

  const webhookP = fetch(LOAN_OFFICER_AI_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: webhookBody,
  }).catch((err) => console.error("LoanOfficer.ai webhook error:", err));

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));

  await Promise.race([Promise.allSettled([formspreeP, webhookP]), timeout]);
}

// Zod schema for the incoming lead submission body. Used by every
// capture endpoint to reject malformed input with field-level errors.

import { z } from "zod";

export const LeadSubmissionSchema = z.object({
  // Identity (firstName + email are the only truly required fields)
  firstName: z.string().trim().min(1, "firstName required").max(120),
  lastName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("invalid email").max(320),
  phone: z.string().trim().max(40).optional().default(""),

  // Address (optional; only collected on some funnels)
  address: z.string().trim().max(500).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  zip: z.string().trim().max(20).optional().default(""),

  // Funnel context
  funnel: z.string().trim().min(1).max(40),
  funnelLength: z.enum(["long", "short"]).optional(),

  // Freeform context for the Notes block
  homeValue: z.string().max(120).optional().default(""),
  mortgageBalance: z.string().max(120).optional().default(""),
  creditScore: z.string().max(80).optional().default(""),
  dob: z.string().max(40).optional().default(""),
  loanRequest: z.string().max(200).optional().default(""),
  notes: z.string().max(8000).optional().default(""),

  // Turnstile + TCPA. Optional so the strict v2 path opts in by sending
  // them; legacy forms without these fields skip Turnstile + the consent
  // audit row but still hit the new pipeline (D1 audit, LM, GHL, Resend,
  // Sendblue). Migrate forms incrementally, then tighten to required.
  turnstile_token: z.string().max(4096).optional().default(""),
  consent: z.boolean().optional(),
  consent_version: z.string().trim().max(80).optional().default(""),
  consent_text: z.string().trim().max(8000).optional().default(""),

  // Attribution
  page_url: z.string().max(2048).optional().default(""),
  referrer: z.string().max(2048).optional().default(""),
  utm_source: z.string().max(200).optional().default(""),
  utm_medium: z.string().max(200).optional().default(""),
  utm_campaign: z.string().max(200).optional().default(""),
  utm_content: z.string().max(200).optional().default(""),
  utm_term: z.string().max(200).optional().default(""),
});

export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>;

export interface ValidationError {
  ok: false;
  errors: Record<string, string>;
}
export interface ValidationOk {
  ok: true;
  data: LeadSubmission;
}

export function validateLeadSubmission(input: unknown): ValidationError | ValidationOk {
  const parsed = LeadSubmissionSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

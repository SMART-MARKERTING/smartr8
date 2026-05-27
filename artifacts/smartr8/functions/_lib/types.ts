// Canonical Lead shape consumed by every destination helper and the
// orchestrator. Each helper does its own field mapping internally.

export type FunnelId =
  | "heloc"
  | "heloc-v2"
  | "heloc-quick"
  | "heloc-quick-v2"
  | "cashout"
  | "cash-out"
  | "rate-reduction"
  | "purchase"
  | "worksheet"
  | "other";

export interface Lead {
  /** Stable UUID assigned by the orchestrator. */
  lead_id: string;
  /** Epoch ms when this lead was received. */
  created_at: number;

  funnel: FunnelId;

  first_name: string;
  last_name?: string;
  email: string;
  /** E.164 formatted, e.g. "+15555551234". May be empty if phone not collected. */
  phone_e164?: string;
  address1?: string;

  /** Human-readable product label fed to LeadMailbox Loan_Request. */
  loan_request?: string;
  /** Freeform notes (form answers, summary, etc.) for LeadMailbox + GHL. */
  notes?: string;

  /** "smartr8.com" by default; allows future overrides. */
  source?: string;
  referrer?: string;
  landing_page?: string;

  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  ip?: string;
  user_agent?: string;
}

/** TCPA consent record (audit row alongside every accepted lead). */
export interface TcpaConsent {
  consent_id: string;
  lead_id: string;
  consent_version: string;
  consent_text: string;
  ip: string;
  user_agent: string;
  page_url: string;
  created_at: number;
}

/** Standard result shape returned by every destination helper. */
export interface DestinationResult {
  ok: boolean;
  error?: string;
}

export interface LeadMailboxResult extends DestinationResult {
  /** When set, the Worker's LM call was IP-blocked; the browser-side
   *  fallback (preserved) can replay using this payload. */
  fallbackPayload?: Record<string, string>;
}

export interface GhlResult extends DestinationResult {
  contactId?: string;
  /** True when GHL returned a scope/auth error so we can flag it loudly. */
  scopeError?: boolean;
}

export interface SendblueResult extends DestinationResult {
  messageHandle?: string;
  /** "iMessage" | "SMS" | "RCS" (Sendblue values). */
  service?: string;
}

/** Cloudflare Pages Functions environment shape used across this codebase. */
export interface Env {
  // D1
  LEADS_DB: D1Database;
  // KV
  LEAD_DEDUP: KVNamespace;
  CF_KV_NAMESPACE?: KVNamespace;

  // Resend
  RESEND_API_KEY?: string;

  // LeadMailbox has no secret; the URL is hardcoded in the helper.

  // GoHighLevel
  SMARTR8_LEAD_CAPTURE_PROD?: string; // PIT (labeled smartr8-lead-capture-prod in GHL)
  GHL_LOCATION_ID?: string;
  GHL_CF_LOAN_REQUEST?: string;
  GHL_CF_NOTES?: string;
  GHL_PIPELINE_ID?: string;
  GHL_PIPELINE_STAGE_NEW?: string;

  // Sendblue
  SENDBLUE_API_KEY_ID?: string;
  SENDBLUE_API_SECRET_KEY?: string;
  SENDBLUE_FROM_NUMBER?: string;

  // Turnstile
  TURNSTILE_SECRET_KEY?: string;

  // Cron
  CRON_SECRET?: string;
}

/** Minimal Cloudflare type stubs so this file is self-contained even when
 *  the Workers/Pages global types aren't pulled in by the tsconfig. */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

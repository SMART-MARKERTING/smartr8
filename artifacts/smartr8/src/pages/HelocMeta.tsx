import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Check, Loader2, Phone } from "lucide-react";
import { AddressAutocomplete as GoogleAddressAutocomplete, type AddressResult } from "@/components/AddressAutocomplete";
import { JsonLd } from "@/components/JsonLd";
import { PageMeta } from "@/components/PageMeta";
import { submitLead } from "@/lib/submitLead";
import { trackFbEvent } from "@/lib/fbq";
import "./helocMeta.css";

const COMPANY_NAME = "Adaxa Home, LLC";
const COMPANY_NMLS = "2380533";
const LOAN_OFFICER_NAME = "Mykoal DeShazo";
const LOAN_OFFICER_NMLS = "1912347";
const HEADER_LOAN_OFFICER_NAME = "MYKOALDESHAZO";
const CONTACT_PHONE = "(480) 206-9290";
const CONTACT_PHONE_HREF = "tel:4802069290";
const HELOCMETA_WEBHOOK_URL = import.meta.env.VITE_HELOCMETA_WEBHOOK_URL as string | undefined;
const DSCRCOMETA_WEBHOOK_URL = import.meta.env.VITE_DSCRCOMETA_WEBHOOK_URL as string | undefined;
const HELOC_FIGURE_REDIRECT_URL =
  "https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7";
const DSCR_LENDINGPAD_REDIRECT_URL =
  "https://prod.lendingpad.com/adaxa-home/dabbfd28-9b5f-46b8-9029-aa478433a995/pos#/account/guest-application";
const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "0x4AAAAAADX6q2I_R4J9sxTC";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const CONSENT_TEXT =
  `I agree to be contacted by ${COMPANY_NAME} and its licensed loan officers via phone, text, ` +
  "and email, including automated technology. Message and data rates may apply. Consent is not a condition of service.";

type LoanPurpose = "purchase" | "refinance" | "cash_out_refinance" | "heloc" | "home_equity_loan" | "home_improvement";
type CashUse = "debt_consolidation" | "renovation" | "investment" | "other";
type PropertyUse = "primary_residence" | "second_home" | "investment_property";
type CreditScore = "excellent" | "good" | "fair" | "below_average" | "not_sure";
type StepId =
  | "loan-purpose"
  | "property-address"
  | "mortgage-balance"
  | "cash-use"
  | "home-value"
  | "property-use"
  | "credit-score"
  | "contact";

type FunnelData = {
  loan_purpose: LoanPurpose | "";
  property_address: string;
  no_address_yet: boolean;
  city: string;
  state: string;
  zip: string;
  county: string;
  current_mortgage_balance: number;
  cash_use: CashUse | "";
  estimated_home_value: number;
  property_use: PropertyUse | "";
  credit_score_range: CreditScore | "";
  military_status: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  tcpa_consent: boolean;
  honeypot: string;
};

type ConsentState = {
  ready: boolean;
  token: string;
};

type StepDef = {
  id: StepId;
  progress: number;
};

export type MetaFunnelId = "helocmeta" | "dscrcometa";

type MetaFunnelConfig = {
  funnelId: MetaFunnelId;
  storageKey: string;
  consentVersion: string;
  webhookUrl?: string;
  canonical: string;
  pageTitle: string;
  pageDescription: string;
  schemaServiceType: string;
  firstStepEyebrow: string;
  firstStepTitle: string;
  firstStepSubheading: string;
  loanPurposeOptions: Array<{ value: LoanPurpose; icon: string; title: string }>;
  cashUsePurposes: Set<LoanPurpose>;
  cashUseTitle: string;
  cashUseSubheading?: string;
  mortgageTitle: string;
  mortgageSubheading: string;
  mortgageLabel: string;
  homeValueTitle: string;
  homeValueSubheading?: string;
  propertyUseTitle: string;
  propertyUseOptions: Array<{ value: PropertyUse; icon: string; title: string }>;
  contactEyebrow: string;
  contactTitle: string;
  contactSubheading: string;
  submitLabel: string;
  completionRedirectUrl: string;
  fbContentName: string;
  defaultLoanRequest: string;
  complianceDisclosure: string;
  additionalFields?: Record<string, string>;
};

type QuotePayload = FunnelData & {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  utm_id: string;
  meta_site_source: string;
  meta_placement: string;
  meta_campaign_id: string;
  meta_adset_id: string;
  meta_ad_id: string;
  landing_page_url: string;
  referrer: string;
  device_type: string;
  funnel_path: string;
  created_at: string;
};

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string | HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const initialData: FunnelData = {
  loan_purpose: "",
  property_address: "",
  no_address_yet: false,
  city: "",
  state: "",
  zip: "",
  county: "",
  current_mortgage_balance: 320000,
  cash_use: "",
  estimated_home_value: 400000,
  property_use: "",
  credit_score_range: "",
  military_status: false,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  tcpa_consent: false,
  honeypot: "",
};

const loanPurposeOptions: Array<{ value: LoanPurpose; icon: string; title: string }> = [
  { value: "purchase", icon: "🏠", title: "Purchase" },
  { value: "refinance", icon: "🔄", title: "Refinance" },
  { value: "cash_out_refinance", icon: "💰", title: "Cash-Out Refinance" },
  { value: "heloc", icon: "🏦", title: "HELOC" },
  { value: "home_equity_loan", icon: "🏛️", title: "Home Equity Loan" },
  { value: "home_improvement", icon: "🛠️", title: "Home Improvement" },
];

const dscrCoMetaLoanPurposeOptions: Array<{ value: LoanPurpose; icon: string; title: string }> = [
  { value: "purchase", icon: "DS", title: "Purchase Rental" },
  { value: "refinance", icon: "RF", title: "Refinance Rental" },
  { value: "cash_out_refinance", icon: "CO", title: "Cash-Out DSCR" },
  { value: "heloc", icon: "ST", title: "Short-Term Rental" },
  { value: "home_equity_loan", icon: "2-4", title: "2-4 Unit Property" },
  { value: "home_improvement", icon: "PF", title: "Portfolio Review" },
];

const cashUseOptions: Array<{ value: CashUse; icon: string; title: string }> = [
  { value: "debt_consolidation", icon: "💳", title: "Debt Consolidation" },
  { value: "renovation", icon: "🔨", title: "Renovation" },
  { value: "investment", icon: "📈", title: "Investment" },
  { value: "other", icon: "✨", title: "Other" },
];

const propertyUseOptions: Array<{ value: PropertyUse; icon: string; title: string }> = [
  { value: "primary_residence", icon: "🏡", title: "Primary Residence" },
  { value: "second_home", icon: "🏖️", title: "Second Home" },
  { value: "investment_property", icon: "📈", title: "Investment Property" },
];

const dscrCoMetaPropertyUseOptions: Array<{ value: PropertyUse; icon: string; title: string }> = [
  { value: "primary_residence", icon: "LT", title: "Long-Term Rental" },
  { value: "second_home", icon: "ST", title: "Short-Term Rental" },
  { value: "investment_property", icon: "IP", title: "Investment Property" },
];

const creditOptions: Array<{ value: CreditScore; icon: string; title: string; sub: string }> = [
  { value: "excellent", icon: "😎", title: "Excellent", sub: "740+" },
  { value: "good", icon: "😊", title: "Good", sub: "700-739" },
  { value: "fair", icon: "🙂", title: "Fair", sub: "660-699" },
  { value: "below_average", icon: "😐", title: "Below Average", sub: "620-659" },
  { value: "not_sure", icon: "❓", title: "Not Sure", sub: "We'll help" },
];

const stateOptions = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

const lenders = [
  "United Wholesale Mortgage",
  "Newrez",
  "Sun West Mortgage",
  "loanDepot",
  "PennyMac",
  "Loan United",
  "Kind Lending",
  "Spring EQ",
  "Figure",
  "Freedom Mortgage",
];

const cashUsePurposes = new Set<LoanPurpose>([
  "cash_out_refinance",
  "heloc",
  "home_equity_loan",
  "home_improvement",
]);

const dscrCashUsePurposes = new Set<LoanPurpose>(["cash_out_refinance"]);

const helocMetaConfig: MetaFunnelConfig = {
  funnelId: "helocmeta",
  storageKey: "smartr8_helocmeta_quote_v1",
  consentVersion: "2026-06-29.helocmeta.v1",
  webhookUrl: HELOCMETA_WEBHOOK_URL,
  canonical: "/helocmeta",
  pageTitle: "Mortgage Rate Quote | Adaxa Home",
  pageDescription:
    "Request a personalized mortgage, HELOC, cash-out refinance, refinance, purchase, or home improvement financing quote from Adaxa Home.",
  schemaServiceType: "Mortgage quote request",
  firstStepEyebrow: "RATE QUOTE",
  firstStepTitle: "What's your loan purpose?",
  firstStepSubheading: "Choose the option that best matches what you're looking for.",
  loanPurposeOptions,
  cashUsePurposes,
  cashUseTitle: "What will you use the cash for?",
  mortgageTitle: "Current mortgage balance",
  mortgageSubheading: "How much do you currently owe on your mortgage?",
  mortgageLabel: "Current mortgage balance",
  homeValueTitle: "Estimated home value",
  propertyUseTitle: "How will the property be used?",
  propertyUseOptions,
  contactEyebrow: "SEND MY OPTIONS",
  contactTitle: "Where should we send your quote?",
  contactSubheading: "A licensed loan officer will call and text you with your personalized rate.",
  submitLabel: "Request Quote",
  completionRedirectUrl: HELOC_FIGURE_REDIRECT_URL,
  fbContentName: "HELOC Meta Quote Funnel",
  defaultLoanRequest: "Mortgage Rate Quote",
  complianceDisclosure:
    "HELOCs and home equity loans are secured by the home, subject to approval, and not a commitment to lend.",
};

export const dscrCoMetaConfig: MetaFunnelConfig = {
  funnelId: "dscrcometa",
  storageKey: "smartr8_dscrcometa_quote_v1",
  consentVersion: "2026-06-29.dscrcometa.v1",
  webhookUrl: DSCRCOMETA_WEBHOOK_URL,
  canonical: "/dscrcometa",
  pageTitle: "DSCR Investor Loan Quote | Adaxa Home",
  pageDescription:
    "Request a DSCR investor loan quote for rental property purchase, refinance, cash-out, short-term rental, or 2-4 unit financing.",
  schemaServiceType: "DSCR investor loan quote request",
  firstStepEyebrow: "DSCR QUOTE",
  firstStepTitle: "What's the DSCR scenario?",
  firstStepSubheading: "Choose the investor loan path that best matches the rental property.",
  loanPurposeOptions: dscrCoMetaLoanPurposeOptions,
  cashUsePurposes: dscrCashUsePurposes,
  cashUseTitle: "What will you use the cash for?",
  cashUseSubheading: "For cash-out DSCR loans, this helps match the cleanest investor path.",
  mortgageTitle: "Requested loan amount",
  mortgageSubheading: "For a purchase, use the loan amount you want. For a refinance, use the current balance.",
  mortgageLabel: "Requested loan amount or current balance",
  homeValueTitle: "Estimated property value",
  homeValueSubheading: "Use the purchase price, current value, or your best estimate.",
  propertyUseTitle: "How is the rental used?",
  propertyUseOptions: dscrCoMetaPropertyUseOptions,
  contactEyebrow: "SEND MY DSCR OPTIONS",
  contactTitle: "Where should we send your DSCR quote?",
  contactSubheading: "A licensed loan officer will review the rental scenario and follow up with DSCR options.",
  submitLabel: "Request DSCR Quote",
  completionRedirectUrl: DSCR_LENDINGPAD_REDIRECT_URL,
  fbContentName: "DSCR CO Meta Quote Funnel",
  defaultLoanRequest: "DSCR Investor Loan Quote",
  complianceDisclosure:
    "DSCR investor loans are subject to rental income, property, credit, title, appraisal, and underwriting review. Not a commitment to lend.",
  additionalFields: {
    "Loan Type": "DSCR",
    loanType: "DSCR",
    "Funnel-Source": "dscrcometa",
  },
};

let turnstileScriptLoaded: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (turnstileScriptLoaded) return turnstileScriptLoaded;
  turnstileScriptLoaded = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src*="turnstile/v0/api.js"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(script);
  });
  return turnstileScriptLoaded;
}

function currency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function numberFromCurrency(value: string): number {
  return Number(value.replace(/[^\d]/g, "")) || 0;
}

function deviceType(): string {
  if (typeof window === "undefined") return "unknown";
  if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
}

function getParam(params: URLSearchParams, name: string): string {
  return params.get(name) ?? "";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function labelFor<T extends string>(options: Array<{ value: T; title: string; sub?: string }>, value: T | ""): string {
  const match = options.find((option) => option.value === value);
  if (!match) return "";
  return match.sub ? `${match.title} (${match.sub})` : match.title;
}

function buildCompletionRedirectUrl(destination: string, payload: QuotePayload, config: MetaFunnelConfig, loanPurposeLabel: string): string {
  try {
    const url = new URL(destination);
    const forwardedParams: Record<string, string> = {
      utm_source: payload.utm_source,
      utm_medium: payload.utm_medium,
      utm_campaign: payload.utm_campaign,
      utm_content: payload.utm_content,
      utm_term: payload.utm_term,
      utm_id: payload.utm_id,
      meta_site_source: payload.meta_site_source,
      meta_placement: payload.meta_placement,
      meta_campaign_id: payload.meta_campaign_id,
      meta_adset_id: payload.meta_adset_id,
      meta_ad_id: payload.meta_ad_id,
      source: "smartr8",
      funnel: config.funnelId,
      loan_purpose: loanPurposeLabel || config.defaultLoanRequest,
    };

    Object.entries(forwardedParams).forEach(([key, value]) => {
      if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
    });

    return url.toString();
  } catch {
    return destination;
  }
}

function buildSteps(data: FunnelData, config: MetaFunnelConfig): StepDef[] {
  const steps: StepDef[] = [
    { id: "loan-purpose", progress: 14 },
    { id: "property-address", progress: 29 },
    { id: "mortgage-balance", progress: 44 },
  ];
  if (data.loan_purpose && config.cashUsePurposes.has(data.loan_purpose)) {
    steps.push({ id: "cash-use", progress: 56 });
  }
  return [
    ...steps,
    { id: "home-value", progress: 67 },
    { id: "property-use", progress: 78 },
    { id: "credit-score", progress: 89 },
    { id: "contact", progress: 100 },
  ];
}

function validateStep(id: StepId, data: FunnelData, consent: ConsentState): boolean {
  if (id === "loan-purpose") return Boolean(data.loan_purpose);
  if (id === "property-address") {
    const hasLocation = data.city.trim().length > 1 && data.state.trim().length === 2 && data.zip.trim().length >= 5;
    return data.no_address_yet ? hasLocation : data.property_address.trim().length > 4 && hasLocation;
  }
  if (id === "mortgage-balance") return data.current_mortgage_balance >= 0;
  if (id === "cash-use") return Boolean(data.cash_use);
  if (id === "home-value") return data.estimated_home_value >= 50000;
  if (id === "property-use") return Boolean(data.property_use);
  if (id === "credit-score") return Boolean(data.credit_score_range);
  if (id === "contact") {
    return (
      data.first_name.trim().length > 1 &&
      data.last_name.trim().length > 1 &&
      isEmail(data.email) &&
      phoneDigits(data.phone).length === 10 &&
      data.tcpa_consent &&
      consent.ready
    );
  }
  return false;
}

function HeaderProgress({ progress }: { progress: number }) {
  return (
    <header className="hm-header">
      <div className="hm-header-row">
        <Link href="/" className="hm-home-link">
          <ArrowLeft size={16} />
          <span>Home</span>
        </Link>
        <div className="hm-brand">
          <img src="/adaxa-meta-logo.png" alt="Adaxa Home" />
          <div>
            <strong>ADAXA HOME LLC</strong>
            <small>NMLS #{COMPANY_NMLS}</small>
            <small>{HEADER_LOAN_OFFICER_NAME} · NMLS #{LOAN_OFFICER_NMLS}</small>
          </div>
        </div>
        <a className="hm-header-phone" href={CONTACT_PHONE_HREF} aria-label={`Call ${LOAN_OFFICER_NAME}`}>
          <Phone size={13} />
          <span>{CONTACT_PHONE}</span>
        </a>
        <div className="hm-percent">{progress}% Complete</div>
      </div>
      <div className="hm-progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}

function AlertBar() {
  return (
    <div className="hm-alert">
      📲 Your personalized rate quote will be instantly emailed and texted to you by a licensed loan officer.
    </div>
  );
}

function QuestionCard({
  eyebrow,
  title,
  subheading,
  children,
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  loading = false,
  showBack = true,
}: {
  eyebrow?: string;
  title: string;
  subheading?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
}) {
  return (
    <section className="hm-card">
      {eyebrow && <p className="hm-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {subheading && <p className="hm-subheading">{subheading}</p>}
      <div className="hm-card-body">{children}</div>
      <div className="hm-actions">
        {showBack ? (
          <button type="button" className="hm-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="hm-next-btn" onClick={onNext} disabled={nextDisabled || loading}>
          {loading ? <Loader2 size={17} className="hm-spin" /> : nextLabel}
          {!loading && <ArrowRight size={16} />}
        </button>
      </div>
    </section>
  );
}

function OptionButton({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: string;
  title: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`hm-option${selected ? " selected" : ""}`} onClick={onClick}>
      <span className="hm-option-icon">{icon}</span>
      <span className="hm-option-copy">
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
      <span className="hm-check">{selected && <Check size={14} strokeWidth={3} />}</span>
    </button>
  );
}

function SliderInput({
  label,
  min,
  max,
  step = 5000,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="hm-slider-wrap">
      <div className="hm-slider-value">{currency(value)}</div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="hm-range"
      />
      <div className="hm-slider-limits">
        <span>{currency(min)}</span>
        <span>{currency(max)}</span>
      </div>
      <label className="hm-field">
        <span>Typed amount</span>
        <input
          value={currency(value)}
          inputMode="numeric"
          onChange={(event) => onChange(Math.min(max, Math.max(min, numberFromCurrency(event.target.value))))}
        />
      </label>
    </div>
  );
}

function AddressAutocomplete({
  data,
  onChange,
}: {
  data: FunnelData;
  onChange: (patch: Partial<FunnelData>) => void;
}) {
  const handleAddressChange = useCallback(
    (result: AddressResult) => {
      onChange({
        property_address: result.formatted || result.street,
        city: result.city,
        state: result.state,
        zip: result.zip,
        county: result.county ?? data.county,
      });
    },
    [data.county, onChange],
  );

  return (
    <div className="hm-address">
      <label className="hm-toggle">
        <input
          type="checkbox"
          checked={data.no_address_yet}
          onChange={(event) => onChange({ no_address_yet: event.target.checked })}
        />
        <span>Don't have an address yet</span>
      </label>

      {!data.no_address_yet && (
        <div className="hm-field">
          <span>Search Address</span>
          <GoogleAddressAutocomplete
            value={data.property_address}
            placeholder="123 Main St, Springfield, IL"
            onChange={handleAddressChange}
          />
        </div>
      )}

      <div className="hm-grid two">
        <label className="hm-field">
          <span>City</span>
          <input value={data.city} autoComplete="address-level2" onChange={(event) => onChange({ city: event.target.value })} />
        </label>
        <label className="hm-field">
          <span>State</span>
          <select value={data.state} autoComplete="address-level1" onChange={(event) => onChange({ state: event.target.value })}>
            <option value="">Select</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="hm-grid two">
        <label className="hm-field">
          <span>ZIP Code</span>
          <input value={data.zip} inputMode="numeric" autoComplete="postal-code" onChange={(event) => onChange({ zip: event.target.value })} />
        </label>
        <label className="hm-field">
          <span>County optional</span>
          <input value={data.county} onChange={(event) => onChange({ county: event.target.value })} />
        </label>
      </div>
      <p className="hm-helper">Powered by Google. Select a suggestion to auto-fill city, state, and ZIP.</p>
    </div>
  );
}

function LenderLogoCarousel() {
  const marqueeLenders = [...lenders, ...lenders];

  return (
    <section className="hm-trust" aria-label="Lender trust section">
      <p className="hm-trust-kicker">PARTNERED WITH OVER 150 BANKS</p>
      <p className="hm-trust-sub">Trusted by the nation's top lenders</p>
      <div className="hm-logo-marquee" aria-label={lenders.join(", ")}>
        <div className="hm-logo-track">
          {marqueeLenders.map((lender, index) => (
            <div className="hm-logo-pill" key={`${lender}-${index}`}>
              {lender}
            </div>
          ))}
        </div>
      </div>
      <SecurityFooter />
    </section>
  );
}

function SecurityFooter() {
  return <p className="hm-secure">🔒 256-bit encrypted · No credit impact · 100% free</p>;
}

function ConsentCheckbox({
  checked,
  onCheckedChange,
  onToken,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onToken: (token: string) => void;
}) {
  const widgetEl = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !widgetEl.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !widgetEl.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(widgetEl.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onToken(token),
          "error-callback": () => onToken(""),
          "expired-callback": () => onToken(""),
          theme: "light",
          size: "flexible",
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {}
        widgetId.current = null;
      }
    };
  }, [onToken]);

  return (
    <div className="hm-consent-stack">
      <label className="hm-checkbox">
        <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
        <span>
          <strong>{CONSENT_TEXT}</strong>
        </span>
      </label>
      <p className="hm-disclosure">
        By submitting, you agree to be contacted by a licensed loan officer at the email and phone provided. See our{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/terms-of-use" target="_blank" rel="noopener noreferrer">
          Terms of Use
        </a>
        .
      </p>
      <div ref={widgetEl} className="hm-turnstile" aria-label="Security check" />
    </div>
  );
}

function ThankYouPage({ data, config }: { data: FunnelData; config: MetaFunnelConfig }) {
  return (
    <main className="hm-main">
      <section className="hm-card hm-thank-you">
        <p className="hm-eyebrow">QUOTE REQUEST</p>
        <h1>Your request is moving to the next step.</h1>
        <p className="hm-subheading">Redirecting you to the secure application path.</p>
        <div className="hm-summary">
          <div>
            <span>Loan purpose</span>
            <strong>{labelFor(config.loanPurposeOptions, data.loan_purpose) || "Review requested"}</strong>
          </div>
          <div>
            <span>Property state</span>
            <strong>{data.state || "Not provided"}</strong>
          </div>
          <div>
            <span>{config.homeValueTitle}</span>
            <strong>{currency(data.estimated_home_value)}</strong>
          </div>
          <div>
            <span>{config.mortgageLabel}</span>
            <strong>{currency(data.current_mortgage_balance)}</strong>
          </div>
          <div>
            <span>Confirmation</span>
            <strong>{data.email} · {data.phone}</strong>
          </div>
        </div>
        <Link href="/" className="hm-home-cta">
          Back to Home
        </Link>
      </section>
      <LenderLogoCarousel />
    </main>
  );
}

export function MetaQuoteFunnel({ config = helocMetaConfig }: { config?: MetaFunnelConfig }) {
  const [data, setData] = useState<FunnelData>(() => {
    try {
      const saved = localStorage.getItem(config.storageKey);
      return saved ? { ...initialData, ...JSON.parse(saved) } : initialData;
    } catch {
      return initialData;
    }
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [consent, setConsent] = useState<ConsentState>({ ready: false, token: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dataRef = useRef(data);
  const autoAdvanceTimer = useRef<number | null>(null);

  const steps = useMemo(() => buildSteps(data, config), [data, config]);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const currentProgress = currentStep?.progress ?? 14;

  const updateData = useCallback((patch: Partial<FunnelData>) => {
    setData((current) => {
      const next = { ...current, ...patch };
      dataRef.current = next;
      return next;
    });
  }, []);

  const updateDataAndAdvance = useCallback(
    (patch: Partial<FunnelData>) => {
      setError("");
      setData((current) => {
        const next = { ...current, ...patch };
        dataRef.current = next;
        return next;
      });
      if (autoAdvanceTimer.current !== null) window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = window.setTimeout(() => {
        setStepIndex((current) => Math.min(current + 1, buildSteps(dataRef.current, config).length - 1));
        autoAdvanceTimer.current = null;
      }, 140);
    },
    [config],
  );

  const setTurnstileToken = useCallback((token: string) => {
    setConsent({ ready: token.length > 0, token });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(config.storageKey, JSON.stringify(data));
    } catch {}
  }, [config.storageKey, data]);

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(steps.length - 1);
  }, [stepIndex, steps.length]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIndex]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) window.clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  const stepPath = useMemo(() => steps.map((step) => step.id).join(" > "), [steps]);
  const canContinue = validateStep(currentStep.id, data, consent);

  const goNext = () => {
    if (!canContinue || submitting) return;
    if (autoAdvanceTimer.current !== null) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (stepIndex < steps.length - 1) setStepIndex((current) => current + 1);
  };

  const goBack = () => {
    if (autoAdvanceTimer.current !== null) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setError("");
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const buildPayload = useCallback((): QuotePayload => {
    const params = new URLSearchParams(window.location.search);
    return {
      ...data,
      utm_source: getParam(params, "utm_source"),
      utm_medium: getParam(params, "utm_medium"),
      utm_campaign: getParam(params, "utm_campaign"),
      utm_content: getParam(params, "utm_content"),
      utm_term: getParam(params, "utm_term"),
      utm_id: getParam(params, "utm_id"),
      meta_site_source: getParam(params, "site_source_name"),
      meta_placement: getParam(params, "placement"),
      meta_campaign_id: getParam(params, "campaign_id"),
      meta_adset_id: getParam(params, "adset_id"),
      meta_ad_id: getParam(params, "ad_id"),
      landing_page_url: window.location.href,
      referrer: document.referrer,
      device_type: deviceType(),
      funnel_path: stepPath,
      created_at: new Date().toISOString(),
    };
  }, [data, stepPath]);

  const submitQuote = async () => {
    if (!validateStep("contact", data, consent) || submitting) return;
    setSubmitting(true);
    setError("");
    const payload = buildPayload();
    const loanPurposeLabel = labelFor(config.loanPurposeOptions, data.loan_purpose);
    let redirectStarted = false;
    try {
      const additionalFields = Object.entries(payload).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value === undefined || value === null || value === "") return acc;
        acc[key] = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
        return acc;
      }, {});
      Object.assign(additionalFields, config.additionalFields);
      additionalFields["Loan Purpose Label"] = loanPurposeLabel;
      additionalFields["Cash Use Label"] = labelFor(cashUseOptions, data.cash_use);
      additionalFields["Property Use Label"] = labelFor(config.propertyUseOptions, data.property_use);

      const result = await submitLead({
        funnel: config.funnelId,
        firstName: data.first_name.trim(),
        lastName: data.last_name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        address: data.property_address.trim(),
        city: data.city.trim(),
        state: data.state,
        zip: data.zip.trim(),
        homeValue: currency(data.estimated_home_value),
        mortgageBalance: currency(data.current_mortgage_balance),
        creditScore: labelFor(creditOptions, data.credit_score_range),
        loanRequest: config.funnelId === "dscrcometa" ? config.defaultLoanRequest : loanPurposeLabel || config.defaultLoanRequest,
        additionalFields,
        honeypot: data.honeypot,
        pageLoadTime: 0,
        pageUrlOverride: payload.landing_page_url,
        turnstile_token: consent.token,
        consent: data.tcpa_consent,
        consent_version: config.consentVersion,
        consent_text: CONSENT_TEXT,
      });

      if (!result.success) throw new Error(result.error || "Lead submission failed");

      if (config.webhookUrl) {
        fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }

      trackFbEvent("Lead", {
        content_name: config.fbContentName,
        content_category: "Mortgage",
        loan_purpose: data.loan_purpose,
      });
      trackFbEvent(config.funnelId === "dscrcometa" ? "SubmitApplication" : "ViewContent", {
        content_name: config.funnelId === "dscrcometa" ? "DSCR LendingPad Application" : "HELOC Figure Application",
        content_category: "Mortgage",
      });
      localStorage.removeItem(config.storageKey);
      redirectStarted = true;
      window.location.assign(buildCompletionRedirectUrl(config.completionRedirectUrl, payload, config, loanPurposeLabel));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We couldn't submit your quote request.");
    } finally {
      if (!redirectStarted) setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (currentStep.id === "loan-purpose") {
      return (
        <QuestionCard
          eyebrow={config.firstStepEyebrow}
          title={config.firstStepTitle}
          subheading={config.firstStepSubheading}
          onNext={goNext}
          nextDisabled={!canContinue}
          showBack={false}
        >
          <div className="hm-options">
            {config.loanPurposeOptions.map((option) => (
              <OptionButton
                key={option.value}
                icon={option.icon}
                title={option.title}
                selected={data.loan_purpose === option.value}
                onClick={() => updateDataAndAdvance({ loan_purpose: option.value, cash_use: "" })}
              />
            ))}
          </div>
        </QuestionCard>
      );
    }

    if (currentStep.id === "property-address") {
      return (
        <QuestionCard
          eyebrow="PROPERTY"
          title="Property address"
          subheading="Start typing the address, and we'll auto-fill the rest."
          onBack={goBack}
          onNext={goNext}
          nextLabel="Submit"
          nextDisabled={!canContinue}
        >
          <AddressAutocomplete data={data} onChange={updateData} />
        </QuestionCard>
      );
    }

    if (currentStep.id === "mortgage-balance") {
      return (
        <QuestionCard
          eyebrow="MORTGAGE"
          title={config.mortgageTitle}
          subheading={config.mortgageSubheading}
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canContinue}
        >
          <SliderInput
            label={config.mortgageLabel}
            min={0}
            max={3000000}
            value={data.current_mortgage_balance}
            onChange={(value) => updateData({ current_mortgage_balance: value })}
          />
        </QuestionCard>
      );
    }

    if (currentStep.id === "cash-use") {
      return (
        <QuestionCard
          eyebrow="CASH USE"
          title={config.cashUseTitle}
          subheading={config.cashUseSubheading}
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canContinue}
        >
          <div className="hm-options">
            {cashUseOptions.map((option) => (
              <OptionButton
                key={option.value}
                icon={option.icon}
                title={option.title}
                selected={data.cash_use === option.value}
                onClick={() => updateDataAndAdvance({ cash_use: option.value })}
              />
            ))}
          </div>
        </QuestionCard>
      );
    }

    if (currentStep.id === "home-value") {
      return (
        <QuestionCard
          eyebrow="EQUITY"
          title={config.homeValueTitle}
          subheading={config.homeValueSubheading}
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canContinue}
        >
          <SliderInput
            label={config.homeValueTitle}
            min={50000}
            max={3000000}
            value={data.estimated_home_value}
            onChange={(value) => updateData({ estimated_home_value: value })}
          />
        </QuestionCard>
      );
    }

    if (currentStep.id === "property-use") {
      return (
        <QuestionCard
          eyebrow="PROPERTY USE"
          title={config.propertyUseTitle}
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canContinue}
        >
          <div className="hm-options">
            {config.propertyUseOptions.map((option) => (
              <OptionButton
                key={option.value}
                icon={option.icon}
                title={option.title}
                selected={data.property_use === option.value}
                onClick={() => updateDataAndAdvance({ property_use: option.value })}
              />
            ))}
          </div>
        </QuestionCard>
      );
    }

    if (currentStep.id === "credit-score") {
      return (
        <QuestionCard
          eyebrow="CREDIT"
          title="What's your credit score?"
          subheading="A range is perfectly fine. This won't impact your credit."
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!canContinue}
        >
          <div className="hm-options">
            {creditOptions.map((option) => (
              <OptionButton
                key={option.value}
                icon={option.icon}
                title={option.title}
                sub={option.sub}
                selected={data.credit_score_range === option.value}
                onClick={() => updateDataAndAdvance({ credit_score_range: option.value })}
              />
            ))}
          </div>
        </QuestionCard>
      );
    }

    return (
      <QuestionCard
        eyebrow={config.contactEyebrow}
        title={config.contactTitle}
        subheading={config.contactSubheading}
        onBack={goBack}
        onNext={submitQuote}
        nextLabel={submitting ? "Submitting..." : config.submitLabel}
        nextDisabled={!canContinue}
        loading={submitting}
      >
        <div className="hm-grid two">
          <label className="hm-field">
            <span>First Name</span>
            <input value={data.first_name} autoComplete="given-name" onChange={(event) => updateData({ first_name: event.target.value })} />
          </label>
          <label className="hm-field">
            <span>Last Name</span>
            <input value={data.last_name} autoComplete="family-name" onChange={(event) => updateData({ last_name: event.target.value })} />
          </label>
        </div>
        <label className="hm-field">
          <span>Email</span>
          <input type="email" value={data.email} autoComplete="email" onChange={(event) => updateData({ email: event.target.value })} />
        </label>
        <label className="hm-field">
          <span>Phone</span>
          <input value={data.phone} inputMode="tel" autoComplete="tel" onChange={(event) => updateData({ phone: event.target.value })} />
        </label>
        <label className="hm-checkbox">
          <input
            type="checkbox"
            checked={data.military_status}
            onChange={(event) => updateData({ military_status: event.target.checked })}
          />
          <span>MILITARY: Check this box if you or your spouse are active or former military</span>
        </label>
        <ConsentCheckbox
          checked={data.tcpa_consent}
          onCheckedChange={(checked) => updateData({ tcpa_consent: checked })}
          onToken={setTurnstileToken}
        />
        <input
          className="hm-honeypot"
          tabIndex={-1}
          autoComplete="off"
          value={data.honeypot}
          onChange={(event) => updateData({ honeypot: event.target.value })}
          aria-hidden="true"
        />
        {error && <p className="hm-error">{error}</p>}
      </QuestionCard>
    );
  };

  return (
    <div className="helocmeta-page">
      <PageMeta
        title={config.pageTitle}
        description={config.pageDescription}
        canonical={config.canonical}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FinancialService",
          name: COMPANY_NAME,
          url: `https://smartr8.com${config.canonical}`,
          areaServed: "US",
          serviceType: config.schemaServiceType,
        }}
      />
      <HeaderProgress progress={currentProgress} />
      <AlertBar />
      <main className="hm-main">
        {renderStep()}
        <LenderLogoCarousel />
      </main>
      <footer className="hm-compliance">
        <p>
          {COMPANY_NAME} NMLS #{COMPANY_NMLS} | Equal Housing Lender | Subject to credit approval. Terms, conditions, and
          availability may vary. Not a commitment to lend.
        </p>
        <p>
          {LOAN_OFFICER_NAME} NMLS #{LOAN_OFFICER_NMLS}. {config.complianceDisclosure}
        </p>
      </footer>
    </div>
  );
}

export default function HelocMeta() {
  return <MetaQuoteFunnel config={helocMetaConfig} />;
}

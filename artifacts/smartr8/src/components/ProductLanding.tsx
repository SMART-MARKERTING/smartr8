import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Loader2 } from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCrmLead, type LoanType } from "@/lib/submitCrmLead";
import { trackFbEvent } from "@/lib/fbq";
import { FunnelFAQ, type FaqItem, type GuideLink } from "@/components/FunnelFAQ";
import { TrustBlock } from "@/components/TrustBlock";
import { ComplianceFooter } from "@/components/ComplianceFooter";
import { makeFunnelTracker } from "@/lib/funnelEvents";

// Single-page conversion funnel shared by the four product landers (DSCR, Cash
// Out Refi, Rate and Term Refi, Purchase). It mirrors the /heloc-v2 stack,
// brand tokens, and components, but uses the simple landing-page layout the
// brief calls for: hero -> benefits -> how it works -> lead form. Each page
// supplies its copy + loanType through a ProductConfig; everything compliance
// related (the verbatim SMS consent block, optional phone, trust row, NMLS
// identity) lives here so all four pages stay consistent.
//
// STYLE NOTE: customer-facing copy here uses no dashes (hyphen, en, or em) and
// formats phone numbers as (xxx) xxx xxxx, per the funnel copy rules. The
// shared <Header /> and <Footer /> are pre-existing brand chrome reused as-is.

const BRAND_RED = "#E31B23";
const BRAND_TEAL = "#13485A";
const CREAM = "#F8F5F0";

// Public Turnstile site key (safe to commit; pairs with the server-side
// TURNSTILE_SECRET_KEY). Matches the key baked into <TcpaConsent />.
const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || "0x4AAAAAADX6q2I_R4J9sxTC";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

const CONSENT_VERSION =
  (import.meta.env.VITE_TCPA_CONSENT_VERSION as string | undefined) || "2026-06-01.funnel.v1";

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string | HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let turnstileScriptLoaded: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (turnstileScriptLoaded) return turnstileScriptLoaded;
  turnstileScriptLoaded = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src*="turnstile/v0/api.js"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = TURNSTILE_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
  return turnstileScriptLoaded;
}

export interface Benefit {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface HowStep {
  title: string;
  body: string;
}

export interface ProductConfig {
  loanType: LoanType;
  /** Clean route, e.g. "/dscr". Used for canonical + JSON-LD url. */
  route: string;
  meta: { title: string; description: string };
  eyebrow: string;
  h1: string;
  subhead: string;
  /** The product phrase dropped into the verbatim SMS consent block, e.g.
   *  "cash out refinance" -> "...about my cash out refinance inquiry...". */
  consentProduct: string;
  trustPills: { icon: LucideIcon; label: string }[];
  benefits: Benefit[];
  howSteps: HowStep[];
  /** Submit button label, e.g. "Get My DSCR Options". */
  ctaLabel: string;
  /** Schema.org Service name + serviceType for the JSON-LD block. */
  serviceName: string;
  serviceType: string;
  /** snake_case analytics page key, e.g. "dscr", "va", "heloc". */
  trackingPage: string;
  /** FAQ items rendered below the form (FunnelFAQ + FAQPage schema). */
  faqs?: FaqItem[];
  /** "Read the full guide" link(s) after the FAQ block. */
  faqGuideLinks?: GuideLink[];
  /** Secondary CTA label shown after the FAQ; defaults to ctaLabel. */
  secondaryCtaLabel?: string;
  /** Render {{VA_DISCLAIMER_TEXT}} in the ComplianceFooter (VA pages). */
  vaDisclaimer?: boolean;
}

const LICENSED_STATES = [
  "Arizona",
  "Colorado",
  "Connecticut",
  "Florida",
  "Michigan",
  "Minnesota",
  "Oregon",
  "Pennsylvania",
  "Texas",
  "Virginia",
  "Washington",
];

function buildConsentText(product: string): string {
  return (
    "By checking this box and providing my phone number, I give my express written consent " +
    "to receive recurring SMS text messages from Mykoal DeShazo (mortgage services through " +
    "Adaxa Home LLC, NMLS 2380533) about my " +
    product +
    " inquiry, application status, document requests, appointment reminders, and marketing " +
    "offers. You are opting into marketing texts. Consent is not a condition of any purchase, " +
    "loan application, or service. Message frequency may vary. Message and data rates may apply. " +
    "Reply STOP to opt out. Reply HELP for help. Your mobile information will not be sold or " +
    "shared with third parties for promotional or marketing purposes."
  );
}

// ── Qualifying criteria (mirror the HELOC funnel) ───────────────────────────
const CREDIT_RANGES = ["580 to 619", "620 to 659", "660 to 699", "700 to 739", "740 to 779", "780+", "Not sure"];
const DOB_MONTHS = [
  { v: 1, label: "Jan" }, { v: 2, label: "Feb" }, { v: 3, label: "Mar" }, { v: 4, label: "Apr" },
  { v: 5, label: "May" }, { v: 6, label: "Jun" }, { v: 7, label: "Jul" }, { v: 8, label: "Aug" },
  { v: 9, label: "Sep" }, { v: 10, label: "Oct" }, { v: 11, label: "Nov" }, { v: 12, label: "Dec" },
];
const DOB_MAX_YEAR = new Date().getFullYear() - 18; // 18+ enforced at the option level
const DOB_YEAR_OPTIONS = Array.from({ length: DOB_MAX_YEAR - 1925 + 1 }, (_, i) => DOB_MAX_YEAR - i);
const DOB_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

/** True when M/D/Y are a real calendar date and the person is 18+ today. */
function dobIsValid(m: string, d: string, y: string): boolean {
  if (!m || !d || !y) return false;
  const month = parseInt(m, 10), day = parseInt(d, 10), year = parseInt(y, 10);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return false;
  return new Date(year + 18, month - 1, day) <= new Date();
}

/** MM/DD/YYYY for the CRM (matches the HELOC funnel's notes format). */
function dobToMMDDYYYY(m: string, d: string, y: string): string {
  if (!m || !d || !y) return "";
  return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
}

// Native-select styling to match the form's <Input> look.
const SELECT_CLASS =
  "flex h-12 w-full rounded-md border border-input bg-background px-3 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

export function ProductLanding({ config }: { config: ProductConfig }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [homeValue, setHomeValue] = useState("");
  const [mortgageBalance, setMortgageBalance] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [dobM, setDobM] = useState("");
  const [dobD, setDobD] = useState("");
  const [dobY, setDobY] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState("");
  const [pageLoadTime] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const widgetEl = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  const consentText = buildConsentText(config.consentProduct);

  // Conversion analytics for this funnel page (snake_case {page}_{element}_{action}).
  const track = useRef(makeFunnelTracker(config.trackingPage)).current;
  const formStarted = useRef(false);
  const handleFormStart = () => {
    if (formStarted.current) return;
    formStarted.current = true;
    track.formStart();
  };

  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_name: config.loanType,
      content_category: "Mortgage",
    });
  }, [config.loanType]);

  // Render the Turnstile bot-check once the form section is mounted.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !widgetEl.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !widgetEl.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(widgetEl.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t: string) => setToken(t),
          "error-callback": () => setToken(""),
          "expired-callback": () => setToken(""),
          theme: "light",
          size: "flexible",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {}
        widgetId.current = null;
      }
    };
  }, []);

  const scrollToForm = () => {
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Phone is optional unless the visitor opts into texts.
  const phoneRequired = consent;
  const phoneOk = !phoneRequired || phone.trim().length >= 7;
  // DOB is optional; but if the visitor starts it, it must be a valid 18+ date.
  const dobTouched = !!(dobM || dobD || dobY);
  const dobOk = !dobTouched || dobIsValid(dobM, dobD, dobY);
  const canSubmit =
    !isSubmitting &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    phoneOk &&
    homeValue.trim().length > 0 &&
    mortgageBalance.trim().length > 0 &&
    creditScore.length > 0 &&
    dobOk &&
    token.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (phoneRequired && !phone.trim()) setSubmitError("Add your mobile number to opt into texts, or uncheck the box.");
      else if (dobTouched && !dobOk) setSubmitError("Please enter a valid date of birth — you must be 18 or older.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitCrmLead({
        loanType: config.loanType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        consent,
        consent_text: consent ? consentText : "",
        consent_version: CONSENT_VERSION,
        homeValue: homeValue.trim(),
        mortgageBalance: mortgageBalance.trim(),
        creditScore,
        dob: dobToMMDDYYYY(dobM, dobD, dobY),
        honeypot,
        pageLoadTime,
        turnstile_token: token,
      });
      if (result.success) {
        trackFbEvent("Lead", { content_name: config.loanType, content_category: "Mortgage" });
        track.formSubmit();
        setSubmitted(true);
      } else {
        setSubmitError(
          result.error ||
            "Something went wrong. Please text or call Mykoal directly at (480) 206 9290 and he will get right back to you.",
        );
        setIsSubmitting(false);
      }
    } catch {
      setSubmitError(
        "Something went wrong. Please text or call Mykoal directly at (480) 206 9290 and he will get right back to you.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title={config.meta.title}
        description={config.meta.description}
        canonical={config.route}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: config.serviceName,
          serviceType: config.serviceType,
          provider: { "@type": "FinancialService", name: "Adaxa Home LLC", url: "https://smartr8.com/" },
          description: config.meta.description,
          areaServed: LICENSED_STATES.map((name) => ({ "@type": "State", name })),
          url: `https://smartr8.com${config.route}`,
        }}
      />

      <Header />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-4 pt-10 pb-12 sm:pt-16 sm:pb-16" style={{ backgroundColor: CREAM }}>
          <div className="mx-auto max-w-3xl text-center">
            <span
              className="inline-flex items-center text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border"
              style={{ backgroundColor: "rgba(227,27,35,0.08)", color: BRAND_RED, borderColor: BRAND_RED }}
            >
              {config.eyebrow}
            </span>
            <h1 className="mt-4 text-3xl sm:text-5xl font-bold leading-tight" style={{ color: BRAND_TEAL }}>
              {config.h1}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed mx-auto max-w-2xl">
              {config.subhead}
            </p>
            <div className="mt-7">
              <Button
                type="button"
                onClick={() => { track.primaryCtaClick(); scrollToForm(); }}
                className="h-12 px-8 text-base shadow-lg rounded-xl border-0 hover:opacity-90"
                style={{ backgroundColor: BRAND_RED, color: "#FFFFFF" }}
              >
                {config.ctaLabel}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">No credit pull to see your options. No commitment.</p>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-2 max-w-xl mx-auto">
              {config.trustPills.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center text-center gap-1 py-3 px-2 rounded-xl border border-border bg-white"
                >
                  <Icon className="h-5 w-5" style={{ color: "#1F8A5F" }} />
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-5 sm:grid-cols-2">
              {config.benefits.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border p-6 bg-white">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: "rgba(227,27,35,0.08)" }}
                  >
                    <Icon className="h-6 w-6" style={{ color: BRAND_RED }} />
                  </div>
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: BRAND_TEAL }}>
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-4 py-12 sm:py-16" style={{ backgroundColor: CREAM }}>
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10" style={{ color: BRAND_TEAL }}>
              How it works
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {config.howSteps.map((step, i) => (
                <div key={step.title} className="text-center sm:text-left">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white mb-3 mx-auto sm:mx-0"
                    style={{ backgroundColor: BRAND_RED }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-bold mb-1.5" style={{ color: BRAND_TEAL }}>
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LEAD FORM */}
        <section id="lead-form" className="px-4 py-12 sm:py-16 scroll-mt-16">
          <div className="mx-auto max-w-xl">
            {submitted ? (
              <div className="rounded-2xl border border-border p-8 text-center bg-white">
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(31,138,95,0.12)" }}
                >
                  <Check className="h-7 w-7" style={{ color: "#1F8A5F" }} />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: BRAND_TEAL }}>
                  Thank you, {firstName.trim() || "and welcome"}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your request is in. Mykoal DeShazo will reach out shortly with your options. Need to talk sooner? Call
                  or text {""}
                  <a href="tel:4802069290" onClick={() => track.phoneClick()} className="font-semibold underline" style={{ color: BRAND_RED }}>
                    (480) 206 9290
                  </a>
                  .
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: BRAND_TEAL }}>
                    See your {config.eyebrow.toLowerCase()} options
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tell us where to send them. No spam. No credit pull.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Honeypot */}
                  <input
                    type="text"
                    name="website"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="off"
                    style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
                  />
                  {/* Hidden product tag */}
                  <input type="hidden" name="loanType" value={config.loanType} readOnly />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fn" className="text-sm">
                        First name
                      </Label>
                      <Input
                        id="fn"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        onFocus={handleFormStart}
                        placeholder="Jane"
                        className="h-12 text-base"
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ln" className="text-sm">
                        Last name
                      </Label>
                      <Input
                        id="ln"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="h-12 text-base"
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="h-12 text-base"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm">
                      Mobile phone {consent ? <span style={{ color: BRAND_RED }}>(required to text you)</span> : "(optional)"}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 555 5555"
                      className="h-12 text-base"
                      autoComplete="tel"
                      required={phoneRequired}
                    />
                  </div>

                  {/* Qualifying criteria — pre-fills the loan officer's quote panel in the CRM */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="home-value" className="text-sm">Estimated home value</Label>
                      <Input
                        id="home-value"
                        type="text"
                        inputMode="numeric"
                        value={homeValue}
                        onChange={(e) => setHomeValue(e.target.value)}
                        placeholder="$500,000"
                        className="h-12 text-base"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="mortgage-balance" className="text-sm">Mortgage balance</Label>
                      <Input
                        id="mortgage-balance"
                        type="text"
                        inputMode="numeric"
                        value={mortgageBalance}
                        onChange={(e) => setMortgageBalance(e.target.value)}
                        placeholder="$250,000"
                        className="h-12 text-base"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="credit-score" className="text-sm">Estimated credit score</Label>
                    <select
                      id="credit-score"
                      value={creditScore}
                      onChange={(e) => setCreditScore(e.target.value)}
                      className={SELECT_CLASS}
                      required
                    >
                      <option value="" disabled>Select a range</option>
                      {CREDIT_RANGES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      Date of birth <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-3">
                      <select aria-label="Birth month" value={dobM} onChange={(e) => setDobM(e.target.value)} className={SELECT_CLASS}>
                        <option value="">Month</option>
                        {DOB_MONTHS.map((m) => (
                          <option key={m.v} value={String(m.v)}>{m.label}</option>
                        ))}
                      </select>
                      <select aria-label="Birth day" value={dobD} onChange={(e) => setDobD(e.target.value)} className={SELECT_CLASS}>
                        <option value="">Day</option>
                        {DOB_DAY_OPTIONS.map((d) => (
                          <option key={d} value={String(d)}>{d}</option>
                        ))}
                      </select>
                      <select aria-label="Birth year" value={dobY} onChange={(e) => setDobY(e.target.value)} className={SELECT_CLASS}>
                        <option value="">Year</option>
                        {DOB_YEAR_OPTIONS.map((y) => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* OPTIONAL, UNCHECKED SMS consent with the verbatim disclosure */}
                  <div
                    className="flex items-start gap-3 p-4 rounded-xl border border-border"
                    style={{ backgroundColor: CREAM }}
                  >
                    <input
                      id="sms-consent"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                    />
                    <label htmlFor="sms-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      <span className="block font-semibold text-foreground mb-1">Text me about my inquiry (optional)</span>
                      {consentText}{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                        Privacy Policy
                      </a>{" "}
                      and{" "}
                      <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="underline">
                        Terms of Use
                      </a>
                      .
                    </label>
                  </div>

                  <div ref={widgetEl} aria-label="Bot check" />

                  {submitError && (
                    <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{submitError}</p>
                  )}

                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full h-12 text-base shadow-lg rounded-xl border-0 disabled:opacity-100 hover:opacity-90"
                    style={
                      canSubmit
                        ? { backgroundColor: BRAND_RED, color: "#FFFFFF" }
                        : { backgroundColor: "#94A3B8", color: "#FFFFFF" }
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      config.ctaLabel
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground leading-relaxed text-center">
                    By submitting, I ask Mykoal DeShazo and Adaxa Home to contact me about my inquiry using the
                    information I provided. The phone field is only needed if you opt into texts above.
                  </p>
                </form>
              </>
            )}

          </div>
        </section>

        {/* TRUST BLOCK — licensed guidance, no-obligation, secure data + NMLS/EHO */}
        <section className="px-4 pb-12 sm:pb-16">
          <TrustBlock />
        </section>

        {/* FAQ — collapsed by default, below the conversion path. Emits FAQPage
            schema that matches the visible text. */}
        {config.faqs && config.faqs.length > 0 && (
          <section className="px-4 py-12 sm:py-16" style={{ backgroundColor: CREAM }}>
            <FunnelFAQ items={config.faqs} guideLinks={config.faqGuideLinks} track={track} />

            {/* SECONDARY CTA — same destination as the primary (the lead form). */}
            <div className="mt-10 text-center">
              <Button
                type="button"
                onClick={() => { track.secondaryCtaClick(); scrollToForm(); }}
                className="h-12 px-8 text-base shadow-lg rounded-xl border-0 hover:opacity-90"
                style={{ backgroundColor: BRAND_RED, color: "#FFFFFF" }}
              >
                {config.secondaryCtaLabel ?? config.ctaLabel}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">No credit pull to see your options. No commitment.</p>
            </div>
          </section>
        )}
      </main>

      <ComplianceFooter showVaDisclaimer={config.vaDisclaimer} />
      <Footer />
    </div>
  );
}

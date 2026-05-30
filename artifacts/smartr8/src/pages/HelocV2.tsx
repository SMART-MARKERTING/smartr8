import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Check, ChevronDown, Loader2, Shield, Clock, TrendingUp } from "lucide-react";
import { submitLead } from "@/lib/submitLead";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import { saveRateContext } from "@/lib/rateEstimate";
import { useGA4 } from "@/hooks/useGA4";
import { trackFbEvent } from "@/lib/fbq";

// v2 treatment of the /heloc full funnel. Trimmed to 6 steps (address +
// home value + timeline removed) and unified to one brand-red selection
// language across single-select and (former) multi-select steps. DOB is
// a three-dropdown picker with 18+ validation. Only design + copy +
// tracking tag differ from the v1 control (/heloc), which is untouched.

const SESSION_KEY = "funnel_heloc_v2";
const TOTAL = 6;
const STEP_NAMES = [
  "name",
  "mortgage_balance",
  "heloc_purpose",
  "credit_score",
  "dob",
  "contact",
];
const FUNNEL_VERSION = "v2";

const MORTGAGE_RANGES = [
  "$0 to $100,000",
  "$100,000 to $200,000",
  "$200,000 to $300,000",
  "$300,000 to $400,000",
  "$400,000 to $500,000",
  "$500,000+",
];
const HELOC_PURPOSES = [
  "Home renovation or addition",
  "Pay off higher-interest debt",
  "Buy an investment property",
  "Business or self-employment cash",
  "Money set aside for emergencies",
  "Something else",
];
const CREDIT_RANGES = [
  "580 to 619",
  "620 to 659",
  "660 to 699",
  "700 to 739",
  "740 to 779",
  "780+",
  "Not sure",
];

const TRUST_PILLS = [
  { icon: Shield, label: "Soft credit only" },
  { icon: Clock, label: "Results in minutes" },
  { icon: TrendingUp, label: "99+ lender network" },
];

// Brand red used for selected option cards on every step (single-select).
// Matches the Continue CTA so the selection state and "next action"
// affordance share one visual language.
const SELECTED_RED = "#E31B23";
const SELECTED_BG = "rgba(227,27,35,0.06)";

// DOB picker: three <Select>s. Year range is 1925 down to (current year - 18)
// inclusive so the picker enforces the minimum-age rule at the option level
// in addition to the JS validator below.
const DOB_MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];
const DOB_MIN_YEAR = 1925;
const DOB_CURRENT_YEAR = new Date().getFullYear();
const DOB_MAX_YEAR = DOB_CURRENT_YEAR - 18;
const DOB_YEAR_OPTIONS: number[] = Array.from(
  { length: DOB_MAX_YEAR - DOB_MIN_YEAR + 1 },
  (_, i) => DOB_MAX_YEAR - i,
);
const DOB_DAY_OPTIONS: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

/** Validate the three DOB selects: real calendar date + 18+ at today. */
function validateDob(m: string, d: string, y: string): { ok: boolean; error?: string } {
  if (!m || !d || !y) return { ok: false };
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const year = parseInt(y, 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return { ok: false };
  }
  const dt = new Date(year, month - 1, day);
  // JavaScript silently rolls invalid dates forward (Feb 31 -> Mar 3, etc).
  // Reject if the round-trip doesn't match the input.
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return { ok: false, error: "Please enter a valid date." };
  }
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  if (dt > cutoff) {
    return { ok: false, error: "You must be at least 18 years old." };
  }
  return { ok: true };
}

type FS = {
  step: number;
  firstName: string;
  lastName: string;
  mortgageBalance: string;
  helocPurpose: string;
  creditScore: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  email: string;
  phone: string;
  honeypot: string;
  pageLoadTime: number;
};
const DEFAULT: FS = {
  step: 1,
  firstName: "",
  lastName: "",
  mortgageBalance: "",
  helocPurpose: "",
  creditScore: "",
  dobMonth: "",
  dobDay: "",
  dobYear: "",
  email: "",
  phone: "",
  honeypot: "",
  pageLoadTime: 0,
};

type ConsentState = {
  ready: boolean;
  consent: boolean;
  consent_version: string;
  consent_text: string;
  turnstile_token: string;
};
const EMPTY_CONSENT: ConsentState = {
  ready: false,
  consent: false,
  consent_version: "",
  consent_text: "",
  turnstile_token: "",
};

// Filled red circle with white check when selected; empty bordered circle
// when not. Shared across the funnel so single-select reads as one
// consistent selection language.
function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <div
      className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0"
      style={{
        backgroundColor: selected ? SELECTED_RED : "transparent",
        borderColor: selected ? SELECTED_RED : "rgba(0,0,0,0.25)",
      }}
    >
      {selected && <Check className="h-3 w-3 text-white" />}
    </div>
  );
}

function ChoiceCardV2({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center gap-3 min-h-[56px] cursor-pointer active:scale-[0.99]",
        selected ? "text-primary" : "border-border hover:border-primary/40 text-foreground",
      ].join(" ")}
      style={{
        backgroundColor: selected ? SELECTED_BG : "#F8F5F0",
        borderColor: selected ? SELECTED_RED : undefined,
      }}
    >
      <SelectionIndicator selected={selected} />
      <span className="flex-1">{label}</span>
    </button>
  );
}

export default function HelocV2() {
  const [, setLocation] = useLocation();
  const ga4 = useGA4("heloc");

  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_name: "HELOC",
      content_category: "Mortgage",
      variant: "A",
      funnel_version: FUNNEL_VERSION,
    });
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [consentState, setConsentState] = useState<ConsentState>(EMPTY_CONSENT);
  const [st, setSt] = useState<FS>(() => {
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (!s) return { ...DEFAULT, pageLoadTime: Date.now() };
      const saved = JSON.parse(s) as Partial<FS>;
      // Spread DEFAULT first so users returning from older layouts (which
      // saved address/homeValue/timeline/helocPurposes/dob string) end up
      // with the new field shape; their extra keys are ignored. Clamp step
      // into [1, TOTAL] so a saved step from a now-deleted slot doesn't
      // render blank.
      const step =
        typeof saved.step === "number" && saved.step >= 1 && saved.step <= TOTAL
          ? saved.step
          : 1;
      return {
        ...DEFAULT,
        ...saved,
        step,
        pageLoadTime: saved.pageLoadTime || Date.now(),
      };
    } catch {
      return { ...DEFAULT, pageLoadTime: Date.now() };
    }
  });

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(st));
  }, [st]);
  useEffect(() => {
    ga4.trackFunnelStart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Reset scroll to top on each step change so header/progress/question are
  // in view (steps render in one component, so there's no remount to do it).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [st.step]);

  const p = (patch: Partial<FS>) => setSt((prev) => ({ ...prev, ...patch }));
  const advance = () =>
    setSt((prev) => {
      ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step - 1]);
      return { ...prev, step: prev.step + 1 };
    });
  const back = () => setSt((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  const autoAdvance = (patch: Partial<FS>) => {
    setSt((prev) => ({ ...prev, ...patch }));
    setTimeout(
      () =>
        setSt((prev) => {
          ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step - 1]);
          return { ...prev, step: prev.step + 1 };
        }),
      380,
    );
  };

  // DOB validation runs every render off current state. Error only surfaces
  // when the user has selected all three dropdowns AND the combination is
  // invalid; incomplete state simply keeps Continue disabled with no error.
  const dobValidation = validateDob(st.dobMonth, st.dobDay, st.dobYear);
  const dobError = dobValidation.error ?? null;

  const SUBMIT_ERR =
    "Something went wrong with your submission. Please text or call Myke directly at (480) 206-9290 and he will get back to you within minutes.";
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!st.email) {
      setSubmitError("Please enter your email.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    const dob =
      st.dobYear && st.dobMonth && st.dobDay
        ? `${st.dobYear}-${st.dobMonth.padStart(2, "0")}-${st.dobDay.padStart(2, "0")}`
        : "";
    try {
      const result = await submitLead({
        funnel: "heloc",
        firstName: st.firstName,
        lastName: st.lastName,
        email: st.email,
        phone: st.phone,
        mortgageBalance: st.mortgageBalance,
        creditScore: st.creditScore,
        dob,
        honeypot: st.honeypot,
        pageLoadTime: st.pageLoadTime,
        turnstile_token: consentState.turnstile_token,
        consent: consentState.consent,
        consent_version: consentState.consent_version,
        consent_text: consentState.consent_text,
        additionalFields: {
          helocPurpose: st.helocPurpose,
          variant: "A",
          funnel_version: FUNNEL_VERSION,
        },
      });
      if (result.success) {
        // Lead fires here on submit (v2 routes straight to next-step-v2 and
        // skips /heloc/whats-next, where the control funnel fires it).
        trackFbEvent("Lead", {
          content_name: "HELOC",
          content_category: "Mortgage",
          variant: "A",
          funnel_version: FUNNEL_VERSION,
          funnel_length: "long",
        });
        ga4.trackLead({ variant: "A", funnel_version: FUNNEL_VERSION, funnel_length: "long" });
        saveRateContext({ creditScore: st.creditScore, funnel: "heloc" });
        sessionStorage.removeItem(SESSION_KEY);
        const params = new URLSearchParams({
          name: st.firstName,
          credit: st.creditScore,
          use: st.helocPurpose,
          v: "A",
        });
        setLocation(`/heloc/next-step-v2?${params.toString()}`);
      } else {
        setSubmitError(result.error || SUBMIT_ERR);
        setIsSubmitting(false);
      }
    } catch {
      setSubmitError(SUBMIT_ERR);
      setIsSubmitting(false);
    }
  };

  // Primary CTA for the current step (drives both inline desktop button
  // and mobile sticky bar). Auto-advance steps return null. Step map:
  //   1 name  ·  2 mortgage  ·  3 purpose  ·  4 credit
  //   5 dob   ·  6 contact
  type Cta = { label: string; disabled: boolean; submit?: boolean; onClick?: () => void };
  const cta: Cta | null = (() => {
    switch (st.step) {
      case 1:
        return {
          label: "Continue",
          disabled: !st.firstName.trim() || !st.lastName.trim(),
          onClick: advance,
        };
      case 5:
        return { label: "Continue", disabled: !dobValidation.ok, onClick: advance };
      case 6:
        return {
          label: isSubmitting ? "Submitting..." : "Get My HELOC Options",
          disabled: isSubmitting || !st.email || !consentState.ready,
          submit: true,
        };
      default:
        return null;
    }
  })();

  const progress = Math.round((st.step / TOTAL) * 100);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="HELOC Options | Mykoal DeShazo at Adaxa Home"
        description="Tap your home equity with a HELOC from Mykoal DeShazo, Senior Loan Officer at Adaxa Home. No credit pull to see your options. NMLS #1912347."
        canonical="/heloc-v2"
        noIndex
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "HELOC (Home Equity Line of Credit)",
          serviceType: "Home Equity Line of Credit",
          provider: { "@type": "FinancialService", name: "Adaxa Home LLC", url: "https://smartr8.com/" },
          description:
            "Tap your home equity with a HELOC from Mykoal DeShazo at Adaxa Home. No credit pull required to see your options. NMLS #1912347.",
          areaServed: [
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
          ].map((name) => ({ "@type": "State", name })),
          url: "https://smartr8.com/heloc-v2",
        }}
      />

      <Header />

      {/* Progress + back */}
      <div className="sticky top-12 z-30 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-2.5 max-w-xl mx-auto w-full">
          <div className="w-14 flex items-start">
            {st.step > 1 && (
              <button
                type="button"
                onClick={back}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                aria-label="Go back to the previous step"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
          </div>
          <div
            className="flex-1"
            role="progressbar"
            aria-valuenow={st.step}
            aria-valuemin={1}
            aria-valuemax={TOTAL}
            aria-label={`Step ${st.step} of ${TOTAL}`}
          >
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>
                Step {st.step} of {TOTAL}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 rounded-full" />
          </div>
          <div className="w-14" />
        </div>
      </div>

      <main className="flex-1 px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-xl pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-0">
          {/* STEP 1: name */}
          {st.step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-4">
              <div className="space-y-2 text-center">
                <span
                  className="inline-flex items-center text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: "rgba(227,27,35,0.08)",
                    color: "#E31B23",
                    borderColor: "#E31B23",
                  }}
                >
                  HELOC Options
                </span>
                <h1 className="text-xl sm:text-3xl font-bold text-primary leading-tight">
                  Tap your equity without touching your mortgage rate
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-snug">
                  Use your home equity for debt, home improvement, or big expenses, without refinancing your first mortgage. See what you qualify for in minutes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TRUST_PILLS.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center text-center gap-1 py-2 px-2 rounded-xl border border-border"
                    style={{ backgroundColor: "#F8F5F0" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "#1F8A5F" }} />
                    <span className="text-[10px] sm:text-xs font-semibold text-foreground leading-tight">{label}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="fn" className="text-sm">First Name</Label>
                  <Input
                    id="fn"
                    placeholder="Jane"
                    value={st.firstName}
                    onChange={(e) => p({ firstName: e.target.value })}
                    className="h-12 text-base focus-visible:!border-[#E31B23] focus-visible:!ring-[#E31B23]/40"
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ln" className="text-sm">Last Name</Label>
                  <Input
                    id="ln"
                    placeholder="Doe"
                    value={st.lastName}
                    onChange={(e) => p({ lastName: e.target.value })}
                    className="h-12 text-base focus-visible:!border-[#E31B23] focus-visible:!ring-[#E31B23]/40"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: mortgage balance (single-select auto-advance) */}
          {st.step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">How much is left on your mortgage?</h1>
              <p className="text-base text-muted-foreground mb-6">An estimate works.</p>
              <div className="flex flex-col gap-2.5">
                {MORTGAGE_RANGES.map((opt) => (
                  <ChoiceCardV2
                    key={opt}
                    label={opt}
                    selected={st.mortgageBalance === opt}
                    onClick={() => autoAdvance({ mortgageBalance: opt })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: purpose (single-select auto-advance) */}
          {st.step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What would you use the funds for?</h1>
              <p className="text-base text-muted-foreground mb-6">Pick the main one.</p>
              <div className="flex flex-col gap-2.5">
                {HELOC_PURPOSES.map((opt) => (
                  <ChoiceCardV2
                    key={opt}
                    label={opt}
                    selected={st.helocPurpose === opt}
                    onClick={() => autoAdvance({ helocPurpose: opt })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: credit */}
          {st.step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Roughly where's your credit?</h1>
              <p className="text-base text-muted-foreground mb-6">
                Checking your options won't affect your credit. A full review only happens if you decide to move forward.
              </p>
              <div className="flex flex-col gap-2.5">
                {CREDIT_RANGES.map((opt) => (
                  <ChoiceCardV2
                    key={opt}
                    label={opt}
                    selected={st.creditScore === opt}
                    onClick={() => autoAdvance({ creditScore: opt })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: dob (three dropdowns) */}
          {st.step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What's your date of birth?</h1>
              <p className="text-base text-muted-foreground mb-6">
                Lenders need this to check what you qualify for. You must be at least 18.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dob-month" className="text-sm">Month</Label>
                  <div className="relative">
                    <select
                      id="dob-month"
                      value={st.dobMonth}
                      onChange={(e) => p({ dobMonth: e.target.value })}
                      className="h-12 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="" disabled>Month</option>
                      {DOB_MONTHS.map(({ value, label }) => (
                        <option key={value} value={String(value)}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob-day" className="text-sm">Day</Label>
                  <div className="relative">
                    <select
                      id="dob-day"
                      value={st.dobDay}
                      onChange={(e) => p({ dobDay: e.target.value })}
                      className="h-12 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="" disabled>Day</option>
                      {DOB_DAY_OPTIONS.map((d) => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob-year" className="text-sm">Year</Label>
                  <div className="relative">
                    <select
                      id="dob-year"
                      value={st.dobYear}
                      onChange={(e) => p({ dobYear: e.target.value })}
                      className="h-12 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="" disabled>Year</option>
                      {DOB_YEAR_OPTIONS.map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
              {dobError && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg mt-3">{dobError}</p>
              )}
            </div>
          )}

          {/* STEP 6: contact */}
          {st.step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Where should I send your options?</h1>
              <p className="text-base text-muted-foreground mb-6">No spam. No credit pull. Real options within hours.</p>
              <form id="heloc-v2-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                  type="text"
                  name="website"
                  value={st.honeypot}
                  onChange={(e) => p({ honeypot: e.target.value })}
                  tabIndex={-1}
                  aria-hidden="true"
                  autoComplete="off"
                  style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@example.com"
                    value={st.email}
                    onChange={(e) => p({ email: e.target.value })}
                    className="h-12 text-base"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm">Mobile Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={st.phone}
                    onChange={(e) => p({ phone: e.target.value })}
                    className="h-12 text-base"
                    autoComplete="tel"
                  />
                </div>
                <TcpaConsent onChange={setConsentState} />
                {submitError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{submitError}</p>}
              </form>
            </div>
          )}

          {/* Desktop inline CTA */}
          {cta && (
            <div className="hidden sm:block pt-6">
              <Button
                type={cta.submit ? "submit" : "button"}
                form={cta.submit ? "heloc-v2-form" : undefined}
                onClick={cta.onClick}
                disabled={cta.disabled}
                className="w-full h-12 text-base shadow-lg rounded-xl border-0 disabled:opacity-100 hover:opacity-90"
                style={
                  cta.disabled
                    ? { backgroundColor: "#94A3B8", color: "#FFFFFF" }
                    : { backgroundColor: "#E31B23", color: "#FFFFFF" }
                }
              >
                {isSubmitting && st.step === 6 ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...
                  </>
                ) : (
                  cta.label
                )}
              </Button>
              {st.step === 6 && <p className="text-center text-xs text-muted-foreground mt-3">No credit pull. No commitment.</p>}
              {st.step === 6 && <TcpaSubmitNotice />}
            </div>
          )}
        </div>
      </main>

      {/* Mobile sticky CTA */}
      {cta && (
        <div
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="px-4 pt-3">
            <Button
              type={cta.submit ? "submit" : "button"}
              form={cta.submit ? "heloc-v2-form" : undefined}
              onClick={cta.onClick}
              disabled={cta.disabled}
              className="w-full h-12 text-base shadow-lg rounded-xl border-0 disabled:opacity-100 hover:opacity-90"
              style={
                cta.disabled
                  ? { backgroundColor: "#94A3B8", color: "#FFFFFF" }
                  : { backgroundColor: "#E31B23", color: "#FFFFFF" }
              }
            >
              {isSubmitting && st.step === 6 ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...
                </>
              ) : (
                cta.label
              )}
            </Button>
            {st.step === 6 && <p className="text-center text-xs text-muted-foreground mt-1.5">No credit pull. No commitment.</p>}
            {st.step === 6 && <TcpaSubmitNotice />}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

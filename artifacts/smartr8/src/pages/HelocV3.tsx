import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  DollarSign,
  GraduationCap,
  Home,
  Info,
  Lock,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import { submitLead } from "@/lib/submitLead";
import { sendAutoQuote } from "@/lib/autoQuote";
import { saveRateContext } from "@/lib/rateEstimate";
import { useGA4 } from "@/hooks/useGA4";
import { trackFbEvent } from "@/lib/fbq";
import "./helocV3.css";

// ============================================================================
// HELOC v3 — the "elevated" Adaxa funnel.
//
// A premium, single-route funnel: four question steps, opening directly on
// step one (no hero landing). Submitting "About you" hands off straight to
// the external application (no inline recommendation screen). The bespoke
// teal/red/cream visual system lives in ./helocV3.css (scoped under
// .heloc-v3) and renders in the real brand fonts (Bricolage Grotesque
// display + Plus Jakarta Sans body, self-hosted under /public/fonts).
// Chrome is the shared <Header/>/<Footer/>.
//
// Production wiring matches /heloc-v2: a single submitLead() POST on the
// "About you" step, gated by Cloudflare Turnstile (via <TcpaConsent/>), with
// GA4 + Meta Pixel Lead/ViewContent tracking and rate-context persistence.
// State persists in sessionStorage (project rule — never localStorage).
// ============================================================================

const SESSION_KEY = "funnel_heloc_v3";
const FUNNEL_VERSION = "v3";

// Fast Digital Path application destination — same target the v2 next-step
// page redirects to. Defined here so the result CTA can be retargeted in one
// place. Inbound query params (utm_*, etc.) are merged in without clobbering
// the baked-in referrer.
const APPLICATION_URL =
  "https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7";

function buildApplicationUrl(): string {
  try {
    const url = new URL(APPLICATION_URL);
    const incoming = new URLSearchParams(window.location.search);
    incoming.forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    return url.toString();
  } catch {
    return APPLICATION_URL;
  }
}

// ---- Step content -----------------------------------------------------------
const STEP_LABELS = ["Mortgage", "Goal", "Credit", "About you"];

// Single-select steps (Goal, Credit) auto-advance on tap; this brief pause lets
// the chosen card show as selected before the funnel moves to the next step.
const AUTO_ADVANCE_MS = 180;

type GoalDef = { id: string; icon: typeof DollarSign; title: string; sub: string };
const GOALS: GoalDef[] = [
  { id: "debt", icon: DollarSign, title: "Pay off debt", sub: "Consolidate higher-rate balances" },
  { id: "reno", icon: Home, title: "Home improvement", sub: "Renovate, repair, or expand" },
  { id: "cash", icon: PiggyBank, title: "Cash reserve", sub: "A safety cushion on hand" },
  { id: "big", icon: GraduationCap, title: "Big expense", sub: "Tuition, medical, life events" },
];

type CreditDef = { id: string; title: string; sub: string };
const CREDIT: CreditDef[] = [
  { id: "excellent", title: "Excellent", sub: "740+" },
  { id: "good", title: "Good", sub: "680–739" },
  { id: "fair", title: "Fair", sub: "620–679" },
  { id: "building", title: "Still building", sub: "Below 620" },
  { id: "unsure", title: "Not sure", sub: "That's okay" },
];

/** Readable label sent to the CRM (the id alone is meaningless to Mykoal). */
function creditLabel(id: string): string {
  const c = CREDIT.find((x) => x.id === id);
  return c ? `${c.title} (${c.sub})` : "";
}
function goalLabel(id: string): string {
  const g = GOALS.find((x) => x.id === id);
  return g ? g.title : "";
}

// ---- Funnel state -----------------------------------------------------------
type Stage = "s0" | "s1" | "s2" | "s3";
type Data = {
  homeValue: string;
  balance: string;
  goal: string;
  credit: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  honeypot: string;
  pageLoadTime: number;
};
const DEFAULT_DATA: Data = {
  homeValue: "",
  balance: "",
  goal: "",
  credit: "",
  first: "",
  last: "",
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

// ============================================================================
// Shared funnel primitives (ported from the Adaxa design, lucide icons)
// ============================================================================
function Progress({ current, total = 4 }: { current: number; total?: number }) {
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div className="progress">
      <div className="progress-head">
        <span className="s">
          Step {current + 1} of {total}
        </span>
        <span className="p">{pct}%</span>
      </div>
      <div className="p-steps">
        {STEP_LABELS.map((l, i) => (
          <div key={l} className={"p-st " + (i < current ? "done" : i === current ? "now" : "")}>
            <i></i>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepHead({ eyebrow, title, help }: { eyebrow?: string; title: string; help?: string }) {
  return (
    <div>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="q-title">{title}</h2>
      {help && <p className="q-help">{help}</p>}
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon?: typeof DollarSign;
  title: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={"opt" + (selected ? " sel" : "")} onClick={onClick}>
      {Icon && (
        <span className="oic">
          <Icon size={22} />
        </span>
      )}
      <span className="otxt">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      <span className="chk">
        <Check size={13} strokeWidth={3.4} />
      </span>
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className={"field" + (error ? " err" : "")}>
      {label && <label>{label}</label>}
      {children}
      {error ? (
        <span className="errmsg">
          <AlertTriangle size={13} /> {error}
        </span>
      ) : (
        hint && <span className="hint">{hint}</span>
      )}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fmt = (v: string) => {
    const n = (v || "").replace(/[^\d]/g, "");
    return n ? Number(n).toLocaleString("en-US") : "";
  };
  return (
    <div className="adorn">
      <span className="pre">$</span>
      <input
        inputMode="numeric"
        value={fmt(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      />
    </div>
  );
}

function Reassure({
  icon = "lock",
  title,
  children,
}: {
  icon?: "lock" | "info" | "shield";
  title: string;
  children?: ReactNode;
}) {
  const Icon = icon === "info" ? Info : icon === "shield" ? ShieldCheck : Lock;
  return (
    <div className="reassure">
      <Icon size={18} />
      <div>
        <b>{title}</b>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextLabel = "Continue",
  disabled,
  under,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  disabled?: boolean;
  under?: string;
}) {
  return (
    <>
      <div className="nav-row">
        {onBack && (
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <ArrowLeft size={17} /> Back
          </button>
        )}
        {onNext && (
          <button type="button" className="btn btn-primary" disabled={disabled} onClick={onNext}>
            {nextLabel} <ArrowRight size={18} />
          </button>
        )}
      </div>
      {under && <p className="under-cta">{under}</p>}
    </>
  );
}

// ============================================================================
// Screens
// ============================================================================
type StepProps = {
  data: Data;
  set: (patch: Partial<Data>) => void;
  onNext: () => void;
  onBack?: () => void;
};

function StepBalance({ data, set, onNext, onBack }: StepProps) {
  return (
    <div className="step">
      <Progress current={0} />
      <StepHead
        eyebrow="Your home"
        title="How much is left on your mortgage?"
        help="An estimate is fine — you can refine it later."
      />
      <div className="q-body">
        <Field label="Estimated home value" hint="Roughly what your home is worth today.">
          <MoneyInput value={data.homeValue} onChange={(v) => set({ homeValue: v })} placeholder="500,000" />
        </Field>
        <Field label="Current mortgage balance" hint="What you still owe on your first mortgage.">
          <MoneyInput value={data.balance} onChange={(v) => set({ balance: v })} placeholder="350,000" />
        </Field>
        <Reassure icon="info" title="Why we ask">
          Your equity is the gap between these two numbers — it's what you may be able to tap.
        </Reassure>
        <NavRow
          onBack={onBack}
          onNext={onNext}
          disabled={!data.balance || !data.homeValue}
          under="This won't affect your credit score."
        />
      </div>
    </div>
  );
}

function StepGoal({ data, set, onNext, onBack }: StepProps) {
  // Single-select: picking an option records it and auto-advances (no Continue
  // button). A brief delay lets the selected card register visually first.
  const choose = (goal: string) => {
    set({ goal });
    window.setTimeout(onNext, AUTO_ADVANCE_MS);
  };
  return (
    <div className="step">
      <Progress current={1} />
      <StepHead
        eyebrow="Your goal"
        title="What would you put the funds toward?"
        help="Pick the main one — it helps Mykoal match the right option."
      />
      <div className="q-body">
        <div className="opts cols-2">
          {GOALS.map((g) => (
            <OptionCard
              key={g.id}
              icon={g.icon}
              title={g.title}
              sub={g.sub}
              selected={data.goal === g.id}
              onClick={() => choose(g.id)}
            />
          ))}
        </div>
        <NavRow onBack={onBack} />
      </div>
    </div>
  );
}

function StepCredit({ data, set, onNext, onBack }: StepProps) {
  // Single-select: picking a credit band auto-advances (no Continue button).
  const choose = (credit: string) => {
    set({ credit });
    window.setTimeout(onNext, AUTO_ADVANCE_MS);
  };
  return (
    <div className="step">
      <Progress current={2} />
      <StepHead
        eyebrow="Your credit"
        title="Roughly where's your credit?"
        help="A ballpark is all we need right now."
      />
      <div className="q-body">
        <div className="opts">
          {CREDIT.map((c) => (
            <OptionCard
              key={c.id}
              title={c.title}
              sub={c.sub}
              selected={data.credit === c.id}
              onClick={() => choose(c.id)}
            />
          ))}
        </div>
        <Reassure icon="shield" title="Checking your options won't affect your credit">
          A full credit review only happens if you decide to move forward.
        </Reassure>
        <NavRow onBack={onBack} />
      </div>
    </div>
  );
}

function StepAbout({
  data,
  set,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
  consentState,
  setConsentState,
}: {
  data: Data;
  set: (patch: Partial<Data>) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string;
  consentState: ConsentState;
  setConsentState: (s: ConsentState) => void;
}) {
  const { first, last, email, phone } = data;
  const emailOk = /\S+@\S+\.\S+/.test(email || "");
  const ready =
    !!first &&
    !!last &&
    emailOk &&
    (phone || "").replace(/\D/g, "").length >= 10 &&
    consentState.ready;

  return (
    <div className="step">
      <Progress current={3} />
      <StepHead
        eyebrow="About you"
        title="Almost done — where should we send your options?"
        help="Mykoal personally reviews every submission."
      />
      <form
        className="q-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !isSubmitting) onSubmit();
        }}
      >
        {/* Honeypot — bots fill this; humans never see it. */}
        <input
          type="text"
          name="website"
          value={data.honeypot}
          onChange={(e) => set({ honeypot: e.target.value })}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
        />
        <div className="grid2">
          <Field label="First name">
            <input
              className="inp"
              value={first}
              placeholder="Jane"
              autoComplete="given-name"
              onChange={(e) => set({ first: e.target.value })}
            />
          </Field>
          <Field label="Last name">
            <input
              className="inp"
              value={last}
              placeholder="Doe"
              autoComplete="family-name"
              onChange={(e) => set({ last: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Email" error={email && !emailOk ? "Enter a valid email address." : null}>
          <input
            className="inp"
            type="email"
            value={email}
            placeholder="jane@example.com"
            autoComplete="email"
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>
        <Field label="Mobile phone" hint="So Mykoal can text you your options.">
          <input
            className="inp"
            type="tel"
            value={phone}
            placeholder="(480) 555-0199"
            autoComplete="tel"
            onChange={(e) => set({ phone: e.target.value })}
          />
        </Field>
        <Reassure icon="lock" title="Your info stays private">
          We use bank-level encryption and only use your details to review your options. We never
          sell your info or spam you.
        </Reassure>
        <TcpaConsent onChange={setConsentState} />
        {submitError && (
          <div className="reassure" style={{ background: "var(--red-50)", color: "var(--red-700)" }}>
            <AlertTriangle size={18} />
            <div>
              <b>{submitError}</b>
            </div>
          </div>
        )}
        <NavRow
          onBack={onBack}
          onNext={() => {
            if (ready && !isSubmitting) onSubmit();
          }}
          disabled={!ready || isSubmitting}
          nextLabel={isSubmitting ? "Submitting…" : "See My Options"}
          under="No cost · No obligation · Soft credit review only"
        />
        <TcpaSubmitNotice />
      </form>
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================
export default function HelocV3() {
  const ga4 = useGA4("heloc");

  const [stage, setStage] = useState<Stage>("s0");
  const [data, setData] = useState<Data>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return { ...DEFAULT_DATA, pageLoadTime: Date.now() };
      const saved = JSON.parse(raw) as Partial<Data>;
      return { ...DEFAULT_DATA, ...saved, pageLoadTime: saved.pageLoadTime || Date.now() };
    } catch {
      return { ...DEFAULT_DATA, pageLoadTime: Date.now() };
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [consentState, setConsentState] = useState<ConsentState>(EMPTY_CONSENT);

  // ViewContent + funnel_start once on mount.
  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_name: "HELOC",
      content_category: "Mortgage",
      funnel_version: FUNNEL_VERSION,
    });
    ga4.trackFunnelStart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }, [data]);

  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));
  const go = (s: Stage) => {
    setStage(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Stage index for GA4 step-completed tracking (1-based question steps).
  const STAGE_STEP: Record<string, { n: number; name: string }> = {
    s0: { n: 1, name: "mortgage_balance" },
    s1: { n: 2, name: "heloc_purpose" },
    s2: { n: 3, name: "credit_score" },
    s3: { n: 4, name: "about_you" },
  };
  const advanceFrom = (from: Stage, to: Stage) => {
    const meta = STAGE_STEP[from];
    if (meta) ga4.trackStepCompleted(meta.n, meta.name);
    go(to);
  };

  const SUBMIT_ERR =
    "Something went wrong with your submission. Please text or call Mykoal directly at (480) 206-9290 and he'll get back to you within minutes.";

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const result = await submitLead({
        funnel: "heloc",
        firstName: data.first,
        lastName: data.last,
        email: data.email,
        phone: data.phone,
        homeValue: data.homeValue,
        mortgageBalance: data.balance,
        creditScore: creditLabel(data.credit),
        honeypot: data.honeypot,
        pageLoadTime: data.pageLoadTime,
        turnstile_token: consentState.turnstile_token,
        consent: consentState.consent,
        consent_version: consentState.consent_version,
        consent_text: consentState.consent_text,
        additionalFields: {
          helocPurpose: goalLabel(data.goal),
          funnel_version: FUNNEL_VERSION,
        },
      });
      if (result.success) {
        trackFbEvent("Lead", {
          content_name: "HELOC",
          content_category: "Mortgage",
          funnel_version: FUNNEL_VERSION,
          funnel_length: "long",
        });
        ga4.trackStepCompleted(4, "about_you");
        ga4.trackLead({ funnel_version: FUNNEL_VERSION, funnel_length: "long" });
        saveRateContext({ creditScore: creditLabel(data.credit), funnel: "heloc" });
        // Fire-and-forget: email the client their estimated quote (HELOC at
        // 90% LTV + cash-out refi at 80%) and BCC Mykoal. Never blocks the
        // result screen — the lead is already captured if this fails.
        void sendAutoQuote({
          firstName: data.first,
          lastName: data.last,
          email: data.email,
          homeValue: data.homeValue,
          balance: data.balance,
          creditId: data.credit,
        });
        // Straight to the external application — no inline options screen.
        // isSubmitting stays true so the CTA can't double-fire during the
        // hand-off.
        trackFbEvent("SubmitApplication", {
          content_name: "HELOC Application",
          content_category: "Mortgage",
          funnel_version: FUNNEL_VERSION,
        });
        window.location.href = buildApplicationUrl();
      } else {
        setSubmitError(result.error || SUBMIT_ERR);
        setIsSubmitting(false);
      }
    } catch {
      setSubmitError(SUBMIT_ERR);
      setIsSubmitting(false);
    }
  }

  let screen: ReactNode;
  if (stage === "s0") {
    screen = (
      <div className="funnel-wrap">
        <StepBalance data={data} set={set} onNext={() => advanceFrom("s0", "s1")} />
      </div>
    );
  } else if (stage === "s1") {
    screen = (
      <div className="funnel-wrap">
        <StepGoal data={data} set={set} onBack={() => go("s0")} onNext={() => advanceFrom("s1", "s2")} />
      </div>
    );
  } else if (stage === "s2") {
    screen = (
      <div className="funnel-wrap">
        <StepCredit data={data} set={set} onBack={() => go("s1")} onNext={() => advanceFrom("s2", "s3")} />
      </div>
    );
  } else {
    screen = (
      <div className="funnel-wrap">
        <StepAbout
          data={data}
          set={set}
          onBack={() => go("s2")}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
          consentState={consentState}
          setConsentState={setConsentState}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="HELOC Options | Mykoal DeShazo at Adaxa Home"
        description="See what your home equity could unlock with a HELOC from Mykoal DeShazo, Senior Loan Officer at Adaxa Home. Soft credit review only to see your options. NMLS #1912347."
        canonical="/heloc-v3"
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
            "See what your home equity could unlock with a HELOC from Mykoal DeShazo at Adaxa Home. Soft credit review only to see your options. NMLS #1912347.",
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
          url: "https://smartr8.com/heloc-v3",
        }}
      />

      <Header />

      <div className="heloc-v3 flex-1 flex flex-col">
        <main className="main">{screen}</main>
      </div>

      <Footer />
    </div>
  );
}

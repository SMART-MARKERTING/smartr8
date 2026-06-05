import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  GraduationCap,
  Home,
  Info,
  Lock,
  MessageSquare,
  Phone,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  User,
} from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import { submitLead } from "@/lib/submitLead";
import { sendAutoQuote, computeQuoteNumbers } from "@/lib/autoQuote";
import { saveRateContext } from "@/lib/rateEstimate";
import { useGA4 } from "@/hooks/useGA4";
import { trackFbEvent } from "@/lib/fbq";
import "./helocV3.css";

// ============================================================================
// HELOC v3 — the "elevated" Adaxa funnel.
//
// A premium, single-route funnel: hero landing → four question steps → an
// inline recommendation payoff screen. The bespoke teal/red/cream visual
// system lives in ./helocV3.css (scoped under .heloc-v3) and renders in the
// real brand fonts (Bricolage Grotesque display + Plus Jakarta Sans body,
// self-hosted under /public/fonts). Chrome is the shared <Header/>/<Footer/>.
//
// Production wiring matches /heloc-v2: a single submitLead() POST on the
// "About you" step, gated by Cloudflare Turnstile (via <TcpaConsent/>), with
// GA4 + Meta Pixel Lead/ViewContent tracking and rate-context persistence.
// State persists in sessionStorage (project rule — never localStorage).
// ============================================================================

const SESSION_KEY = "funnel_heloc_v3";
const FUNNEL_VERSION = "v3";
const PHONE = "4802069290";
const CAL_URL = "https://cal.com/mykoal-deshazo/consult";

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
const STEP_LABELS = ["Mortgage", "Goal", "Credit", "About you", "Options"];

// Single-select steps (Goal, Credit) auto-advance on tap; this brief pause lets
// the chosen card show as selected before the funnel moves to the next step.
const AUTO_ADVANCE_MS = 180;

// End-of-funnel: the Options/Result screen auto-hands off to the application
// after this pause, mirroring the v2 next-step page. The CTA stays as a manual
// fallback.
const RESULT_REDIRECT_MS = 1500;

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
type Stage = "hero" | "s0" | "s1" | "s2" | "s3" | "result";
type Data = {
  homeValue: string;
  balance: string;
  goal: string;
  credit: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  mm: string;
  dd: string;
  yyyy: string;
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
  mm: "",
  dd: "",
  yyyy: "",
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

/** Validate the three DOB text inputs: real calendar date + 18+ at today. */
function validateDob(mm: string, dd: string, yyyy: string): { ok: boolean; error?: string } {
  if (!mm || !dd || yyyy.length !== 4) return { ok: false };
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  const year = parseInt(yyyy, 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return { ok: false };
  }
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return { ok: false, error: "Please enter a valid date." };
  }
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  if (dt > cutoff) return { ok: false, error: "You must be at least 18 years old." };
  return { ok: true };
}

// ============================================================================
// Shared funnel primitives (ported from the Adaxa design, lucide icons)
// ============================================================================
function Progress({ current, total = 5 }: { current: number; total?: number }) {
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

function TrustBar() {
  return (
    <div className="trustbar">
      <div className="ti">
        <ShieldCheck size={17} /> Soft credit only
      </div>
      <div className="sep"></div>
      <div className="ti">
        <Clock size={17} /> Results in minutes
      </div>
      <div className="sep"></div>
      <div className="ti">
        <Lock size={17} /> Bank-level encryption
      </div>
      <div className="sep"></div>
      <div className="ti">
        <User size={17} /> Reviewed by a licensed LO
      </div>
    </div>
  );
}

// ============================================================================
// Screens
// ============================================================================
function Hero({ onStart }: { onStart: () => void }) {
  return (
    <div className="wide-wrap" style={{ paddingTop: 40, paddingBottom: 20 }}>
      <div className="hero">
        <div className="hero-grid">
          <div className="hero-left">
            <span className="hero-eyebrow">
              <span className="dot"></span> HELOC &amp; home-equity options
            </span>
            <h1>
              See what your equity could <span className="accent">unlock</span>.
            </h1>
            <p className="hero-sub">
              Check your options without touching your mortgage rate. Soft credit review only — no
              obligation, no pressure.
            </p>
            <div className="hero-chips">
              <span className="hero-chip">
                <ShieldCheck size={15} /> Soft credit only
              </span>
              <span className="hero-chip">
                <Clock size={15} /> Under 2 minutes
              </span>
              <span className="hero-chip">
                <User size={15} /> Reviewed by Mykoal
              </span>
            </div>
          </div>
          <div className="hero-right">
            <div className="start-card">
              <h3>Start your free equity review</h3>
              <p className="sc-sub">Most people finish in under 2 minutes.</p>
              <div className="estimate">
                <div>
                  <div className="lbl">Homeowners like you unlock</div>
                  <div className="val">$40k–$150k+</div>
                </div>
                <TrendingUp size={26} strokeWidth={1.8} />
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
                See My Options <ArrowRight size={18} />
              </button>
              <p className="under-cta">No cost · No obligation · No credit pull</p>
              <div className="start-officer">
                <div className="av">MD</div>
                <div className="meta">
                  <b>Reviewed by Mykoal, a licensed loan officer</b>
                  <span>Your info stays private. We never sell it.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <TrustBar />
    </div>
  );
}

type StepProps = {
  data: Data;
  set: (patch: Partial<Data>) => void;
  onNext: () => void;
  onBack: () => void;
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
  const { first, last, email, phone, mm, dd, yyyy } = data;
  const emailOk = /\S+@\S+\.\S+/.test(email || "");
  const dobValidation = validateDob(mm, dd, yyyy);
  const dobError = dobValidation.error ?? null;
  const ready =
    !!first &&
    !!last &&
    emailOk &&
    (phone || "").replace(/\D/g, "").length >= 10 &&
    dobValidation.ok &&
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
        <Field
          label="Date of birth"
          error={dobError}
          hint="Required by lenders to check your options accurately."
        >
          <div className="dob-row">
            <input
              className="inp"
              maxLength={2}
              inputMode="numeric"
              value={mm}
              placeholder="MM"
              onChange={(e) => set({ mm: e.target.value.replace(/\D/g, "") })}
            />
            <input
              className="inp"
              maxLength={2}
              inputMode="numeric"
              value={dd}
              placeholder="DD"
              onChange={(e) => set({ dd: e.target.value.replace(/\D/g, "") })}
            />
            <input
              className="inp"
              maxLength={4}
              inputMode="numeric"
              value={yyyy}
              placeholder="YYYY"
              onChange={(e) => set({ yyyy: e.target.value.replace(/\D/g, "") })}
            />
          </div>
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

function Result({ data, onRestart }: { data: Data; onRestart: () => void }) {
  // Mirror the emailed quote exactly: HELOC line at 90% LTV less the balance.
  const access = computeQuoteNumbers(data.homeValue, data.balance).helocAvailable;
  const fmt = (n: number) => "$" + (n || 0).toLocaleString("en-US");
  const goal = goalLabel(data.goal).toLowerCase() || "your goal";

  // One-shot guard so the auto-redirect and a manual click can't both fire the
  // SubmitApplication event or navigate twice.
  const redirectedRef = useRef(false);

  function continueToApplication() {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    trackFbEvent("SubmitApplication", {
      content_name: "HELOC Application",
      content_category: "Mortgage",
      funnel_version: FUNNEL_VERSION,
    });
    window.location.href = buildApplicationUrl();
  }

  // Auto-hand off to the application after a brief pause, matching the v2
  // next-step page. The CTA below remains as a manual fallback.
  useEffect(() => {
    const id = window.setTimeout(continueToApplication, RESULT_REDIRECT_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="funnel-wrap" style={{ maxWidth: 720 }}>
      <div className="result-hero">
        <span className="eyebrow">
          <CheckCircle2 size={15} /> Review complete
        </span>
        <h1>{data.first ? `${data.first}, here's your recommended path.` : "Here's your recommended path."}</h1>
        <p>
          Based on your equity, goal, and credit, this is the strongest fit. Mykoal will confirm the
          details.
        </p>
      </div>

      <div className="rec-card">
        <span className="rec-badge">Recommended</span>
        <div className="rc-body">
          <div className="rc-eyebrow">Best fit for {goal}</div>
          <h2>Home Equity Line of Credit (HELOC)</h2>
          <div className="rec-stats">
            <div className="rec-stat">
              <div className="lbl">Est. equity available</div>
              <div className="val">{fmt(access)}</div>
              <div className="sub">up to ~90% of home value</div>
            </div>
            <div className="rec-stat">
              <div className="lbl">First-mortgage rate</div>
              <div className="val">Untouched</div>
              <div className="sub">no refinance needed</div>
            </div>
            <div className="rec-stat">
              <div className="lbl">Typical timeline</div>
              <div className="val">Days</div>
              <div className="sub">varies by lender</div>
            </div>
          </div>
          <div className="why">
            <b>
              <Info size={16} /> Why this path?
            </b>
            <ul>
              <li>
                <Check size={16} /> Lets you borrow against equity without refinancing your low
                first-mortgage rate.
              </li>
              <li>
                <Check size={16} /> Flexible — draw what you need, when you need it, for {goal}.
              </li>
              <li>
                <Check size={16} /> Matched to your credit range across our 90+ lender network.
              </li>
            </ul>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={continueToApplication}>
            Continue to my application <ArrowRight size={18} />
          </button>
          <p className="under-cta">
            Taking you to your secure application… &nbsp;·&nbsp; This is not a commitment to lend.
            Final terms are set by the lender after review.
          </p>
        </div>
      </div>

      <div className="support">
        <div className="av">MD</div>
        <div className="meta">
          <b>Questions? Call or text Mykoal</b>
          <span>Licensed loan officer · usually replies within the hour</span>
        </div>
        <div className="actions">
          <a className="sbtn" href={`tel:${PHONE}`} title="Call">
            <Phone size={18} />
          </a>
          <a className="sbtn" href={`sms:${PHONE}`} title="Text">
            <MessageSquare size={18} />
          </a>
          <a className="sbtn" href={CAL_URL} target="_blank" rel="noopener noreferrer" title="Book a time">
            <Calendar size={18} />
          </a>
        </div>
      </div>

      <div style={{ marginTop: 30 }}>
        <div className="eyebrow" style={{ color: "var(--text-400)" }}>
          What happens next
        </div>
        <div className="steps-list">
          <div className="step-item done">
            <div className="sn">
              <Check size={16} strokeWidth={3} />
            </div>
            <div className="si-body">
              <h4>You shared your basics</h4>
              <p>Equity, goal, and credit range — done in under two minutes.</p>
            </div>
          </div>
          <div className="step-item now">
            <div className="sn">2</div>
            <div className="si-body">
              <h4>
                Mykoal reviews your options <span className="tag-now">In progress</span>
              </h4>
              <p>
                A licensed loan officer personally checks your numbers against the lender network —
                no automated decision.
              </p>
              <div className="eta">Typically within a few hours</div>
            </div>
          </div>
          <div className="step-item">
            <div className="sn">3</div>
            <div className="si-body">
              <h4>You choose how to move forward</h4>
              <p>
                Review your matched options together. If it's a fit, Mykoal walks you through the
                application — your call, no pressure.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="alt-paths">
        <a className="alt-path" href={CAL_URL} target="_blank" rel="noopener noreferrer">
          <div className="ap-ic">
            <DollarSign size={20} />
          </div>
          <h4>Cash-out refinance</h4>
          <p>Replace your mortgage and pull equity in one new loan. Worth it only if today's rate beats yours.</p>
          <div className="ap-meta">
            Compare with Mykoal <ArrowRight size={14} />
          </div>
        </a>
        <a className="alt-path" href={CAL_URL} target="_blank" rel="noopener noreferrer">
          <div className="ap-ic">
            <Home size={20} />
          </div>
          <h4>Home equity loan</h4>
          <p>A fixed lump sum at a fixed rate — predictable payments for a one-time expense.</p>
          <div className="ap-meta">
            Compare with Mykoal <ArrowRight size={14} />
          </div>
        </a>
      </div>

      <p style={{ textAlign: "center", marginTop: 28 }}>
        <button type="button" className="btn btn-ghost" onClick={onRestart}>
          ← Start over
        </button>
      </p>
    </div>
  );
}

// Floating, secondary "Book a time" CTA. Anchored bottom-right; never competes
// with the in-funnel red primary. Links to Cal so the global PixelLinkTracker
// fires a Schedule event automatically.
function BookCal() {
  return (
    <a className="bookcal" href={CAL_URL} target="_blank" rel="noopener noreferrer">
      <span className="cav">
        <Calendar size={16} />
      </span>
      <span>
        Book a time
        <small>15 min with Mykoal</small>
      </span>
    </a>
  );
}

// ============================================================================
// Page
// ============================================================================
export default function HelocV3() {
  const ga4 = useGA4("heloc");

  const [stage, setStage] = useState<Stage>("hero");
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

  // Auto-advance past the hero into step one ~50ms after landing, so visitors
  // drop straight into the first question instead of dwelling on the hero — the
  // same target as the hero's "See My Options" button. One-shot (ref-guarded) so
  // going Back to the hero, or a restart, doesn't bounce them forward again. The
  // ViewContent + funnel_start pixels already fired on mount, so none is lost.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current || stage !== "hero") return;
    autoStartedRef.current = true;
    const id = window.setTimeout(() => go("s0"), 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const restart = () => {
    setData({ ...DEFAULT_DATA, pageLoadTime: Date.now() });
    sessionStorage.removeItem(SESSION_KEY);
    setSubmitError("");
    go("hero");
  };

  const SUBMIT_ERR =
    "Something went wrong with your submission. Please text or call Mykoal directly at (480) 206-9290 and he'll get back to you within minutes.";

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError("");
    const dob =
      data.yyyy && data.mm && data.dd
        ? `${data.yyyy}-${data.mm.padStart(2, "0")}-${data.dd.padStart(2, "0")}`
        : "";
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
        dob,
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
        setIsSubmitting(false);
        go("result");
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
  if (stage === "hero") {
    screen = <Hero onStart={() => go("s0")} />;
  } else if (stage === "s0") {
    screen = (
      <div className="funnel-wrap">
        <StepBalance data={data} set={set} onBack={() => go("hero")} onNext={() => advanceFrom("s0", "s1")} />
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
  } else if (stage === "s3") {
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
  } else {
    screen = <Result data={data} onRestart={restart} />;
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
        <BookCal />
      </div>

      <Footer />
    </div>
  );
}

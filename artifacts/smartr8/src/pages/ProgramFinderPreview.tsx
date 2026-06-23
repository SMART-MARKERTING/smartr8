import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CircleHelp,
  FileText,
  Home,
  Info,
  Landmark,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { submitLead } from "@/lib/submitLead";
import { trackFbEvent } from "@/lib/fbq";
import "./helocV3.css";

const SESSION_KEY = "smartr8_program_finder_v1";
const CAL_URL = "https://cal.com/mykoal/15-min-loan-consult-meeting";
const HELOC_APPLICATION_URL =
  "https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7";

const STEP_LABELS = ["Property", "Income", "Credit", "Equity", "Fit"];
const AUTO_ADVANCE_MS = 160;

type Stage = "occupancy" | "employment" | "credit" | "equity" | "mortgage" | "recommendation" | "contact";
type Data = {
  occupancy: string;
  employment: string;
  credit: string;
  homeValue: string;
  balance: string;
  mortgageStatus: string;
  nextAction: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  honeypot: string;
  pageLoadTime: number;
};

const DEFAULT_DATA: Data = {
  occupancy: "",
  employment: "",
  credit: "",
  homeValue: "",
  balance: "",
  mortgageStatus: "",
  nextAction: "",
  first: "",
  last: "",
  email: "",
  phone: "",
  honeypot: "",
  pageLoadTime: 0,
};

type Opt = {
  id: string;
  icon?: LucideIcon;
  title: string;
  sub?: string;
  info?: string;
};

const OCCUPANCY: Opt[] = [
  { id: "primary", icon: Home, title: "Primary residence", sub: "The home you live in most of the year" },
  { id: "second_home", icon: Landmark, title: "Second home", sub: "Vacation home or occasional-use property" },
  { id: "investment", icon: Building2, title: "Investment property", sub: "Rental, fix and flip, DSCR, bridge, or investor loan" },
];

const EMPLOYMENT: Opt[] = [
  {
    id: "employed",
    icon: Briefcase,
    title: "Employed",
    sub: "W2 or salary from a company",
    info: "Working for a company where you have no ownership or own less than 25%.",
  },
  {
    id: "self_employed",
    icon: FileText,
    title: "Self-employed",
    sub: "Own 25% or more, contractor, or sole proprietor",
    info: "Usually includes business owners, 1099 earners, sole proprietors, and partners with 25% or more ownership.",
  },
  {
    id: "retired",
    icon: ShieldCheck,
    title: "Retired",
    sub: "Pension, Social Security, IRA, or asset income",
    info: "Income may come from retirement benefits, assets, pension, Social Security, or other documented sources.",
  },
  {
    id: "entrepreneur",
    icon: Sparkles,
    title: "Entrepreneur",
    sub: "Founder, investor, startup, or mixed income",
    info: "For people with newer businesses, multiple ventures, investor income, or non-traditional income patterns.",
  },
  {
    id: "unemployed",
    icon: UserRound,
    title: "Unemployed",
    sub: "No current employment income",
    info: "Some paths may still exist if there are assets, equity, co-borrowers, rental income, or other qualifying sources.",
  },
];

const CREDIT: Opt[] = [
  { id: "excellent", title: "Excellent", sub: "740+" },
  { id: "good", title: "Good", sub: "680 to 739" },
  { id: "fair", title: "Fair", sub: "620 to 679" },
  { id: "building", title: "Still building", sub: "Below 620" },
  { id: "unsure", title: "Not sure", sub: "That's okay" },
];

const MORTGAGE_STATUS: Opt[] = [
  { id: "first_only", icon: Home, title: "Only a first mortgage", sub: "No HELOC or second mortgage right now" },
  { id: "has_second", icon: Wallet, title: "First plus second mortgage", sub: "HELOC, home equity loan, or other junior lien" },
  { id: "free_clear", icon: Check, title: "No mortgage", sub: "The property is owned free and clear" },
];

function label(options: Opt[], id: string) {
  const item = options.find((x) => x.id === id);
  return item ? item.title : "";
}

function money(n: string) {
  const digits = (n || "").replace(/[^\d]/g, "");
  return digits ? `$${Number(digits).toLocaleString("en-US")}` : "";
}

function parseMoney(n: string) {
  return Number((n || "").replace(/[^\d]/g, "")) || 0;
}

function dollars(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "Review needed";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function monthlyInterestOnly(amount: number, apr: number) {
  return amount > 0 ? (amount * (apr / 100)) / 12 : 0;
}

function monthlyAmortized(amount: number, apr: number, years: number) {
  if (amount <= 0) return 0;
  const months = years * 12;
  const rate = apr / 100 / 12;
  return (amount * rate) / (1 - Math.pow(1 + rate, -months));
}

function creditRateAdjuster(credit: string) {
  if (credit === "excellent") return -0.45;
  if (credit === "good") return 0;
  if (credit === "fair") return 0.75;
  if (credit === "building") return 1.55;
  return 0.35;
}

function aprRange(low: number, high: number, credit: string) {
  const adjuster = creditRateAdjuster(credit);
  return `${(low + adjuster).toFixed(2)}% - ${(high + adjuster).toFixed(2)}%`;
}

function buildApplicationUrl(data: Data) {
  const url = new URL(HELOC_APPLICATION_URL);
  url.searchParams.set("source", "see-my-options");
  url.searchParams.set("name", data.first);
  url.searchParams.set("credit", label(CREDIT, data.credit));
  url.searchParams.set(
    "use",
    data.occupancy === "investment" ? "Investment property program review" : "Program finder quote",
  );
  return url.toString();
}

function Progress({ current }: { current: number }) {
  const pct = Math.round(((current + 1) / STEP_LABELS.length) * 100);
  return (
    <div className="progress">
      <div className="progress-head">
        <span className="s">
          Step {current + 1} of {STEP_LABELS.length}
        </span>
        <span className="p">{pct}%</span>
      </div>
      <div className="p-steps">
        {STEP_LABELS.map((step, i) => (
          <div key={step} className={"p-st " + (i < current ? "done" : i === current ? "now" : "")}>
            <i></i>
            <span>{step}</span>
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

function OptionCard({ option, selected, onClick }: { option: Opt; selected: boolean; onClick: () => void }) {
  const Icon = option.icon;
  return (
    <button type="button" className={"opt" + (selected ? " sel" : "")} onClick={onClick}>
      {Icon && (
        <span className="oic">
          <Icon size={22} />
        </span>
      )}
      <span className="otxt">
        <b>
          {option.title}
          {option.info && (
            <span title={option.info} style={{ display: "inline-flex", marginLeft: 8, verticalAlign: "middle" }}>
              <CircleHelp size={15} />
            </span>
          )}
        </b>
        {option.sub && <small>{option.sub}</small>}
      </span>
      <span className="chk">
        <Check size={13} strokeWidth={3.4} />
      </span>
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="adorn">
      <span className="pre">$</span>
      <input
        inputMode="numeric"
        value={(value || "").replace(/[^\d]/g, "") ? Number(value.replace(/[^\d]/g, "")).toLocaleString("en-US") : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      />
    </div>
  );
}

function NavRow({ onBack, onNext, disabled, nextLabel = "Continue" }: { onBack?: () => void; onNext?: () => void; disabled?: boolean; nextLabel?: string }) {
  return (
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
  );
}

function ProgramSummary({ data }: { data: Data }) {
  const value = parseMoney(data.homeValue);
  const balance = parseMoney(data.balance);
  const equity = Math.max(0, value - balance);
  const isInvestment = data.occupancy === "investment";
  const selfLike = ["self_employed", "entrepreneur", "unemployed"].includes(data.employment);
  const maxEquityAccess = Math.max(0, Math.floor(value * (isInvestment ? 0.75 : 0.85) - balance));
  const cashOutAccess = Math.max(0, Math.floor(value * (isInvestment ? 0.7 : 0.8) - balance));
  const reviewAmount = maxEquityAccess || cashOutAccess || equity;
  const creditLabel = label(CREDIT, data.credit) || "Credit review";

  const primary = isInvestment
    ? "Investor financing path"
    : selfLike
      ? "Flexible documentation path"
      : "Home equity or cash-out path";
  const options = isInvestment
    ? ["DSCR rental loan", "Bridge or hard money", "Fix and flip / construction", "Private investor options"]
    : [
        "HELOC",
        "Home equity loan",
        "Cash-out refinance",
        selfLike ? "Bank statement or non-QM review" : "Rate and term review if payment reduction matters",
      ];
  const estimatedOptions = isInvestment
    ? [
        {
          name: "DSCR rental loan",
          tag: "Rental cash flow",
          apr: aprRange(7.25, 9.75, data.credit),
          payment: dollars(monthlyAmortized(Math.max(balance, reviewAmount), 8.25 + creditRateAdjuster(data.credit), 30)),
          note: "For rental properties where rent can support the payment.",
        },
        {
          name: "Bridge / hard money",
          tag: "Fast capital",
          apr: aprRange(10.5, 13.5, data.credit),
          payment: dollars(monthlyInterestOnly(Math.max(reviewAmount, 150000), 11.75 + creditRateAdjuster(data.credit))),
          note: "Shorter-term fit for purchase, rehab, or time-sensitive scenarios.",
        },
        {
          name: "Fix, flip, construction",
          tag: "Project funding",
          apr: aprRange(10.99, 14.5, data.credit),
          payment: dollars(monthlyInterestOnly(Math.max(reviewAmount, 150000), 12.25 + creditRateAdjuster(data.credit))),
          note: "Can consider purchase, rehab budget, draws, and exit plan.",
        },
      ]
    : [
        {
          name: "HELOC",
          tag: "Flexible line",
          apr: aprRange(8.25, 11.5, data.credit),
          payment: dollars(monthlyInterestOnly(maxEquityAccess, 9.5 + creditRateAdjuster(data.credit))),
          note: "Interest-only style estimate during the draw period.",
        },
        {
          name: "Home equity loan",
          tag: "Fixed payment",
          apr: aprRange(8.75, 12.25, data.credit),
          payment: dollars(monthlyAmortized(maxEquityAccess, 9.75 + creditRateAdjuster(data.credit), 20)),
          note: "Installment style estimate using available equity.",
        },
        {
          name: "Cash-out refinance",
          tag: "Replace first lien",
          apr: aprRange(6.75, 8.75, data.credit),
          payment: dollars(monthlyAmortized(Math.max(balance + cashOutAccess, balance), 7.25 + creditRateAdjuster(data.credit), 30)),
          note: "Estimated new first mortgage payment before taxes and insurance.",
        },
      ];

  return (
    <div className="program-options-panel">
      <div className="pop-head">
        <div className="pop-icon">
          <Sparkles size={22} />
        </div>
        <div>
          <span>Loan options preview</span>
          <h3>We have some promising paths to review.</h3>
          <p>
            Best-fit genre: <strong>{primary}</strong>. We would compare {options.join(", ")}.
          </p>
        </div>
      </div>
      <div className="pop-stats">
        <div>
          <span>Estimated equity</span>
          <strong>{money(String(equity)) || "$0"}</strong>
        </div>
        <div>
          <span>Possible access</span>
          <strong>{dollars(maxEquityAccess || cashOutAccess)}</strong>
        </div>
        <div>
          <span>Credit band</span>
          <strong>{creditLabel}</strong>
        </div>
      </div>
      <div className="loan-option-grid">
        {estimatedOptions.map((option) => (
          <div className="loan-option" key={option.name}>
            <div className="loan-option-top">
              <span>{option.tag}</span>
              <Landmark size={17} />
            </div>
            <h4>{option.name}</h4>
            <div className="loan-metrics">
              <div>
                <span>Estimated APR</span>
                <strong>{option.apr}</strong>
              </div>
              <div>
                <span>Est. monthly</span>
                <strong>{option.payment}</strong>
              </div>
            </div>
            <p>{option.note}</p>
          </div>
        ))}
      </div>
      <p className="pop-disclaimer">
        Estimates are illustrative only and not a loan offer. Final pricing, APR, payment, points, and approval depend on
        credit, property, liens, income documentation, rent or DSCR review, title, appraisal, and underwriting.
      </p>
    </div>
  );
}

export default function ProgramFinderPreview() {
  const [location] = useLocation();
  const [stage, setStage] = useState<Stage>("occupancy");
  const [data, setData] = useState<Data>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}") as Partial<Data>;
      return { ...DEFAULT_DATA, ...saved, pageLoadTime: saved.pageLoadTime || Date.now() };
    } catch {
      return { ...DEFAULT_DATA, pageLoadTime: Date.now() };
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }, [data]);

  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));
  const go = (next: Stage) => {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const choose = (patch: Partial<Data>, next: Stage) => {
    set(patch);
    window.setTimeout(() => go(next), AUTO_ADVANCE_MS);
  };
  const pageUrlOverride =
    location === "/main-see-my-options" && typeof window !== "undefined"
      ? `${window.location.origin}/main-see-my-options`
      : undefined;

  async function submitProgramFinderLead() {
    setIsSubmitting(true);
    setSubmitError("");
    const sourceLabel = location === "/main-see-my-options" ? "main-see-my-options" : "see-my-options";
    try {
      const result = await submitLead({
        funnel: "see-my-options",
        firstName: data.first.trim(),
        lastName: data.last.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        homeValue: data.homeValue,
        mortgageBalance: data.balance,
        creditScore: label(CREDIT, data.credit),
        honeypot: data.honeypot,
        pageLoadTime: data.pageLoadTime,
        pageUrlOverride,
        additionalFields: {
          "Funnel-Source": sourceLabel,
          Occupancy: label(OCCUPANCY, data.occupancy),
          "Employment Status": label(EMPLOYMENT, data.employment),
          "Mortgage Setup": label(MORTGAGE_STATUS, data.mortgageStatus),
          "Requested Next Step": data.nextAction === "email_quote" ? "Have quote emailed/texted to me" : "Schedule a call",
          "Best-Fit Genre":
            data.occupancy === "investment"
              ? "Investor financing path"
              : ["self_employed", "entrepreneur", "unemployed"].includes(data.employment)
                ? "Flexible documentation path"
                : "Home equity or cash-out path",
        },
      });
      if (result.success) {
        trackFbEvent("Lead", {
          content_name: "Program Finder",
          content_category: "Mortgage",
          source: sourceLabel,
        });
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = buildApplicationUrl(data);
      } else {
        setSubmitError(result.error || "Something went wrong. Please call or text Mykoal directly at (480) 206-9290.");
        setIsSubmitting(false);
      }
    } catch {
      setSubmitError("Something went wrong. Please call or text Mykoal directly at (480) 206-9290.");
      setIsSubmitting(false);
    }
  }

  const stageIndex = useMemo(() => {
    if (stage === "occupancy") return 0;
    if (stage === "employment") return 1;
    if (stage === "credit") return 2;
    if (stage === "equity" || stage === "mortgage") return 3;
    return 4;
  }, [stage]);

  let screen: ReactNode;
  if (stage === "occupancy") {
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Program finder" title="How do you occupy this property?" help="This first answer decides which program family we should explore." />
        <div className="q-body">
          <div className="opts">
            {OCCUPANCY.map((option) => (
              <OptionCard key={option.id} option={option} selected={data.occupancy === option.id} onClick={() => choose({ occupancy: option.id }, "employment")} />
            ))}
          </div>
        </div>
      </div>
    );
  } else if (stage === "employment") {
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Income profile" title="What is your employment status?" help="The info icon explains how each category is usually interpreted by lenders." />
        <div className="q-body">
          <div className="opts">
            {EMPLOYMENT.map((option) => (
              <OptionCard key={option.id} option={option} selected={data.employment === option.id} onClick={() => choose({ employment: option.id }, "credit")} />
            ))}
          </div>
          <NavRow onBack={() => go("occupancy")} />
        </div>
      </div>
    );
  } else if (stage === "credit") {
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Credit" title="What is your estimated credit score?" help="A range is enough to start. This can be refined later." />
        <div className="q-body">
          <div className="opts">
            {CREDIT.map((option) => (
              <OptionCard key={option.id} option={option} selected={data.credit === option.id} onClick={() => choose({ credit: option.id }, "equity")} />
            ))}
          </div>
          <NavRow onBack={() => go("employment")} />
        </div>
      </div>
    );
  } else if (stage === "equity") {
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Property numbers" title="What is the estimated value and current balance?" help="Same rhythm as HELOC Dash V3: estimates are fine." />
        <div className="q-body">
          <Field label="Estimated property value" hint="What you think the property is worth today.">
            <MoneyInput value={data.homeValue} onChange={(v) => set({ homeValue: v })} placeholder="500,000" />
          </Field>
          <Field label="Current total mortgage balance" hint="Use the total owed across current liens if you know it.">
            <MoneyInput value={data.balance} onChange={(v) => set({ balance: v })} placeholder="300,000" />
          </Field>
          <NavRow onBack={() => go("credit")} onNext={() => go("mortgage")} disabled={!data.homeValue} />
        </div>
      </div>
    );
  } else if (stage === "mortgage") {
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Current liens" title="What mortgage setup do you have right now?" help="This helps determine HELOC, home equity loan, cash-out, bridge, or DSCR fit." />
        <div className="q-body">
          <div className="opts">
            {MORTGAGE_STATUS.map((option) => (
              <OptionCard key={option.id} option={option} selected={data.mortgageStatus === option.id} onClick={() => choose({ mortgageStatus: option.id }, "recommendation")} />
            ))}
          </div>
          <NavRow onBack={() => go("equity")} />
        </div>
      </div>
    );
  } else if (stage === "recommendation") {
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Program fit" title="Good news. We have some options to explore." help="This is the hopeful handoff screen before the final action." />
        <div className="q-body">
          <ProgramSummary data={data} />
          <div className="opts">
            <OptionCard
              option={{ id: "schedule", icon: Phone, title: "Schedule a call", sub: "Open Mykoal's calendar and pick a time" }}
              selected={data.nextAction === "schedule"}
              onClick={() => set({ nextAction: "schedule" })}
            />
            <OptionCard
              option={{ id: "email_quote", icon: Mail, title: "Have quote emailed/texted to me", sub: "Share where Mykoal should send your options" }}
              selected={data.nextAction === "email_quote"}
              onClick={() => set({ nextAction: "email_quote" })}
            />
          </div>
          <NavRow
            onBack={() => go("mortgage")}
            onNext={() => {
              if (data.nextAction === "schedule") window.open(CAL_URL, "_blank", "noopener,noreferrer");
              else go("contact");
            }}
            disabled={!data.nextAction}
            nextLabel={data.nextAction === "schedule" ? "Open Calendar" : "Continue"}
          />
        </div>
      </div>
    );
  } else {
    const emailOk = /\S+@\S+\.\S+/.test(data.email);
    const ready = data.first && data.last && emailOk && data.phone.replace(/\D/g, "").length >= 10;
    screen = (
      <div className="step">
        <Progress current={stageIndex} />
        <StepHead eyebrow="Send my options" title="Where should we send the quote?" help="Mykoal will use this to follow up on the best-fit program path." />
        <div className="q-body">
          <div className="grid2">
            <Field label="First name">
              <input className="inp" value={data.first} placeholder="Jane" onChange={(e) => set({ first: e.target.value })} />
            </Field>
            <Field label="Last name">
              <input className="inp" value={data.last} placeholder="Doe" onChange={(e) => set({ last: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <input className="inp" type="email" value={data.email} placeholder="jane@example.com" onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Mobile phone">
            <input className="inp" type="tel" value={data.phone} placeholder="(480) 555-0199" onChange={(e) => set({ phone: e.target.value })} />
          </Field>
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
          <div className="reassure">
            <Info size={18} />
            <div>
              <b>What happens next</b>
              <p>
                We will use your occupancy, employment, credit, value, balance, and mortgage setup to narrow the program path.
              </p>
            </div>
          </div>
          <NavRow
            onBack={() => go("recommendation")}
            onNext={submitProgramFinderLead}
            disabled={!ready || isSubmitting}
            nextLabel={isSubmitting ? "Submitting..." : "Send Quote Request"}
          />
          {submitError && (
            <p className="errmsg">
              <AlertTriangle size={13} /> {submitError}
            </p>
          )}
          {!ready && (
            <p className="errmsg">
              <AlertTriangle size={13} /> Add name, valid email, and phone to continue.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="See My Mortgage Options | Smartr8"
        description="Find a best-fit mortgage path based on occupancy, employment, credit, property value, mortgage balance, and current lien setup."
        canonical="/see-my-options"
      />
      <Header />
      <div className="heloc-v3 flex-1 flex flex-col">
        <main className="main">
          <div className="funnel-wrap">{screen}</div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

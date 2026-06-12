import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowLeft, ArrowRight, RotateCcw, Plus, Trash2, Check, Pencil,
  Calculator, Loader2, Home as HomeIcon,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  makeDefaultInputs,
  money,
  STRUCTURE_LABELS,
  type WorksheetInputs,
  type ProductType,
  type Goal,
  type LoanStructure,
  DEFAULT_NEW_LOAN_RATE,
  DEFAULT_CLOSING_COSTS,
} from "@/lib/worksheetCalc";
import { submitFunnelCompletion, type FunnelEntryButton } from "@/lib/submitLead";
import { sendAutoQuote } from "@/lib/autoQuote";
import { FunnelFAQ, type FaqItem, type GuideLink } from "@/components/FunnelFAQ";
import { TrustBlock } from "@/components/TrustBlock";
import { ComplianceFooter } from "@/components/ComplianceFooter";
import { makeFunnelTracker, mykoalUrl, MYKOAL_ARTICLES } from "@/lib/funnelEvents";

const STORAGE_KEY = "smartr8_worksheet_funnel_v2";
const STEP_KEY = "smartr8_worksheet_funnel_step_v2";
const CONTACT_KEY = "smartr8_funnel_contact_v1";
const ENTRY_KEY = "smartr8_funnel_entry_v1";
const PURCHASE_KEY = "smartr8_funnel_purchase_v1";

// ── Funnel FAQ content (cash-out + rate-reduction only) ──────────────────────
// Rendered below the funnel card on the indexable per-product routes. Each set
// emits its own FAQPage schema (exactly one per page) via <FunnelFAQ/>. Copy is
// compliance-safe: conditional language, no rates/figures. mykoal.com deep
// links carry the funnel-FAQ UTM set.
interface FunnelFaqConfig {
  /** snake_case analytics page key. */
  page: string;
  /** VA disclaimer is never shown here (no VA lane in the worksheet). */
  items: FaqItem[];
  guideLinks: GuideLink[];
}
const FUNNEL_FAQS: Partial<Record<FunnelEntryButton, FunnelFaqConfig>> = {
  "cash-out": {
    page: "cash_out",
    items: [
      {
        q: "What is a cash-out refinance?",
        a: "A cash-out refinance replaces your current mortgage with a new, larger loan and gives you the difference in cash. Homeowners often use it to access built-up equity for renovations, debt consolidation, or other goals. The amount available depends on your equity and a full application review.",
      },
      {
        q: "Does a cash-out refinance replace my current mortgage?",
        a: "Yes. Unlike a HELOC, a cash-out refinance pays off your existing mortgage and replaces it with a single new loan. That means your current rate and term change, so it is worth comparing against a second-lien option if you want to keep your current first mortgage.",
      },
      {
        q: "Can I use cash-out funds for debt consolidation?",
        a: "Many homeowners use cash-out funds to pay off higher-rate balances and consolidate them into one mortgage payment. Whether that helps depends on your balances, your rate, and your goals, all reviewed as part of a full application. There is no obligation to find out what fits.",
      },
      {
        q: "How much equity do I need?",
        a: "Requirements vary, but many programs ask you to keep some equity in the home after the new loan. The exact amount depends on the program, your credit profile, and the property, all confirmed through underwriting. We can review your scenario and tell you where you stand.",
      },
      {
        q: "Is a cash-out refinance better than a HELOC?",
        a: "It depends on whether you want to keep your current mortgage. A cash-out refinance replaces it with one new loan, while a HELOC adds a separate line behind it. Comparing both side by side is the best way to decide which fits your goals.",
        learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.helocVsCashOut), label: "HELOC vs. cash-out refinance", mykoal: true },
      },
    ],
    guideLinks: [
      { href: mykoalUrl(MYKOAL_ARTICLES.helocVsCashOut), label: "Read the full guide: HELOC vs. cash-out refinance", mykoal: true },
    ],
  },
  "rate-reduction": {
    page: "rate_reduction",
    items: [
      {
        q: "When does refinancing make sense?",
        a: "Refinancing can make sense when it helps you reach a clear goal, such as lowering your rate, reducing your monthly payment, or changing your loan term. The right answer depends on your current loan, how long you plan to stay, and the costs involved. A quick review can show whether the timing works for you.",
        learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.whenRefinance), label: "When does refinancing make sense?", mykoal: true },
      },
      {
        q: "What is a refinance break-even point?",
        a: "The break-even point is roughly when the savings from your new loan add up to more than what the refinance cost you. If you plan to stay past that point, refinancing is more likely to pay off. We can estimate it for your scenario, subject to a full application review.",
        learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.whenRefinance), label: "When does refinancing make sense?", mykoal: true },
      },
      {
        q: "Can refinancing lower my monthly payment?",
        a: "It can, depending on your new rate, loan term, and balance. Some borrowers lower their payment by reducing their rate, while others do it by adjusting the term. Whether it works for you is confirmed through a full application review, with no obligation to move forward.",
      },
      {
        q: "What costs come with refinancing?",
        a: "A refinance typically involves closing costs that can include lender, title, and appraisal-related fees, which vary by loan and location. Some borrowers pay these up front while others roll them into the loan. We will walk through the specifics for your scenario before you decide.",
      },
      {
        q: "How do I know if now is a good time to refinance?",
        a: "The best time depends on your goals, your current loan, and how the numbers work out after costs. Rather than trying to time the market perfectly, it helps to compare your current loan against your options for your specific situation. We can run that review with no obligation.",
        learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.whenRefinance), label: "When does refinancing make sense?", mykoal: true },
      },
    ],
    guideLinks: [
      { href: mykoalUrl(MYKOAL_ARTICLES.whenRefinance), label: "Read the full guide: When does refinancing make sense?", mykoal: true },
    ],
  },
};

// Tailored purchase-path answers (no existing mortgage / equity to calc).
interface PurchaseInfo {
  priceRange: string;
  downPayment: string;
  timeline: string;
  firstTime: string;
}
function emptyPurchase(): PurchaseInfo {
  return { priceRange: "", downPayment: "", timeline: "", firstTime: "" };
}
function loadPurchase(): PurchaseInfo {
  try {
    const raw = sessionStorage.getItem(PURCHASE_KEY);
    if (raw) return { ...emptyPurchase(), ...JSON.parse(raw) };
  } catch {}
  return emptyPurchase();
}
function savePurchase(p: PurchaseInfo) {
  try { sessionStorage.setItem(PURCHASE_KEY, JSON.stringify(p)); } catch {}
}

// Step machinery for the unified funnel.
// Calc products (CASH_OUT/RATE_REDUCTION/HOME_EQUITY) use 1-5.
// Non-calc products (heloc/purchase) jump from Step 1 → Step 5 → redirect.
// 1 = product   2 = mortgage   3 = goals/debts   4 = loan details
// 5 = contact info (LM submit + auto-email worksheet PDF, then redirect to /whats-next)
type FunnelStep = 1 | 2 | 3 | 4 | 5;

interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
}

function emptyContact(): ContactInfo {
  return { firstName: "", lastName: "", email: "", mobile: "" };
}

function loadContact(): ContactInfo {
  try {
    const raw = sessionStorage.getItem(CONTACT_KEY);
    if (raw) return { ...emptyContact(), ...JSON.parse(raw) };
  } catch {}
  return emptyContact();
}

function saveContact(c: ContactInfo) {
  try { sessionStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch {}
}

function loadEntry(): FunnelEntryButton | null {
  try {
    const raw = sessionStorage.getItem(ENTRY_KEY);
    if (raw === "cash-out" || raw === "rate-reduction" || raw === "home-equity" || raw === "heloc" || raw === "purchase") {
      return raw;
    }
  } catch {}
  return null;
}

function saveEntry(e: FunnelEntryButton | null) {
  try {
    if (e) sessionStorage.setItem(ENTRY_KEY, e);
    else sessionStorage.removeItem(ENTRY_KEY);
  } catch {}
}

/** Maps the ?product= URL param to the canonical FunnelEntryButton. */
function parseEntryFromUrl(searchString: string): FunnelEntryButton | null {
  try {
    const raw = new URLSearchParams(searchString).get("product")?.toLowerCase().trim();
    if (!raw) return null;
    if (raw === "cash-out" || raw === "cashout" || raw === "cash_out") return "cash-out";
    if (raw === "rate-reduction" || raw === "rate" || raw === "rate_reduction") return "rate-reduction";
    if (raw === "home-equity" || raw === "home_equity" || raw === "2nd-mortgage") return "home-equity";
    if (raw === "heloc") return "heloc";
    if (raw === "purchase" || raw === "buy") return "purchase";
  } catch {}
  return null;
}

/** Returns the worksheet calc ProductType for an entry button, or null if non-calc. */
function entryToProductType(e: FunnelEntryButton | null): ProductType | null {
  if (e === "cash-out") return "CASH_OUT";
  if (e === "rate-reduction") return "RATE_REDUCTION";
  if (e === "home-equity") return "HOME_EQUITY";
  return null;
}

/** True if this entry has a worksheet calc engine (and thus the full 4-step funnel). */
function isCalcEntry(e: FunnelEntryButton | null): boolean {
  return e === "cash-out" || e === "rate-reduction" || e === "home-equity" || e === null;
}

function loadInputs(): WorksheetInputs {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...makeDefaultInputs(), ...JSON.parse(raw) };
  } catch {}
  return makeDefaultInputs({
    // Public funnel starts blank — no preset client name
    clientFirstName: "",
    clientLastName: "",
    debts: [],
    existBalance: 0,
    existRate: 0,
    existTotalPayment: 0,
    existEscrow: 0,
    existYearsRemaining: 0,
    homeImprovementAmount: 0,
    cashBack: 0,
    loanAmount: 0,
    goal: null,
  });
}

function loadStep(): FunnelStep {
  try {
    const raw = sessionStorage.getItem(STEP_KEY);
    const n = raw ? parseInt(raw, 10) : 1;
    // Only steps 1-5 are resumable input steps. Steps 6 (fork) and 7 (results)
    // are post-completion screens; a page load must never restore into them,
    // or every re-entry to /worksheet lands the user on the results screen.
    if (n >= 1 && n <= 5) return n as FunnelStep;
  } catch {}
  return 1;
}

function saveInputs(inputs: WorksheetInputs) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch {}
}
function saveStep(step: FunnelStep) {
  try { sessionStorage.setItem(STEP_KEY, String(step)); } catch {}
}

// ── Tiny field helper: numeric input ─────────────────────────────────────────
function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  optional,
  hint,
  min,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  optional?: boolean;
  hint?: string;
  min?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <Label className="text-sm font-medium">
          {label} {optional && <span className="text-muted-foreground font-normal text-xs">(optional)</span>}
        </Label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          step={step}
          min={min}
          inputMode="decimal"
          placeholder={placeholder}
          value={value ? value : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? 0 : Number(v));
          }}
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""}`.trim()}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Big tap-target card (used for binary/multi choices in mobile-first flow) ─
function BigChoiceCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-4 transition-all min-h-[60px] ${
        selected ? "border-accent bg-accent/5 shadow-sm" : "border-border hover:border-muted-foreground/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-accent bg-accent" : "border-muted-foreground/30"}`}>
          {selected && <Check className="h-3 w-3 text-white" />}
        </div>
        <div>
          <div className="font-semibold text-primary">{title}</div>
          {description && <div className="text-sm text-muted-foreground mt-0.5">{description}</div>}
        </div>
      </div>
    </button>
  );
}

// ── Yes/No card pair that reveals a NumberField when the user picks Yes ─────
function KnowsItField({
  question,
  knows,
  onKnowsChange,
  fieldLabel,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  step,
}: {
  question: string;
  knows: boolean | null;
  onKnowsChange: (b: boolean) => void;
  fieldLabel: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  step?: number;
}) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-medium">{question}</Label>
      <div className="grid grid-cols-2 gap-3">
        <BigChoiceCard selected={knows === true} onClick={() => onKnowsChange(true)} title="Yes" />
        <BigChoiceCard selected={knows === false} onClick={() => onKnowsChange(false)} title="No" />
      </div>
      {knows === true && (
        <div className="pt-1">
          <NumberField
            label={fieldLabel}
            value={value}
            onChange={onChange}
            prefix={prefix}
            suffix={suffix}
            placeholder={placeholder}
            step={step}
          />
        </div>
      )}
    </div>
  );
}

// ── Step 4 locked field wrapper: display value + pencil to unlock ───────────
function LockedField({
  label,
  locked,
  onToggleLock,
  displayValue,
  children,
}: {
  label: string;
  locked: boolean;
  onToggleLock: (l: boolean) => void;
  displayValue: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        <button
          type="button"
          onClick={() => onToggleLock(!locked)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          aria-label={locked ? `Edit ${label}` : `Lock ${label}`}
        >
          {locked ? (<><Pencil className="h-3 w-3" /> Edit</>) : (<><Check className="h-3 w-3" /> Done</>)}
        </button>
      </div>
      {locked ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-base font-semibold text-primary">
          {displayValue}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

// ── Top bar with Start Over ──────────────────────────────────────────────────
function TopBar({ step, totalSteps, onStartOver }: { step: number; totalSteps: number; onStartOver: () => void }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to home
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {step <= totalSteps ? `Step ${step} of ${totalSteps}` : "Your Results"}
        </span>
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          title="Reset and start over"
        >
          <RotateCcw className="h-3 w-3" /> Start over
        </button>
      </div>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function Progress({ step, total }: { step: number; total: number }) {
  const pct = Math.min(100, Math.max(0, ((step - 1) / total) * 100));
  return (
    <div className="h-1 bg-muted rounded-full overflow-hidden mb-8">
      <div
        className="h-full bg-accent transition-all duration-300"
        style={{ width: `${Math.max(8, pct + 100 / total)}%` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Worksheet({ entry }: { entry?: FunnelEntryButton } = {}) {
  const search = useSearch();
  const [, setLocation] = useLocation();
  // The product can arrive three ways, in priority order: an explicit `entry`
  // prop (from a canonical per-product route like /cash-out), the legacy
  // ?product= query param, or a resumed sessionStorage value.
  const initialEntry = entry ?? parseEntryFromUrl(search);
  const [inputs, setInputs] = useState<WorksheetInputs>(loadInputs);
  const [step, setStep] = useState<FunnelStep>(
    // A fresh product entry means the user is launching a funnel from a
    // product button, so always start at Step 1. Otherwise resume the saved step.
    () => (initialEntry ? 1 : loadStep()),
  );
  const [contact, setContact] = useState<ContactInfo>(loadContact);
  const [entryButton, setEntryButton] = useState<FunnelEntryButton | null>(
    () => initialEntry ?? loadEntry(),
  );
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [consentState, setConsentState] = useState({
    ready: false, consent: false, consent_version: "",
    consent_text: "", turnstile_token: "",
  });

  // Purchase is the one non-calc product with tailored questions (it has no
  // existing mortgage or equity to calculate). Captured here and folded into
  // the lead Notes; persisted so a back/refresh keeps the answers.
  const [purchaseInfo, setPurchaseInfo] = useState<PurchaseInfo>(loadPurchase);
  useEffect(() => { savePurchase(purchaseInfo); }, [purchaseInfo]);
  const { toast } = useToast();
  const initialPrefillRef = useRef(false);

  // Step 2 — explicit Yes/No toggles for the optional mortgage fields. Initialized
  // from whatever is already in storage so a returning user sees their answers.
  const [knowsRate, setKnowsRate] = useState<boolean | null>(() => (inputs.existRate > 0 ? true : null));
  const [knowsEscrow, setKnowsEscrow] = useState<boolean | null>(() => (inputs.existEscrow > 0 ? true : null));
  const [knowsYears, setKnowsYears] = useState<boolean | null>(() => (inputs.existYearsRemaining > 0 ? true : null));

  // Step 3 — debt entry mode. Itemized = list each creditor. Bulk = one total.
  const [debtMode, setDebtMode] = useState<"itemized" | "bulk">(() => {
    // If the only debt row is a synthetic "Total debt" entry, restore bulk mode.
    if (inputs.debts.length === 1 && inputs.debts[0]?.name === "Total debt") return "bulk";
    return "itemized";
  });

  // Step 4 — per-field locked state. Pencil unlocks; Done re-locks (snaps back to auto for numeric fields).
  const [lockedLoanAmount, setLockedLoanAmount] = useState(true);
  const [lockedLoanRate, setLockedLoanRate] = useState(true);
  const [lockedClosingCosts, setLockedClosingCosts] = useState(true);
  const [lockedTerm, setLockedTerm] = useState(true);
  const [lockedStructure, setLockedStructure] = useState(true);

  useEffect(() => { saveInputs(inputs); }, [inputs]);
  useEffect(() => { saveStep(step); }, [step]);
  useEffect(() => { saveContact(contact); }, [contact]);
  useEffect(() => { saveEntry(entryButton); }, [entryButton]);

  // Wouter reuses this component instance across the canonical product routes
  // (/cash-out, /rate-reduction, /purchase, /see-my-options all render
  // <Worksheet>), so a changed `entry` prop must be synced into state — the
  // useState initializer only runs once. Without this, navigating between
  // product routes wouldn't update the selection or restart the funnel.
  useEffect(() => {
    if (entry && entry !== entryButton) {
      setEntryButton(entry);
      const pt = entryToProductType(entry);
      if (pt) {
        setInputs((prev) => ({
          ...prev,
          productType: pt,
          ...(pt === "RATE_REDUCTION" ? { hasExistingMortgage: true } : {}),
        }));
      }
      setStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);

  // Home equity / 2nd mortgage no longer runs the worksheet calculator — it
  // has its own dedicated funnel. Bounce any such entry (deep link, saved
  // session, or legacy ?product=home-equity) straight to /heloc-v3.
  useEffect(() => {
    if (entryButton === "home-equity") setLocation("/heloc-v3");
  }, [entryButton, setLocation]);

  // On mount, sync productType to URL entry param (calc products only).
  // For RATE_REDUCTION, force hasExistingMortgage true so renderStep2 skips the gate.
  useEffect(() => {
    if (!entryButton) return;
    const pt = entryToProductType(entryButton);
    if (pt) {
      setInputs((prev) => {
        if (prev.productType === pt) return prev;
        return {
          ...prev,
          productType: pt,
          ...(pt === "RATE_REDUCTION" ? { hasExistingMortgage: true } : {}),
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Funnel structure flags
  const isCalc = isCalcEntry(entryButton);
  const isRateReduction = inputs.productType === "RATE_REDUCTION";

  // Funnel FAQ + analytics for the indexable per-product routes (cash-out,
  // rate-reduction). Recomputed each render; makeFunnelTracker is stateless and
  // cheap, and the hoisted handlers below close over the current value.
  const faqConfig = entryButton ? FUNNEL_FAQS[entryButton] : undefined;
  const tracker = faqConfig ? makeFunnelTracker(faqConfig.page) : null;
  const formStarted = useRef(false);
  const handleFormStart = () => {
    if (formStarted.current || !tracker) return;
    formStarted.current = true;
    tracker.formStart();
  };
  // Visible step counts:
  //   non-calc (heloc/purchase): 2 visible steps (intro → contact)
  //   calc + RATE_REDUCTION:     4 visible steps (product, mortgage, loan, contact)
  //   calc + other:              5 visible steps (product, mortgage, goals, loan, contact)
  const totalSteps = !isCalc ? 2 : isRateReduction ? 4 : 5;

  // Map logical FunnelStep (1-5) to the visible progress index (1-totalSteps).
  function visibleStep(s: FunnelStep): number {
    if (!isCalc) {
      if (s >= 5) return 2;
      return 1;
    }
    if (s === 5) return isRateReduction ? 4 : 5;
    if (isRateReduction && s >= 4) return s - 1;
    return s;
  }

  function updateContact(patch: Partial<ContactInfo>) {
    setContact((prev) => ({ ...prev, ...patch }));
  }

  function handleStartOver() {
    if (!confirm("Clear all inputs and start over?")) return;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STEP_KEY);
    sessionStorage.removeItem(CONTACT_KEY);
    sessionStorage.removeItem(ENTRY_KEY);
    setInputs(loadInputs());
    setStep(1);
    setContact(emptyContact());
    setEntryButton(null);
    initialPrefillRef.current = false;
    toast({ title: "Reset!", description: "Starting fresh from Step 1." });
  }

  function update<K extends keyof WorksheetInputs>(key: K, value: WorksheetInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    // Non-calc (HELOC / Purchase): Step 1 intro → Step 5 contact directly
    if (!isCalc) {
      if (step === 1) { setStep(5); return; }
      return;
    }
    // Validation gates per step (calc products)
    if (step === 1) {
      // Product chosen — always set
      // For RATE_REDUCTION, force hasExistingMortgage true
      if (isRateReduction && !inputs.hasExistingMortgage) {
        update("hasExistingMortgage", true);
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (inputs.homeValue <= 0) {
        toast({ title: "Add your home value", description: "Enter your home's estimated value to continue.", variant: "destructive" });
        return;
      }
      if (inputs.hasExistingMortgage) {
        if (inputs.existBalance <= 0) {
          toast({ title: "Add your mortgage balance", description: "Enter your current mortgage balance to continue.", variant: "destructive" });
          return;
        }
        if (inputs.existTotalPayment <= 0) {
          toast({ title: "Add your monthly payment", description: "Enter your full monthly payment (PITI) to continue.", variant: "destructive" });
          return;
        }
      }
      // RATE_REDUCTION skips step 3 → go directly to step 4
      setStep(isRateReduction ? 4 : 3);
      return;
    }
    if (step === 3) {
      // Goals required for non-RR
      if (!inputs.goal) {
        toast({ title: "Pick a goal", description: "Choose what you want to do with the funds.", variant: "destructive" });
        return;
      }
      const wantsDebt = inputs.goal === "DEBT" || inputs.goal === "BOTH";
      const wantsImprovement = inputs.goal === "IMPROVEMENT" || inputs.goal === "BOTH";
      const wantsOther = inputs.goal === "OTHER";
      const debtSum = inputs.debts.reduce((s, d) => s + d.balance, 0);
      if (wantsDebt && debtSum <= 0) {
        toast({ title: "Add your debt balance", description: "Enter the balance(s) you want to consolidate.", variant: "destructive" });
        return;
      }
      if (wantsImprovement && inputs.homeImprovementAmount <= 0) {
        toast({ title: "Add an improvement amount", description: "Enter how much you want for home improvements.", variant: "destructive" });
        return;
      }
      if (wantsOther && inputs.cashBack <= 0) {
        toast({ title: "Enter a cash amount", description: "Tell us how much cash you'd like.", variant: "destructive" });
        return;
      }
      // Auto-prefill loan amount when first arriving at step 4
      const prefill = (inputs.hasExistingMortgage ? inputs.existBalance : 0) +
        (wantsDebt ? debtSum : 0) +
        (wantsImprovement ? inputs.homeImprovementAmount : 0) +
        (wantsOther ? inputs.cashBack : 0) +
        DEFAULT_CLOSING_COSTS;
      if (!initialPrefillRef.current || inputs.loanAmount <= 0) {
        update("loanAmount", Math.round(prefill / 100) * 100);
        initialPrefillRef.current = true;
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      // Auto-prefill loan amount if RATE_REDUCTION skipped step 3 — use existing balance + closing costs
      if (isRateReduction && inputs.loanAmount <= 0) {
        update("loanAmount", Math.round((inputs.existBalance + DEFAULT_CLOSING_COSTS) / 100) * 100);
      }
      if (inputs.loanAmount <= 0) {
        toast({ title: "Enter a loan amount", description: "Set the new loan amount to see results.", variant: "destructive" });
        return;
      }
      if (inputs.loanRate <= 0) {
        toast({ title: "Enter the new rate", description: "Set the new interest rate to continue.", variant: "destructive" });
        return;
      }
      setStep(5);
      return;
    }
    // Step 5 (contact) advances via submitContact, not next()
  }

  function back() {
    if (!isCalc) {
      if (step === 5) { setStep(1); return; }
      return;
    }
    if (step === 5) { setStep(4); return; }
    if (step === 4) { setStep(isRateReduction ? 2 : 3); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setStep(1); return; }
  }

  /**
   * Step 5 submission: validate contact, POST full funnel payload to
   * LeadMailbox, auto-generate + email the worksheet PDF to the lead's
   * inbox (calc products only), then redirect to /whats-next.
   */
  async function submitContact() {
    const first = contact.firstName.trim();
    const last = contact.lastName.trim();
    const email = contact.email.trim();
    const mobile = contact.mobile.trim();
    if (!first || !last) {
      toast({ title: "Name required", description: "Please enter your first and last name.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Valid email required", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    // Mobile is optional, matching the other 4 contact forms. Only validate
    // the format when something was typed — empty submits cleanly through.
    const mobileDigits = mobile.replace(/\D/g, "").length;
    if (mobileDigits > 0 && mobileDigits < 10) {
      toast({ title: "Valid mobile required", description: "Please enter a 10-digit mobile number or leave it blank.", variant: "destructive" });
      return;
    }
    setIsSubmittingContact(true);

    // Snapshot every captured answer for LeadMailbox Notes
    const debtSum = inputs.debts.reduce((s, d) => s + d.balance, 0);
    const funnelAnswers: Record<string, string | number | boolean | null | undefined> = {
      "Product": entryButton ?? inputs.productType,
      "Has-Existing-Mortgage": isCalc ? (inputs.hasExistingMortgage ? "Yes" : "No") : undefined,
      "Mortgage-Balance": isCalc && inputs.hasExistingMortgage ? money(inputs.existBalance) : undefined,
      "Monthly-Payment-PITI": isCalc && inputs.hasExistingMortgage ? money(inputs.existTotalPayment) : undefined,
      "Existing-Rate": isCalc && inputs.existRate ? `${inputs.existRate}%` : undefined,
      "Goal": isCalc ? inputs.goal ?? undefined : undefined,
      "Debt-Entry-Mode": isCalc && inputs.debts.length ? (debtMode === "bulk" ? "Total" : "Itemized") : undefined,
      "Debt-Count": isCalc && inputs.debts.length && debtMode === "itemized" ? inputs.debts.length : undefined,
      "Total-Debt-Balance": isCalc && inputs.debts.length ? money(debtSum) : undefined,
      "Home-Improvement-Amount": isCalc && inputs.homeImprovementAmount ? money(inputs.homeImprovementAmount) : undefined,
      "Cash-Back-Amount": isCalc && inputs.cashBack ? money(inputs.cashBack) : undefined,
      "New-Loan-Amount": isCalc && inputs.loanAmount ? money(inputs.loanAmount) : undefined,
      "New-Loan-Rate": isCalc && inputs.loanRate ? `${inputs.loanRate}%` : undefined,
      "Loan-Structure": isCalc ? STRUCTURE_LABELS[inputs.loanStructure] : undefined,
      "Term-Years": isCalc ? inputs.termYears : undefined,
      // Purchase-path answers (non-calc tailored mini-flow)
      "Purchase-Price-Range": entryButton === "purchase" ? purchaseInfo.priceRange || undefined : undefined,
      "Purchase-Down-Payment": entryButton === "purchase" ? purchaseInfo.downPayment || undefined : undefined,
      "Purchase-Timeline": entryButton === "purchase" ? purchaseInfo.timeline || undefined : undefined,
      "Purchase-First-Time-Buyer": entryButton === "purchase" ? purchaseInfo.firstTime || undefined : undefined,
    };

    const result = await submitFunnelCompletion({
      firstName: first,
      lastName: last,
      email,
      phone: mobile,
      entryButton: entryButton ?? "cash-out",
      turnstile_token: consentState.turnstile_token,
      consent: consentState.consent,
      consent_version: consentState.consent_version,
      consent_text: consentState.consent_text,
      funnelAnswers,
    });

    if (!result.success) {
      setIsSubmittingContact(false);
      toast({
        title: "Submission issue",
        description: result.error ?? "Couldn't send your info — try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    tracker?.formSubmit();

    // Persist trimmed contact (so /whats-next can read the firstName for personal banner)
    setContact({ firstName: first, lastName: last, email, mobile });

    // Calc products (cash-out, rate-reduction) get the Quick Quote auto-emailed
    // — the same two-option estimate (cash-out refi at 80% LTV + HELOC at 90%)
    // the /heloc-v3 funnel sends, BCC'd to Mykoal. Fire-and-forget: the lead is
    // already captured above, and sendAutoQuote no-ops when there isn't enough
    // equity to quote. The Loan Benefits Worksheet PDF is internal-only — Mykoal
    // sends it by hand from /worksheet/internal — so it is NOT emailed here.
    const isCalcProduct =
      isCalc && entryButton !== "heloc" && entryButton !== "purchase";
    if (isCalcProduct) {
      void sendAutoQuote({
        firstName: first,
        lastName: last,
        email,
        homeValue: inputs.homeValue,
        balance: inputs.existBalance,
        // The worksheet funnel doesn't ask for a credit range, so we pass
        // "unsure": the quote still shows equity/amounts, just no rate line
        // (honest — we didn't collect credit on this path).
        creditId: "unsure",
      });
    }

    setIsSubmittingContact(false);

    // Cash-Out / Rate-Reduction / Purchase all hand off to the LendingPad
    // guest application via the shared 3-second countdown page. (HELOC and
    // home-equity never reach here — they run the dedicated /heloc-v3 funnel.)
    const product = entryButton ?? "cash-out";
    const params = new URLSearchParams({
      product,
      source: isCalcProduct ? "worksheet" : "funnel-professional",
      utm_source: "funnel",
      utm_medium: "contact-submit",
      utm_campaign: "direct-to-application",
    });
    if (first) params.set("name", first);
    setLocation(`/application-next?${params.toString()}`);
  }

  // When entering step 4 for RATE_REDUCTION, auto-prefill once
  useEffect(() => {
    if (step === 4 && isRateReduction && inputs.loanAmount <= 0 && inputs.existBalance > 0) {
      update("loanAmount", Math.round((inputs.existBalance + DEFAULT_CLOSING_COSTS) / 100) * 100);
      initialPrefillRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isRateReduction]);

  // Keep the stored loan amount in sync with the live auto-fill whenever the
  // user is on step 4 and the field is locked. This handles the case where
  // they go back to step 2/3, adjust an upstream answer, and return — the
  // locked display already shows the live value; this ensures the actual
  // submitted value matches.
  useEffect(() => {
    if (step !== 4 || !lockedLoanAmount) return;
    const wantsDebt = inputs.goal === "DEBT" || inputs.goal === "BOTH";
    const wantsImprovement = inputs.goal === "IMPROVEMENT" || inputs.goal === "BOTH";
    const wantsOther = inputs.goal === "OTHER";
    const debtSum = inputs.debts.reduce((s, d) => s + d.balance, 0);
    const closing = inputs.closingCosts || DEFAULT_CLOSING_COSTS;
    const auto = Math.round((
      (inputs.hasExistingMortgage ? inputs.existBalance : 0) +
      (wantsDebt ? debtSum : 0) +
      (wantsImprovement ? inputs.homeImprovementAmount : 0) +
      (wantsOther ? inputs.cashBack : 0) +
      closing
    ) / 100) * 100;
    if (inputs.loanAmount !== auto) {
      update("loanAmount", auto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step, lockedLoanAmount,
    inputs.hasExistingMortgage, inputs.existBalance,
    inputs.goal, inputs.debts, inputs.homeImprovementAmount,
    inputs.cashBack, inputs.closingCosts,
  ]);

  // ── Step renderers ────────────────────────────────────────────────────────
  function renderStep1() {
    // Strategy picker. Cash-Out / Rate-Reduction / Purchase select in place
    // (highlight, then Continue advances); Home Equity has its own dedicated
    // /heloc-v3 funnel, so its card navigates away. The current product (from
    // a direct /cash-out visit) is pre-highlighted.
    const cards: { entry: FunnelEntryButton; productType: ProductType | null; href?: string; title: string; desc: string }[] = [
      { entry: "cash-out", productType: "CASH_OUT", title: "Cash-Out Refinance", desc: "Replace your current mortgage and pull cash to consolidate debt or fund improvements." },
      { entry: "rate-reduction", productType: "RATE_REDUCTION", title: "Rate Reduction Refinance", desc: "Lower your existing mortgage rate and redirect savings to principal." },
      { entry: "purchase", productType: null, title: "Purchase", desc: "Buy a home or investment property — get pre-approved so you can shop with confidence." },
      { entry: "home-equity", productType: null, href: "/heloc-v3", title: "Home Equity / 2nd Mortgage", desc: "Keep your low-rate first mortgage; add a second mortgage or HELOC for cash or debt consolidation." },
    ];
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">What are you trying to do?</h2>
          <p className="text-muted-foreground text-sm">Pick the strategy you want to explore.</p>
        </div>
        <div className="grid gap-3">
          {cards.map((c) => {
            const selected = entryButton === c.entry;
            return (
              <button
                key={c.entry}
                type="button"
                onClick={() => {
                  // Home Equity runs the dedicated HELOC funnel.
                  if (c.href) { setLocation(c.href); return; }
                  setEntryButton(c.entry);
                  if (c.productType) {
                    update("productType", c.productType);
                    if (c.entry === "rate-reduction") update("hasExistingMortgage", true);
                  }
                }}
                className={`text-left rounded-lg border-2 p-4 transition-all ${
                  selected ? "border-accent bg-accent/5 shadow-sm" : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-accent bg-accent" : "border-muted-foreground/30"}`}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <div className="font-semibold text-primary">{c.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{c.desc}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {/* Purchase selected → show its tailored questions inline beneath the
            picker (Continue then goes straight to contact). */}
        {entryButton === "purchase" && renderPurchaseQuestions()}
      </div>
    );
  }

  function renderStep2() {
    const showMortgageGate = inputs.productType !== "RATE_REDUCTION";
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">Tell us about your current mortgage</h2>
          <p className="text-muted-foreground text-sm">Just the basics — answer what you know.</p>
        </div>

        <NumberField
          label="Estimated Home Value"
          value={inputs.homeValue}
          onChange={(v) => update("homeValue", v)}
          prefix="$"
          placeholder="500,000"
          hint="Your best estimate is fine — it lets us size your quote."
        />

        {showMortgageGate && (
          <div className="space-y-2.5">
            <Label className="text-sm font-medium">Do you have an existing mortgage?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <BigChoiceCard
                selected={inputs.hasExistingMortgage === true}
                onClick={() => update("hasExistingMortgage", true)}
                title="Yes"
              />
              <BigChoiceCard
                selected={inputs.hasExistingMortgage === false}
                onClick={() => update("hasExistingMortgage", false)}
                title="No — free and clear"
              />
            </div>
          </div>
        )}

        {inputs.hasExistingMortgage && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <NumberField
                label="Current Mortgage Balance"
                value={inputs.existBalance}
                onChange={(v) => update("existBalance", v)}
                prefix="$"
                placeholder="350,000"
                hint="What you still owe."
              />
              <NumberField
                label="Total Monthly Payment (PITI)"
                value={inputs.existTotalPayment}
                onChange={(v) => update("existTotalPayment", v)}
                prefix="$"
                placeholder="2,400"
                hint="Full payment including taxes & insurance."
              />
            </div>

            <KnowsItField
              question="Do you know your current interest rate?"
              knows={knowsRate}
              onKnowsChange={(b) => {
                setKnowsRate(b);
                if (!b) update("existRate", 0);
              }}
              fieldLabel="Current Interest Rate"
              value={inputs.existRate}
              onChange={(v) => update("existRate", v)}
              suffix="%"
              placeholder="6.5"
              step={0.001}
            />

            <KnowsItField
              question="Do you know your monthly escrow?"
              knows={knowsEscrow}
              onKnowsChange={(b) => {
                setKnowsEscrow(b);
                if (!b) update("existEscrow", 0);
              }}
              fieldLabel="Monthly Escrow"
              value={inputs.existEscrow}
              onChange={(v) => update("existEscrow", v)}
              prefix="$"
              placeholder="450"
            />

            <KnowsItField
              question="Do you know how many years are left on the loan?"
              knows={knowsYears}
              onKnowsChange={(b) => {
                setKnowsYears(b);
                if (!b) update("existYearsRemaining", 0);
              }}
              fieldLabel="Years Remaining"
              value={inputs.existYearsRemaining}
              onChange={(v) => update("existYearsRemaining", v)}
              suffix="yrs"
              placeholder="25"
            />
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    const wantsDebt = inputs.goal === "DEBT" || inputs.goal === "BOTH";
    const wantsImprovement = inputs.goal === "IMPROVEMENT" || inputs.goal === "BOTH";
    const wantsOther = inputs.goal === "OTHER";

    const goalOptions: { v: Exclude<Goal, null>; t: string }[] = [
      { v: "DEBT", t: "Pay off debt" },
      { v: "IMPROVEMENT", t: "Home improvement" },
      { v: "BOTH", t: "Both" },
      { v: "OTHER", t: "Other" },
    ];

    function pickGoal(v: Exclude<Goal, null>) {
      update("goal", v);
      // Auto-seed the first itemized row when entering a debt-consuming goal.
      if ((v === "DEBT" || v === "BOTH") && debtMode === "itemized" && inputs.debts.length === 0) {
        update("debts", [{ name: "Debt 1", balance: 0, payment: 0 }]);
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">What do you want to do with the funds?</h2>
          <p className="text-muted-foreground text-sm">Choose what fits.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {goalOptions.map((opt) => {
            const selected = inputs.goal === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => pickGoal(opt.v)}
                className={`rounded-lg border-2 p-4 text-center transition-all min-h-[68px] ${
                  selected ? "border-accent bg-accent/5 shadow-sm" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <div className="font-semibold text-primary text-sm leading-tight">{opt.t}</div>
              </button>
            );
          })}
        </div>

        {wantsOther && (
          <NumberField
            label="How much cash do you want?"
            value={inputs.cashBack}
            onChange={(v) => update("cashBack", v)}
            prefix="$"
            placeholder="50,000"
            hint="Total cash you'd like to walk away with."
          />
        )}

        {wantsDebt && (
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Label className="text-sm font-medium">How do you want to enter your debts?</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <BigChoiceCard
                  selected={debtMode === "itemized"}
                  onClick={() => {
                    if (debtMode === "itemized") return;
                    setDebtMode("itemized");
                    // Discard bulk total — start fresh with one row.
                    update("debts", [{ name: "Debt 1", balance: 0, payment: 0 }]);
                  }}
                  title="Add debts manually"
                  description="Itemize each creditor."
                />
                <BigChoiceCard
                  selected={debtMode === "bulk"}
                  onClick={() => {
                    if (debtMode === "bulk") return;
                    setDebtMode("bulk");
                    // Discard itemized — start fresh with one synthetic total row.
                    update("debts", [{ name: "Total debt", balance: 0, payment: 0 }]);
                  }}
                  title="List total debt"
                  description="One total balance & payment."
                />
              </div>
            </div>

            {debtMode === "itemized" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Debts to consolidate</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextIdx = inputs.debts.length + 1;
                      update("debts", [...inputs.debts, { name: `Debt ${nextIdx}`, balance: 0, payment: 0 }]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add debt
                  </Button>
                </div>
                <div className="space-y-2">
                  {inputs.debts.map((d, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 text-sm font-semibold text-primary px-1 py-1.5 truncate">
                        {d.name || `Debt ${i + 1}`}
                      </div>
                      <div className="col-span-3 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="pl-6"
                          placeholder="Balance"
                          value={d.balance || ""}
                          onChange={(e) => {
                            const next = [...inputs.debts];
                            next[i] = { ...next[i], balance: Number(e.target.value || 0) };
                            update("debts", next);
                          }}
                        />
                      </div>
                      <div className="col-span-4 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="pl-6"
                          placeholder="Min pmt"
                          value={d.payment || ""}
                          onChange={(e) => {
                            const next = [...inputs.debts];
                            next[i] = { ...next[i], payment: Number(e.target.value || 0) };
                            update("debts", next);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1 h-9 w-9 text-muted-foreground hover:text-destructive"
                        disabled={inputs.debts.length === 1}
                        onClick={() => {
                          const next = inputs.debts
                            .filter((_, idx) => idx !== i)
                            .map((row, idx) =>
                              row.name && row.name.startsWith("Debt ")
                                ? { ...row, name: `Debt ${idx + 1}` }
                                : row,
                            );
                          update("debts", next);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <NumberField
                  label="Total debt balance"
                  value={inputs.debts[0]?.balance ?? 0}
                  onChange={(v) =>
                    update("debts", [
                      { name: "Total debt", balance: v, payment: inputs.debts[0]?.payment ?? 0 },
                    ])
                  }
                  prefix="$"
                  placeholder="35,000"
                />
                <NumberField
                  label="Total minimum payment"
                  value={inputs.debts[0]?.payment ?? 0}
                  onChange={(v) =>
                    update("debts", [
                      { name: "Total debt", balance: inputs.debts[0]?.balance ?? 0, payment: v },
                    ])
                  }
                  prefix="$"
                  placeholder="850"
                />
              </div>
            )}
          </div>
        )}

        {wantsImprovement && (
          <NumberField
            label="Home improvement amount"
            value={inputs.homeImprovementAmount}
            onChange={(v) => update("homeImprovementAmount", v)}
            prefix="$"
            placeholder="40,000"
            hint="How much cash you'd like for projects."
          />
        )}
      </div>
    );
  }

  function renderStep4() {
    // Live auto-fill — always reflects upstream answers. Used as the locked
    // display value and as the snap-back when the user re-locks the field.
    const wantsDebt = inputs.goal === "DEBT" || inputs.goal === "BOTH";
    const wantsImprovement = inputs.goal === "IMPROVEMENT" || inputs.goal === "BOTH";
    const wantsOther = inputs.goal === "OTHER";
    const debtSum = inputs.debts.reduce((s, d) => s + d.balance, 0);
    const closingCostsValue = inputs.closingCosts || DEFAULT_CLOSING_COSTS;
    const autoLoanAmount = Math.round((
      (inputs.hasExistingMortgage ? inputs.existBalance : 0) +
      (wantsDebt ? debtSum : 0) +
      (wantsImprovement ? inputs.homeImprovementAmount : 0) +
      (wantsOther ? inputs.cashBack : 0) +
      closingCostsValue
    ) / 100) * 100;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">Set up the new loan</h2>
          <p className="text-muted-foreground text-sm">
            Pre-filled from your answers — tap <span className="inline-flex items-center gap-0.5"><Pencil className="h-3 w-3" /> Edit</span> on any field to override.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <LockedField
            label="New loan amount"
            locked={lockedLoanAmount}
            onToggleLock={(l) => {
              setLockedLoanAmount(l);
              // Re-locking snaps back to the live auto-fill so locked = auto.
              if (l) update("loanAmount", autoLoanAmount);
            }}
            displayValue={money(lockedLoanAmount ? autoLoanAmount : inputs.loanAmount)}
          >
            <NumberField
              label=""
              value={inputs.loanAmount}
              onChange={(v) => update("loanAmount", v)}
              prefix="$"
              placeholder="400,000"
              hint="Existing balance + debts/improvements/cash + closing costs."
            />
          </LockedField>

          <LockedField
            label="New interest rate"
            locked={lockedLoanRate}
            onToggleLock={(l) => {
              setLockedLoanRate(l);
              if (l) update("loanRate", DEFAULT_NEW_LOAN_RATE);
            }}
            displayValue={`${(lockedLoanRate ? DEFAULT_NEW_LOAN_RATE : inputs.loanRate) || DEFAULT_NEW_LOAN_RATE}%`}
          >
            <NumberField
              label=""
              value={inputs.loanRate}
              onChange={(v) => update("loanRate", v)}
              suffix="%"
              step={0.001}
              placeholder={String(DEFAULT_NEW_LOAN_RATE)}
              hint={`Default ${DEFAULT_NEW_LOAN_RATE}%. Use the rate you've been quoted.`}
            />
          </LockedField>

          <LockedField
            label="Estimated closing costs"
            locked={lockedClosingCosts}
            onToggleLock={(l) => {
              setLockedClosingCosts(l);
              if (l) update("closingCosts", DEFAULT_CLOSING_COSTS);
            }}
            displayValue={money(lockedClosingCosts ? DEFAULT_CLOSING_COSTS : (inputs.closingCosts || DEFAULT_CLOSING_COSTS))}
          >
            <NumberField
              label=""
              value={inputs.closingCosts}
              onChange={(v) => update("closingCosts", v)}
              prefix="$"
              placeholder={String(DEFAULT_CLOSING_COSTS)}
              hint={`APR is auto-calculated from this. Default ${money(DEFAULT_CLOSING_COSTS)}.`}
            />
          </LockedField>

          <LockedField
            label="Term"
            locked={lockedTerm}
            onToggleLock={(l) => setLockedTerm(l)}
            displayValue={`${inputs.termYears} years`}
          >
            <Select
              value={String(inputs.termYears)}
              onValueChange={(v) => update("termYears", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 years</SelectItem>
                <SelectItem value="20">20 years</SelectItem>
                <SelectItem value="30">30 years</SelectItem>
              </SelectContent>
            </Select>
          </LockedField>

          <div className="sm:col-span-2">
            <LockedField
              label="Loan structure"
              locked={lockedStructure}
              onToggleLock={(l) => setLockedStructure(l)}
              displayValue={STRUCTURE_LABELS[inputs.loanStructure]}
            >
              <Select
                value={inputs.loanStructure}
                onValueChange={(v) => update("loanStructure", v as LoanStructure)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(STRUCTURE_LABELS) as [LoanStructure, string][]).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LockedField>
            {inputs.loanStructure !== "FIXED" && !lockedStructure && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                ARM and Interest-Only loans have different long-term behavior. The illustration assumes the
                initial rate stays constant — actual payments may adjust later. See full disclaimer on the PDF.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderNonCalcIntro() {
    const isHeloc = entryButton === "heloc";
    const isPurchase = entryButton === "purchase";
    const Icon = isPurchase ? HomeIcon : Calculator;
    const title = isHeloc
      ? "Let's get you matched with the right HELOC"
      : isPurchase
      ? "Let's get you pre-approved"
      : "Let's get you started";
    const desc = isHeloc
      ? "We'll connect you with our top instant-quote HELOC partners and Mykoal will personally follow up to help you compare the offers."
      : isPurchase
      ? "Mykoal will build you a personal pre-approval game plan — what you can afford, what programs fit, and the smartest way to structure your offer."
      : "Tell us a little about what you're looking for.";
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <Icon className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-primary mb-1">{title}</h2>
            <p className="text-muted-foreground text-sm">{desc}</p>
          </div>
        </div>
        {isPurchase && renderPurchaseQuestions()}
        <div className="rounded-lg bg-muted/40 border p-4 text-sm">
          <div className="font-semibold text-primary mb-1">What happens next:</div>
          <ul className="text-muted-foreground space-y-1 list-disc list-inside">
            <li>Share your name, email, and mobile (one quick step)</li>
            <li>Mykoal personally reviews and reaches out within 1 business day</li>
            <li>Free, no obligation, no credit pull</li>
          </ul>
        </div>
      </div>
    );
  }

  // Tailored purchase questions (rendered inside the purchase intro step). Pure
  // single-select pills — fast on mobile, no calc, all optional but encouraged.
  function renderPurchaseQuestions() {
    const groups: { key: keyof PurchaseInfo; label: string; options: string[] }[] = [
      { key: "priceRange", label: "Target price range", options: ["Under $300k", "$300k–$500k", "$500k–$750k", "$750k–$1M", "$1M+"] },
      { key: "downPayment", label: "Down payment ready", options: ["Under 5%", "5–10%", "10–20%", "20%+", "Not sure yet"] },
      { key: "timeline", label: "When are you looking to buy?", options: ["ASAP", "1–3 months", "3–6 months", "Just exploring"] },
      { key: "firstTime", label: "First-time buyer?", options: ["Yes", "No"] },
    ];
    return (
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            <Label className="text-sm font-semibold text-primary">{g.label}</Label>
            <div className="flex flex-wrap gap-2">
              {g.options.map((opt) => {
                const selected = purchaseInfo[g.key] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPurchaseInfo((p) => ({ ...p, [g.key]: opt }))}
                    className={`rounded-full border-2 px-3.5 py-2 text-sm font-medium transition-all ${
                      selected ? "border-accent bg-accent/5 text-accent" : "border-border text-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderStep5Contact() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">Almost done — where should we send your quote?</h2>
          <p className="text-muted-foreground text-sm">
            Mykoal personally reviews every lead. We never sell your info or spam you.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cf-first">First name</Label>
            <Input
              id="cf-first"
              value={contact.firstName}
              onChange={(e) => updateContact({ firstName: e.target.value })}
              onFocus={handleFormStart}
              placeholder="Jane"
              autoComplete="given-name"
              data-testid="contact-first-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-last">Last name</Label>
            <Input
              id="cf-last"
              value={contact.lastName}
              onChange={(e) => updateContact({ lastName: e.target.value })}
              placeholder="Smith"
              autoComplete="family-name"
              data-testid="contact-last-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-email">Email</Label>
          <Input
            id="cf-email"
            type="email"
            value={contact.email}
            onChange={(e) => updateContact({ email: e.target.value })}
            placeholder="jane@example.com"
            autoComplete="email"
            data-testid="contact-email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-mobile">Mobile phone</Label>
          <Input
            id="cf-mobile"
            type="tel"
            value={contact.mobile}
            onChange={(e) => updateContact({ mobile: e.target.value })}
            placeholder="(555) 123-4567"
            autoComplete="tel"
            data-testid="contact-mobile"
          />
        </div>
        <TcpaConsent onChange={setConsentState} />
        <p className="text-[11px] text-muted-foreground">
          Mykoal DeShazo · NMLS #1912347 · Adaxa Home, LLC · NMLS #2380533 · Equal Housing Opportunity
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const vStep = visibleStep(step);

  // Per-product SEO. Each canonical product funnel is indexable at its clean
  // URL (carrying the SEO from the retired /cash-out-refi etc. landers); the
  // bare /see-my-options picker stays noIndex.
  const META: Record<string, { title: string; description: string; canonical: string }> = {
    "cash-out": {
      title: "Cash-Out Refinance | Mykoal DeShazo at Adaxa Home",
      description: "Pull cash from your home equity with a cash-out refinance from Mykoal DeShazo at Adaxa Home. See your options in minutes, no credit pull. NMLS #1912347.",
      canonical: "/cash-out",
    },
    "rate-reduction": {
      title: "Rate Reduction Refinance | Mykoal DeShazo at Adaxa Home",
      description: "Lower your mortgage rate and monthly payment with a rate-reduction refinance from Mykoal DeShazo at Adaxa Home. NMLS #1912347.",
      canonical: "/rate-reduction",
    },
    purchase: {
      title: "Home Purchase Pre-Approval | Mykoal DeShazo at Adaxa Home",
      description: "Get pre-approved to buy a home with Mykoal DeShazo at Adaxa Home. Know what you can afford and shop with confidence. NMLS #1912347.",
      canonical: "/purchase",
    },
  };
  const meta = (entryButton && META[entryButton]) || {
    title: "See My Options | Mykoal DeShazo at Adaxa Home",
    description: "See exactly how the right loan strategy could lower your monthly payment, eliminate interest, and get you debt-free years sooner.",
    canonical: "/see-my-options",
  };

  return (
    <>
      <PageMeta
        title={meta.title}
        description={meta.description}
        canonical={meta.canonical}
        noIndex={!entryButton}
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        {/* Brand type: Plus Jakarta Sans body + Bricolage Grotesque headings,
            matching the /heloc-v3 funnel. Scoped to the funnel content so the
            shared Header/Footer keep the site default. */}
        <main className="flex-1 container mx-auto max-w-3xl px-4 py-8 font-body [&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h4]:font-heading">
          <TopBar step={vStep} totalSteps={totalSteps} onStartOver={handleStartOver} />
          <Progress step={vStep} total={totalSteps} />

          <div className="bg-card border rounded-2xl shadow-md p-6 sm:p-8">
            {/* Step 1: the strategy picker for everyone (Purchase renders its
                tailored questions inline). HELOC is the only product that uses
                the legacy confirmation intro, and it normally runs /heloc-v3. */}
            {step === 1 && (entryButton === "heloc" ? renderNonCalcIntro() : renderStep1())}
            {step === 2 && isCalc && renderStep2()}
            {step === 3 && isCalc && renderStep3()}
            {step === 4 && isCalc && renderStep4()}
            {step === 5 && renderStep5Contact()}

            {/* Button bar: input steps 1-4 → Continue; step 5 → Submit (handled below).
                The bare /see-my-options picker (step 1, no product yet) hides the
                bar — each card navigates to its product, so there's nothing to
                "continue" until a strategy is chosen. */}
            {step <= 4 && !(step === 1 && !entryButton) && (
              <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t">
                <Button variant="ghost" onClick={back} disabled={step === 1}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={() => { tracker?.primaryCtaClick(); next(); }} className="bg-accent hover:bg-accent/90 text-white">
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
            {step === 5 && (
              <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t">
                <Button variant="ghost" onClick={back} disabled={isSubmittingContact}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={submitContact}
                  disabled={isSubmittingContact || !consentState.ready}
                  className="bg-accent hover:bg-accent/90 text-white"
                  data-testid="submit-contact"
                >
                  {isSubmittingContact ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending your worksheet…</>
                  ) : (
                    <>Submit My Info <ArrowRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            )}
            {step === 5 && <TcpaSubmitNotice />}
          </div>
        </main>

        {/* FAQ + trust + compliance — only on the indexable per-product routes
            (cash-out, rate-reduction). Below the funnel card, never above the
            fold; FunnelFAQ emits the matching FAQPage schema. */}
        {faqConfig && (
          <>
            <section className="container mx-auto max-w-3xl px-4 pb-4 font-body [&_h2]:font-heading [&_h3]:font-heading">
              <FunnelFAQ items={faqConfig.items} guideLinks={faqConfig.guideLinks} track={tracker ?? undefined} />
              <div className="mt-10 text-center">
                <Button
                  onClick={() => {
                    tracker?.secondaryCtaClick();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-accent hover:bg-accent/90 text-white h-12 px-8 text-base"
                >
                  {entryButton === "cash-out" ? "See My Cash-Out Options" : "See My Rate Reduction Options"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </section>
            <section className="container mx-auto max-w-3xl px-4 py-10">
              <TrustBlock />
            </section>
            <ComplianceFooter />
          </>
        )}

        <Footer />
      </div>
    </>
  );
}


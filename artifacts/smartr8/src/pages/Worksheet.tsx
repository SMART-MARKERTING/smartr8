import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowLeft, ArrowRight, RotateCcw, Plus, Trash2, Check, Mail, Pencil,
  Calculator, Handshake, Loader2, Briefcase, Home as HomeIcon,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import WorksheetDocument from "@/components/worksheet/WorksheetDocument";
import ExportLeadModal from "@/components/worksheet/ExportLeadModal";
import {
  computeScenarios,
  makeDefaultInputs,
  money,
  PRODUCT_LABELS,
  PRODUCT_LABELS_SHORT,
  STRUCTURE_LABELS,
  type WorksheetInputs,
  type ProductType,
  type Goal,
  type LoanStructure,
  DEFAULT_NEW_LOAN_RATE,
  DEFAULT_CLOSING_COSTS,
} from "@/lib/worksheetCalc";
import { submitFunnelCompletion, type FunnelEntryButton } from "@/lib/submitLead";

const STORAGE_KEY = "smartr8_worksheet_funnel_v2";
const STEP_KEY = "smartr8_worksheet_funnel_step_v2";
const CONTACT_KEY = "smartr8_funnel_contact_v1";
const ENTRY_KEY = "smartr8_funnel_entry_v1";

// Step machinery for the unified funnel.
// Calc products (CASH_OUT/RATE_REDUCTION/HOME_EQUITY) use 1-7.
// Non-calc products (heloc/purchase) jump from Step 1 → Step 5 → redirect.
// 1 = product   2 = mortgage   3 = goals/debts   4 = loan details
// 5 = contact info (LM submit happens on 5→6 transition)
// 6 = fork screen (Build It Yourself vs Professional)
// 7 = results (only reached via fork "Build It Yourself")
type FunnelStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  tcpa: boolean;
}

function emptyContact(): ContactInfo {
  return { firstName: "", lastName: "", email: "", mobile: "", tcpa: false };
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
    if (n >= 1 && n <= 7) return n as FunnelStep;
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
  step?: number;
  optional?: boolean;
  hint?: string;
  min?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label} {optional && <span className="text-muted-foreground font-normal text-xs">(optional)</span>}
      </Label>
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
          placeholder={placeholder}
          value={value ? value : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? 0 : Number(v));
          }}
          className={prefix ? "pl-7" : ""}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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

export default function Worksheet() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [inputs, setInputs] = useState<WorksheetInputs>(loadInputs);
  const [step, setStep] = useState<FunnelStep>(loadStep);
  const [exportOpen, setExportOpen] = useState(false);
  const [editing, setEditing] = useState(false); // when on results, allow inline edit of inputs for adjustment
  const [contact, setContact] = useState<ContactInfo>(loadContact);
  const [entryButton, setEntryButton] = useState<FunnelEntryButton | null>(
    () => parseEntryFromUrl(search) ?? loadEntry(),
  );
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const { toast } = useToast();
  const initialPrefillRef = useRef(false);

  const results = useMemo(() => computeScenarios(inputs), [inputs]);

  useEffect(() => { saveInputs(inputs); }, [inputs]);
  useEffect(() => { saveStep(step); }, [step]);
  useEffect(() => { saveContact(contact); }, [contact]);
  useEffect(() => { saveEntry(entryButton); }, [entryButton]);

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
  // Visible step counts:
  //   non-calc (heloc/purchase): 2 visible steps (intro → contact)
  //   calc + RATE_REDUCTION:     4 visible steps (product, mortgage, loan, contact)
  //   calc + other:              5 visible steps (product, mortgage, goals, loan, contact)
  const totalSteps = !isCalc ? 2 : isRateReduction ? 4 : 5;

  // Map logical FunnelStep (1-7) to the visible progress index (1-totalSteps).
  // Steps 6 (fork) and 7 (results) sit beyond the progress bar.
  function visibleStep(s: FunnelStep): number {
    if (!isCalc) {
      if (s >= 5) return 2;
      return 1;
    }
    if (s === 5) return isRateReduction ? 4 : 5;
    if (s === 6 || s === 7) return totalSteps;
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
    setEditing(false);
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
      if (wantsDebt && inputs.debts.length === 0) {
        toast({ title: "Add at least one debt", description: "List the debts you want to consolidate.", variant: "destructive" });
        return;
      }
      if (wantsImprovement && inputs.homeImprovementAmount <= 0) {
        toast({ title: "Add an improvement amount", description: "Enter how much you want for home improvements.", variant: "destructive" });
        return;
      }
      // Auto-prefill loan amount when first arriving at step 4
      const debtSum = inputs.debts.reduce((s, d) => s + d.balance, 0);
      const prefill = (inputs.hasExistingMortgage ? inputs.existBalance : 0) +
        (wantsDebt ? debtSum : 0) +
        (wantsImprovement ? inputs.homeImprovementAmount : 0) +
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
    if (step === 5) { setStep(4); setEditing(false); return; }
    if (step === 4) { setStep(isRateReduction ? 2 : 3); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setStep(1); return; }
  }

  /**
   * Step 5 → 6: validate contact, POST full funnel payload to LeadMailbox.
   * On success: calc products advance to the fork (Step 6); non-calc products
   * skip the fork and go directly to /whats-next professional path.
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
    if (mobile.replace(/\D/g, "").length < 10) {
      toast({ title: "Mobile required", description: "Please enter a 10-digit mobile number so Mykoal can reach you.", variant: "destructive" });
      return;
    }
    if (!contact.tcpa) {
      toast({ title: "Consent required", description: "Please check the box agreeing to be contacted.", variant: "destructive" });
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
      "Debt-Count": isCalc && inputs.debts.length ? inputs.debts.length : undefined,
      "Total-Debt-Balance": isCalc && inputs.debts.length ? money(debtSum) : undefined,
      "Home-Improvement-Amount": isCalc && inputs.homeImprovementAmount ? money(inputs.homeImprovementAmount) : undefined,
      "New-Loan-Amount": isCalc && inputs.loanAmount ? money(inputs.loanAmount) : undefined,
      "New-Loan-Rate": isCalc && inputs.loanRate ? `${inputs.loanRate}%` : undefined,
      "Loan-Structure": isCalc ? STRUCTURE_LABELS[inputs.loanStructure] : undefined,
      "Term-Years": isCalc ? inputs.termYears : undefined,
    };

    const result = await submitFunnelCompletion({
      firstName: first,
      lastName: last,
      email,
      phone: mobile,
      entryButton: entryButton ?? "cash-out",
      funnelAnswers,
    });

    setIsSubmittingContact(false);

    if (!result.success) {
      toast({
        title: "Submission issue",
        description: result.error ?? "Couldn't send your info — try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    // Persist trimmed contact (so /whats-next can read the firstName for personal banner)
    setContact({ firstName: first, lastName: last, email, mobile, tcpa: contact.tcpa });

    // All products — calc and non-calc — reach the fork screen.
    setStep(6);
  }

  function handleForkSelfBuild() {
    // HELOC and Purchase have no savings worksheet — route them to the best
    // available self-directed destination instead of the calc results screen.
    if (entryButton === "heloc") {
      const params = new URLSearchParams();
      if (contact.firstName) params.set("name", contact.firstName);
      const qs = params.toString();
      setLocation(`/heloc/instant-options${qs ? `?${qs}` : ""}`);
      return;
    }
    if (entryButton === "purchase") {
      const params = new URLSearchParams({
        source: "funnel-self",
        utm_source: "funnel",
        utm_medium: "fork",
        utm_campaign: "self-build-path",
      });
      if (contact.firstName) params.set("name", contact.firstName);
      setLocation(`/whats-next?${params.toString()}`);
      return;
    }
    // Calc products — stay in the worksheet and render the results screen.
    setStep(7);
  }

  function handleForkProfessional() {
    const params = new URLSearchParams({
      source: "funnel-professional",
      utm_source: "funnel",
      utm_medium: "fork",
      utm_campaign: "professional-path",
    });
    if (contact.firstName) params.set("name", contact.firstName);
    setLocation(`/whats-next?${params.toString()}`);
  }

  // When entering step 4 for RATE_REDUCTION, auto-prefill once
  useEffect(() => {
    if (step === 4 && isRateReduction && inputs.loanAmount <= 0 && inputs.existBalance > 0) {
      update("loanAmount", Math.round((inputs.existBalance + DEFAULT_CLOSING_COSTS) / 100) * 100);
      initialPrefillRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isRateReduction]);

  // Worksheet summary for lead notes
  const worksheetSummary = useMemo(() => {
    return [
      `Product: ${PRODUCT_LABELS_SHORT[inputs.productType]}`,
      `Structure: ${STRUCTURE_LABELS[inputs.loanStructure]}`,
      inputs.hasExistingMortgage ? `Existing: ${money(inputs.existBalance)} @ ${inputs.existRate || "?"}% (PITI ${money(inputs.existTotalPayment)})` : "No existing mortgage",
      `New: ${money(inputs.loanAmount)} @ ${inputs.loanRate}% / ${inputs.termYears}yr`,
      `Monthly savings: ${money(results.monthlySavings)}`,
      `Interest saved: ${money(results.consolidated.totalInterest - results.accelerated.totalInterest)}`,
    ].join(" | ");
  }, [inputs, results]);

  // ── Step renderers ────────────────────────────────────────────────────────
  function renderStep1() {
    const cards: { value: ProductType; title: string; desc: string }[] = [
      { value: "CASH_OUT", title: "Cash-Out Refinance", desc: "Replace your current mortgage and pull cash to consolidate debt or fund improvements." },
      { value: "RATE_REDUCTION", title: "Rate Reduction Refinance", desc: "Lower your existing mortgage rate and redirect savings to principal." },
      { value: "HOME_EQUITY", title: "Home Equity / 2nd Mortgage", desc: "Keep your low-rate first mortgage; add a second mortgage for cash or debt consolidation." },
    ];
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">What are you trying to do?</h2>
          <p className="text-muted-foreground text-sm">Pick the strategy you want to explore.</p>
        </div>
        <div className="grid gap-3">
          {cards.map((c) => {
            const selected = inputs.productType === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  update("productType", c.value);
                  if (c.value === "RATE_REDUCTION") update("hasExistingMortgage", true);
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
      </div>
    );
  }

  function renderStep2() {
    const showMortgageGate = inputs.productType !== "RATE_REDUCTION";
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">Tell us about your current mortgage</h2>
          <p className="text-muted-foreground text-sm">All fields except the balance and total payment are optional.</p>
        </div>

        {showMortgageGate && (
          <div className="rounded-lg border p-4 bg-muted/30">
            <Label className="text-sm font-medium mb-2 block">Do you have an existing mortgage?</Label>
            <RadioGroup
              value={inputs.hasExistingMortgage ? "yes" : "no"}
              onValueChange={(v) => update("hasExistingMortgage", v === "yes")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="hm-yes" value="yes" />
                <Label htmlFor="hm-yes" className="cursor-pointer font-normal">Yes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="hm-no" value="no" />
                <Label htmlFor="hm-no" className="cursor-pointer font-normal">No — free and clear</Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {inputs.hasExistingMortgage && (
          <div className="grid sm:grid-cols-2 gap-4">
            <NumberField
              label="Current Mortgage Balance"
              value={inputs.existBalance}
              onChange={(v) => update("existBalance", v)}
              placeholder="350000"
              hint="What you still owe."
            />
            <NumberField
              label="Total Monthly Payment (PITI)"
              value={inputs.existTotalPayment}
              onChange={(v) => update("existTotalPayment", v)}
              placeholder="2400"
              hint="Full payment including taxes & insurance."
            />
            <NumberField
              label="Current Interest Rate"
              value={inputs.existRate}
              onChange={(v) => update("existRate", v)}
              prefix=""
              step={0.001}
              optional
              placeholder="6.5"
              hint="Leave blank if unknown."
            />
            <NumberField
              label="Monthly Escrow"
              value={inputs.existEscrow}
              onChange={(v) => update("existEscrow", v)}
              optional
              placeholder="450"
              hint="Taxes & insurance portion. Optional."
            />
            <NumberField
              label="Years Remaining"
              value={inputs.existYearsRemaining}
              onChange={(v) => update("existYearsRemaining", v)}
              prefix=""
              optional
              placeholder="25"
              hint="Approximate years left on your mortgage."
            />
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    const wantsDebt = inputs.goal === "DEBT" || inputs.goal === "BOTH";
    const wantsImprovement = inputs.goal === "IMPROVEMENT" || inputs.goal === "BOTH";
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">What do you want to do with the funds?</h2>
          <p className="text-muted-foreground text-sm">Pick one or both.</p>
        </div>

        <RadioGroup
          value={inputs.goal ?? ""}
          onValueChange={(v) => update("goal", v as Goal)}
          className="grid sm:grid-cols-3 gap-3"
        >
          {([
            { v: "DEBT", t: "Pay off debt" },
            { v: "IMPROVEMENT", t: "Home improvement" },
            { v: "BOTH", t: "Both" },
          ] as const).map((opt) => {
            const selected = inputs.goal === opt.v;
            return (
              <label
                key={opt.v}
                className={`rounded-lg border-2 p-4 text-center cursor-pointer transition-all ${
                  selected ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <RadioGroupItem value={opt.v} className="sr-only" />
                <div className="font-semibold text-primary">{opt.t}</div>
              </label>
            );
          })}
        </RadioGroup>

        {wantsDebt && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Debts to consolidate</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update("debts", [...inputs.debts, { name: "", balance: 0, payment: 0 }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add debt
              </Button>
            </div>
            {inputs.debts.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Click "Add debt" to list each balance you want rolled into the new loan.</p>
            )}
            <div className="space-y-2">
              {inputs.debts.map((d, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-5"
                    placeholder="Creditor (e.g., Chase Visa)"
                    value={d.name}
                    onChange={(e) => {
                      const next = [...inputs.debts];
                      next[i] = { ...next[i], name: e.target.value };
                      update("debts", next);
                    }}
                  />
                  <div className="col-span-3 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
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
                  <div className="col-span-3 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
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
                    onClick={() => {
                      const next = inputs.debts.filter((_, idx) => idx !== i);
                      update("debts", next);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {wantsImprovement && (
          <NumberField
            label="Home improvement amount"
            value={inputs.homeImprovementAmount}
            onChange={(v) => update("homeImprovementAmount", v)}
            placeholder="40000"
            hint="How much cash you'd like for projects."
          />
        )}
      </div>
    );
  }

  function renderStep4() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">Set up the new loan</h2>
          <p className="text-muted-foreground text-sm">
            We've pre-filled with sensible defaults — adjust to match what you've been quoted.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <NumberField
            label="New loan amount"
            value={inputs.loanAmount}
            onChange={(v) => update("loanAmount", v)}
            placeholder="400000"
            hint="Auto-filled from your existing balance + debts + closing costs."
          />
          <NumberField
            label="New interest rate"
            value={inputs.loanRate}
            onChange={(v) => update("loanRate", v)}
            prefix=""
            step={0.001}
            hint={`Default ${DEFAULT_NEW_LOAN_RATE}%. Use the rate you've been quoted.`}
          />
          <NumberField
            label="Estimated closing costs"
            value={inputs.closingCosts}
            onChange={(v) => update("closingCosts", v)}
            hint={`APR is auto-calculated from this. Default ${money(DEFAULT_CLOSING_COSTS)}.`}
          />
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Term</Label>
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
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm font-medium">Loan structure</Label>
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
            {inputs.loanStructure !== "FIXED" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
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
        <div className="flex items-start gap-3 rounded-lg bg-muted/40 border p-4">
          <Checkbox
            id="cf-tcpa"
            checked={contact.tcpa}
            onCheckedChange={(v) => updateContact({ tcpa: v === true })}
            className="mt-0.5"
            data-testid="contact-tcpa"
          />
          <Label htmlFor="cf-tcpa" className="text-xs leading-snug font-normal cursor-pointer">
            By providing my contact info and submitting, I agree to receive calls, texts, and emails
            from Mykoal DeShazo at Adaxa Home, LLC regarding my mortgage inquiry, including via
            automated dialer. I understand consent is not a condition of any purchase and I can opt
            out at any time. Standard message and data rates may apply.
          </Label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Mykoal DeShazo · NMLS #1912347 · Adaxa Home, LLC · NMLS #2380533 · Equal Housing Opportunity
        </p>
      </div>
    );
  }

  function renderStep6Fork() {
    // Card 1 ("Build It Yourself") adapts to the product: calc products get the
    // savings worksheet, HELOC gets instant online offers, Purchase gets
    // self-directed next steps.
    const selfBuild =
      entryButton === "heloc"
        ? {
            body: "Jump straight to instant HELOC offers — compare real rates and terms from our partner lenders online, right now.",
            cta: "See Instant Options",
          }
        : entryButton === "purchase"
        ? {
            body: "Head to your next steps and explore your options online — start your application or book a time, at your own pace.",
            cta: "Explore My Options",
          }
        : {
            body: "See your full worksheet right now — monthly savings, interest saved, and years shaved off your loan. Email a copy to yourself when you're ready.",
            cta: "Create My Quote",
          };
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-primary mb-2">How would you like your quote?</h2>
          <p className="text-muted-foreground">Both options are 100% free — no cost either way.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleForkSelfBuild}
            className="text-left rounded-xl border-2 border-border hover:border-accent transition-all p-6 bg-card hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent flex flex-col"
            data-testid="fork-self-build"
          >
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Calculator className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-lg font-bold text-primary mb-2">Build It Yourself</h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {selfBuild.body}
            </p>
            <div className="mt-auto">
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-white font-semibold px-4 py-2.5 text-sm">
                {selfBuild.cta} <ArrowRight className="h-4 w-4" />
              </span>
              <div className="text-xs text-muted-foreground font-medium text-center mt-3">
                No cost · No obligation · No credit pull
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={handleForkProfessional}
            className="text-left rounded-xl border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all p-6 shadow-md focus:outline-none focus:ring-2 focus:ring-accent flex flex-col"
            data-testid="fork-professional"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center">
                <Handshake className="h-6 w-6 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-accent text-white">
                Recommended
              </span>
            </div>
            <h3 className="text-lg font-bold mb-2">Done For You</h3>
            <p className="text-sm text-white/85 mb-4 leading-relaxed">
              Mykoal personally reviews your details and builds a tailored game plan — a real human
              looking at your situation, not a calculator.
            </p>
            <div className="mt-auto">
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-white font-semibold px-4 py-2.5 text-sm">
                Get My Professional Quote <ArrowRight className="h-4 w-4" />
              </span>
              <div className="text-xs text-white/70 font-medium text-center mt-3">
                No cost · No obligation · No credit pull
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  function renderResults() {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-primary mb-1">Your worksheet is ready</h2>
            <p className="text-muted-foreground text-sm">
              Review the numbers below. When you're happy, get the personalized PDF emailed to you.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={back}>
              <Pencil className="h-4 w-4 mr-1.5" /> Adjust numbers
            </Button>
            <Button className="bg-accent hover:bg-accent/90 text-white" onClick={() => setExportOpen(true)}>
              <Mail className="h-4 w-4 mr-1.5" /> Email My Worksheet
            </Button>
          </div>
        </div>

        {/* Quick at-a-glance bar */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Stat label="Monthly savings" value={money(results.monthlySavings)} positive={!results.isNegativeSavings} />
          <Stat label="Interest saved" value={money(results.consolidated.totalInterest - results.accelerated.totalInterest)} positive />
          <Stat label="Years shaved off" value={(results.consolidated.years - results.accelerated.years).toFixed(1) + " yrs"} positive />
        </div>

        {/* Blurred worksheet preview teaser with email-gate overlay */}
        <div className="relative border rounded-lg shadow-sm overflow-hidden bg-white">
          <div
            className="select-none pointer-events-none"
            style={{ filter: "blur(8px)", WebkitFilter: "blur(8px)" }}
            aria-hidden="true"
          >
            <WorksheetDocument inputs={inputs} results={results} />
          </div>
          {/* Frosted overlay with CTA */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
            <div className="max-w-md mx-4 text-center bg-white/95 border rounded-xl shadow-lg p-6 sm:p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-3">
                <Mail className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">
                Your full worksheet is ready
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Enter your info to get the complete breakdown emailed to you.
              </p>
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white w-full"
                onClick={() => setExportOpen(true)}
              >
                <Mail className="h-4 w-4 mr-2" /> Email My Worksheet
              </Button>
              <p className="text-[11px] text-muted-foreground mt-3">
                Free · No obligation · No credit pull
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const vStep = visibleStep(step);
  // Progress bar shows for steps 1-5; hidden on fork (6) and results (7).
  const showProgress = step <= 5;

  return (
    <>
      <PageMeta
        title="Loan Benefits Worksheet | Adaxa Home"
        description="See exactly how the right loan strategy could lower your monthly payment, eliminate interest, and get you debt-free years sooner."
        canonical="/worksheet"
        noIndex
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto max-w-3xl px-4 py-8">
          <TopBar step={vStep} totalSteps={totalSteps} onStartOver={handleStartOver} />
          {showProgress && <Progress step={vStep} total={totalSteps} />}

          <div className="bg-card border rounded-xl shadow-sm p-6 sm:p-8">
            {/* Step 1: calc shows product picker, non-calc shows confirmation intro */}
            {step === 1 && (isCalc ? renderStep1() : renderNonCalcIntro())}
            {step === 2 && isCalc && renderStep2()}
            {step === 3 && isCalc && renderStep3()}
            {step === 4 && isCalc && renderStep4()}
            {step === 5 && renderStep5Contact()}
            {step === 6 && renderStep6Fork()}
            {step === 7 && renderResults()}

            {/* Button bar: shown for steps 1-5 (input collection). Hidden on fork (6) and results (7). */}
            {step <= 4 && (
              <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t">
                <Button variant="ghost" onClick={back} disabled={step === 1}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={next} className="bg-accent hover:bg-accent/90 text-white">
                  {step === 4 ? "Continue" : "Continue"} <ArrowRight className="h-4 w-4 ml-1" />
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
                  disabled={isSubmittingContact}
                  className="bg-accent hover:bg-accent/90 text-white"
                  data-testid="submit-contact"
                >
                  {isSubmittingContact ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting...</>
                  ) : (
                    <>Submit My Info <ArrowRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>

      <ExportLeadModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        inputs={inputs}
        results={results}
        worksheetSummary={worksheetSummary}
      />
    </>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${positive ? "text-green-700" : "text-destructive"}`}>{value}</div>
    </div>
  );
}

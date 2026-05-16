import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, RotateCcw, Plus, Trash2, Check, Mail, Pencil } from "lucide-react";
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

const STORAGE_KEY = "smartr8_worksheet_funnel_v2";
const STEP_KEY = "smartr8_worksheet_funnel_step_v2";

type FunnelStep = 1 | 2 | 3 | 4 | 5; // 5 = results

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
  label, value, onChange, prefix = "$", step = 1, optional = false, hint,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  step?: number;
  optional?: boolean;
  hint?: string;
  min?: number;
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
          value={value === 0 && optional ? "" : value || (value === 0 ? 0 : "")}
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
  const [inputs, setInputs] = useState<WorksheetInputs>(loadInputs);
  const [step, setStep] = useState<FunnelStep>(loadStep);
  const [exportOpen, setExportOpen] = useState(false);
  const [editing, setEditing] = useState(false); // when on results, allow inline edit of inputs for adjustment
  const { toast } = useToast();
  const initialPrefillRef = useRef(false);

  const results = useMemo(() => computeScenarios(inputs), [inputs]);

  useEffect(() => { saveInputs(inputs); }, [inputs]);
  useEffect(() => { saveStep(step); }, [step]);

  // Determine total visible steps based on product
  // RATE_REDUCTION: Step 3 (Goals/Debts) is skipped → 3 visible steps
  // CASH_OUT / HOME_EQUITY: 4 visible steps
  const isRateReduction = inputs.productType === "RATE_REDUCTION";
  const totalSteps = isRateReduction ? 3 : 4;

  // Map logical step (1-4) to visible step (1-totalSteps)
  // For RATE_REDUCTION we skip step 3 entirely
  function visibleStep(s: FunnelStep): number {
    if (s === 5) return totalSteps + 1; // results
    if (isRateReduction && s >= 4) return s - 1;
    return s;
  }

  function handleStartOver() {
    if (!confirm("Clear all inputs and start over?")) return;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STEP_KEY);
    setInputs(loadInputs());
    setStep(1);
    setEditing(false);
    initialPrefillRef.current = false;
    toast({ title: "Reset!", description: "Starting fresh from Step 1." });
  }

  function update<K extends keyof WorksheetInputs>(key: K, value: WorksheetInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    // Validation gates per step
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
  }

  function back() {
    if (step === 5) { setStep(4); setEditing(false); return; }
    if (step === 4) { setStep(isRateReduction ? 2 : 3); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setStep(1); return; }
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
              hint="What you still owe."
            />
            <NumberField
              label="Total Monthly Payment (PITI)"
              value={inputs.existTotalPayment}
              onChange={(v) => update("existTotalPayment", v)}
              hint="Full payment including taxes & insurance."
            />
            <NumberField
              label="Current Interest Rate"
              value={inputs.existRate}
              onChange={(v) => update("existRate", v)}
              prefix=""
              step={0.001}
              optional
              hint="Leave blank if unknown."
            />
            <NumberField
              label="Monthly Escrow"
              value={inputs.existEscrow}
              onChange={(v) => update("existEscrow", v)}
              optional
              hint="Taxes & insurance portion. Optional."
            />
            <NumberField
              label="Years Remaining"
              value={inputs.existYearsRemaining}
              onChange={(v) => update("existYearsRemaining", v)}
              prefix=""
              optional
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

        <div className="border rounded-lg shadow-sm overflow-hidden bg-white">
          <WorksheetDocument inputs={inputs} results={results} />
        </div>

        <div className="text-center pt-2">
          <Button size="lg" className="bg-accent hover:bg-accent/90 text-white" onClick={() => setExportOpen(true)}>
            <Mail className="h-4 w-4 mr-2" /> Email My Worksheet
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const vStep = visibleStep(step);
  const showProgress = step <= 4;

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
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderResults()}

            {step <= 4 && (
              <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t">
                <Button variant="ghost" onClick={back} disabled={step === 1}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button onClick={next} className="bg-accent hover:bg-accent/90 text-white">
                  {step === 4 ? "See My Results" : "Continue"} <ArrowRight className="h-4 w-4 ml-1" />
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

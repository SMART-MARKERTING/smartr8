// ──────────────────────────────────────────────────────────────────────────
// Loan Benefits Worksheet — calculation engine
// Shared by public funnel + internal advisor tool.
// ──────────────────────────────────────────────────────────────────────────

export type ProductType = "CASH_OUT" | "RATE_REDUCTION" | "HOME_EQUITY";

export type LoanStructure =
  | "FIXED"
  | "ARM_5_6"
  | "ARM_7_1"
  | "ARM_10_1"
  | "INTEREST_ONLY";

export type Goal = "DEBT" | "IMPROVEMENT" | "BOTH" | "OTHER" | null;

export const PRODUCT_LABELS: Record<ProductType, string> = {
  CASH_OUT: "Cash-Out Refinance",
  RATE_REDUCTION: "Rate Reduction Refinance",
  HOME_EQUITY: "Home Equity / 2nd Mortgage",
};

export const PRODUCT_LABELS_SHORT: Record<ProductType, string> = {
  CASH_OUT: "Cash-Out Refi",
  RATE_REDUCTION: "Rate Reduction Refi",
  HOME_EQUITY: "Home Equity / 2nd Mortgage",
};

export const STRUCTURE_LABELS: Record<LoanStructure, string> = {
  FIXED: "Fixed Rate",
  ARM_5_6: "5/6 ARM",
  ARM_7_1: "7/1 ARM",
  ARM_10_1: "10/1 ARM",
  INTEREST_ONLY: "Interest Only",
};

export const LICENSED_STATES = "AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA";

export interface Debt {
  name: string;
  balance: number;
  payment: number;
}

export interface AdvisorInfo {
  preparedBy: string;
  preparedByTitle: string;
  companyName: string;
  contactPhone: string;
  contactEmail: string;
  contactNMLS: string;
  companyNMLS: string;
  /** Per-session uploaded headshot, base64 data URL. Optional. */
  headshotDataUrl?: string;
}

export interface WorksheetInputs extends AdvisorInfo {
  // Lead identity (used in PDF "Prepared For" line + lead capture)
  clientFirstName: string;
  clientLastName: string;

  // Product
  productType: ProductType;
  loanStructure: LoanStructure;

  // Property — estimated home value. Used only by the public funnel's auto-quote
  // (LTV math); the worksheet calc + PDF ignore it. 0 = unknown.
  homeValue: number;

  // Existing mortgage (may all be 0 if hasExistingMortgage = false)
  hasExistingMortgage: boolean;
  existBalance: number;
  existRate: number;          // optional, 0 = unknown
  existTotalPayment: number;  // FULL PITI (P&I + escrow combined)
  existEscrow: number;        // optional, 0 = unknown
  existYearsRemaining: number;

  // Goals (only relevant for CASH_OUT and HOME_EQUITY; ignored for RATE_REDUCTION)
  goal: Goal;
  homeImprovementAmount: number;

  // New loan
  loanAmount: number;
  loanRate: number;
  closingCosts: number;
  termYears: number;
  cashBack: number;
  /** Manual APR override (%). 0 = auto-calculate from closing costs via solveApr. */
  customApr: number;

  // Debts to consolidate
  debts: Debt[];
}

export interface ScenarioPath {
  monthlyPmt: number;
  years: number;
  totalInterest: number;
  effectiveRate?: number;
}

export interface ScenarioResults {
  current: ScenarioPath;
  consolidated: ScenarioPath;
  accelerated: ScenarioPath;
  newLoanPmt: number;
  newLoanApr: number;          // auto-calculated from closing costs
  debtBalance: number;
  debtMinPmt: number;
  freedUp: number;
  currentTotalOutflow: number;
  newTotalOutflow: number;
  monthlySavings: number;      // currentTotalOutflow - newTotalOutflow
  extraMonthly: number;        // = max(0, monthlySavings) — locked, auto-applied
  isNegativeSavings: boolean;
  existingMortgageInterest: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Math helpers
// ──────────────────────────────────────────────────────────────────────────

export function monthlyPayment(principal: number, annualRatePct: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = (annualRatePct / 100) / 12;
  if (r === 0) return principal / termMonths;
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

function amortize(
  balance: number,
  annualRatePct: number,
  scheduledPmt: number,
  extraMonthly = 0,
  maxMonths = 600,
): { months: number; totalInterest: number; totalPaid: number } {
  if (balance <= 0 || scheduledPmt <= 0) {
    return { months: 0, totalInterest: 0, totalPaid: 0 };
  }
  let bal = balance;
  const r = (annualRatePct / 100) / 12;
  let totalInterest = 0, totalPaid = 0, months = 0;
  const payment = scheduledPmt + extraMonthly;
  while (bal > 0.01 && months < maxMonths) {
    const interest = bal * r;
    let principalPortion = payment - interest;
    if (principalPortion <= 0) {
      return { months: maxMonths, totalInterest: Infinity, totalPaid: Infinity };
    }
    let paymentThisMonth: number;
    if (principalPortion > bal) {
      principalPortion = bal;
      paymentThisMonth = bal + interest;
    } else {
      paymentThisMonth = payment;
    }
    bal -= principalPortion;
    totalInterest += interest;
    totalPaid += paymentThisMonth;
    months++;
  }
  return { months, totalInterest, totalPaid };
}

function effectiveRateFromInterest(principal: number, totalInterest: number, termMonths: number): number {
  if (termMonths <= 0 || principal <= 0 || totalInterest <= 0) return 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    let impliedPmt: number;
    if (mid === 0) impliedPmt = principal / termMonths;
    else impliedPmt = principal * (mid * Math.pow(1 + mid, termMonths)) / (Math.pow(1 + mid, termMonths) - 1);
    const impliedInterest = impliedPmt * termMonths - principal;
    if (impliedInterest > totalInterest) hi = mid;
    else lo = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

/**
 * Solve for APR via bisection.
 * APR is the rate at which a loan of (loanAmount - closingCosts) net proceeds,
 * paid back at the contractual monthly payment, would amortize over the term.
 *
 * All closing costs treated as prepaid finance charges (simplified illustration).
 */
export function solveApr(
  loanAmount: number,
  annualRatePct: number,
  termMonths: number,
  closingCosts: number,
): number {
  if (loanAmount <= 0 || termMonths <= 0) return annualRatePct;
  if (closingCosts <= 0) return annualRatePct;
  const netProceeds = loanAmount - closingCosts;
  if (netProceeds <= 0) return annualRatePct;
  const targetPmt = monthlyPayment(loanAmount, annualRatePct, termMonths);
  let lo = annualRatePct;
  let hi = annualRatePct + 10;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const impliedPmt = monthlyPayment(netProceeds, mid, termMonths);
    if (impliedPmt > targetPmt) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// ──────────────────────────────────────────────────────────────────────────
// Main scenario computation
// ──────────────────────────────────────────────────────────────────────────

export function computeScenarios(inputs: WorksheetInputs): ScenarioResults {
  const termMonths = inputs.termYears * 12;
  const isHomeEquity = inputs.productType === "HOME_EQUITY";

  // ── New loan ────────────────────────────────────────────────────────────
  const newLoanPmt = monthlyPayment(inputs.loanAmount, inputs.loanRate, termMonths);
  const newLoanApr = inputs.customApr > 0
    ? inputs.customApr
    : solveApr(inputs.loanAmount, inputs.loanRate, termMonths, inputs.closingCosts);

  // ── Existing mortgage ──────────────────────────────────────────────────
  const firstMortgagePITI = inputs.hasExistingMortgage ? inputs.existTotalPayment : 0;
  let existingMortgageMonths = 0;
  let existingMortgageInterest = 0;
  if (inputs.hasExistingMortgage && inputs.existBalance > 0 && inputs.existRate > 0) {
    // Estimate P&I = total payment minus escrow (if known); fall back to total payment
    const piEstimate = inputs.existEscrow > 0
      ? Math.max(0, inputs.existTotalPayment - inputs.existEscrow)
      : inputs.existTotalPayment;
    if (piEstimate > 0) {
      const am = amortize(inputs.existBalance, inputs.existRate, piEstimate);
      existingMortgageMonths = am.months;
      existingMortgageInterest = am.totalInterest;
    }
  } else if (inputs.hasExistingMortgage && inputs.existYearsRemaining > 0) {
    existingMortgageMonths = inputs.existYearsRemaining * 12;
  }

  // ── Debts ──────────────────────────────────────────────────────────────
  let debtBalance = 0, debtMinPmt = 0;
  inputs.debts.forEach((d) => {
    debtBalance += d.balance;
    debtMinPmt += d.payment;
  });

  // ── Outflows ───────────────────────────────────────────────────────────
  const currentTotalOutflow = firstMortgagePITI + debtMinPmt;

  let newTotalOutflow: number;
  if (isHomeEquity) {
    // Keep first mortgage; new loan is a SECOND mortgage
    newTotalOutflow = firstMortgagePITI + newLoanPmt;
  } else {
    // CASH_OUT or RATE_REDUCTION — new loan replaces first mortgage; add escrow if known
    newTotalOutflow = newLoanPmt + (inputs.existEscrow > 0 ? inputs.existEscrow : 0);
  }

  const monthlySavings = currentTotalOutflow - newTotalOutflow;
  const isNegativeSavings = monthlySavings < 0;
  const extraMonthly = Math.max(0, monthlySavings);
  const freedUp = Math.max(0, monthlySavings);

  // ── Current path (display) ─────────────────────────────────────────────
  // Years to debt-free: longest time horizon we can estimate
  const currentYears =
    Math.max(existingMortgageMonths, /* assume debts paid in ~5 yrs */ debtBalance > 0 ? 60 : 0) / 12;
  const current: ScenarioPath = {
    monthlyPmt: currentTotalOutflow,
    years: currentYears,
    totalInterest: existingMortgageInterest, // debts unknown (no rate column)
  };

  // ── Consolidated (standard refi / new loan, no extra) ──────────────────
  const refi = amortize(inputs.loanAmount, inputs.loanRate, newLoanPmt);
  const consolidated: ScenarioPath = {
    monthlyPmt: isHomeEquity ? firstMortgagePITI + newLoanPmt : newLoanPmt,
    years: refi.months / 12,
    totalInterest: refi.totalInterest,
  };

  // ── Accelerated (new loan + auto-applied savings as extra principal) ───
  const acc = amortize(inputs.loanAmount, inputs.loanRate, newLoanPmt, extraMonthly);
  const accEffRate = effectiveRateFromInterest(inputs.loanAmount, acc.totalInterest, termMonths);
  const accelerated: ScenarioPath = {
    monthlyPmt: isHomeEquity ? firstMortgagePITI + newLoanPmt + extraMonthly : newLoanPmt + extraMonthly,
    years: acc.months / 12,
    totalInterest: acc.totalInterest,
    effectiveRate: accEffRate,
  };

  return {
    current,
    consolidated,
    accelerated,
    newLoanPmt,
    newLoanApr,
    debtBalance,
    debtMinPmt,
    freedUp,
    currentTotalOutflow,
    newTotalOutflow,
    monthlySavings,
    extraMonthly,
    isNegativeSavings,
    existingMortgageInterest,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────────────────────

export const money = (v: number): string =>
  !isFinite(v) ? "—" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const moneyRound = (v: number): string =>
  !isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");

export const pct = (v: number): string => v.toFixed(3) + "%";
export const yrs = (v: number): string => v.toFixed(1) + " yrs";

// ──────────────────────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────────────────────

export const DEFAULT_ADVISOR: AdvisorInfo = {
  preparedBy: "Mykoal DeShazo",
  preparedByTitle: "Vice President | Senior Loan Officer",
  companyName: "Adaxa Home LLC",
  contactPhone: "(480) 206-9290",
  contactEmail: "mykoal@adaxahome.com",
  contactNMLS: "1912347",
  companyNMLS: "2380533",
};

export const DEFAULT_DEBTS: Debt[] = [
  { name: "Credit Card", balance: 8500, payment: 250 },
  { name: "Auto Loan", balance: 14000, payment: 320 },
];

export const DEFAULT_NEW_LOAN_RATE = 5.125;
export const DEFAULT_CLOSING_COSTS = 3999;

export function makeDefaultInputs(overrides: Partial<WorksheetInputs> = {}): WorksheetInputs {
  return {
    ...DEFAULT_ADVISOR,
    clientFirstName: "",
    clientLastName: "",
    productType: "CASH_OUT",
    loanStructure: "FIXED",
    homeValue: 0,
    hasExistingMortgage: true,
    existBalance: 320000,
    existRate: 6.875,
    existTotalPayment: 2550, // PITI = P&I 2100 + escrow 450
    existEscrow: 450,
    existYearsRemaining: 27,
    goal: "DEBT",
    homeImprovementAmount: 0,
    loanAmount: 380000,
    loanRate: DEFAULT_NEW_LOAN_RATE,
    closingCosts: DEFAULT_CLOSING_COSTS,
    termYears: 30,
    cashBack: 0,
    customApr: 0,
    debts: [...DEFAULT_DEBTS],
    ...overrides,
  };
}

export interface Debt {
  name: string;
  balance: number;
  rate: number;
  payment: number;
}

export interface WorksheetInputs {
  clientName: string;
  preparedBy: string;
  preparedByTitle: string;
  companyName: string;
  contactPhone: string;
  contactEmail: string;
  contactNMLS: string;
  companyNMLS: string;
  licenseStates: string;
  existBalance: number;
  existRate: number;
  existPayment: number;
  existEscrow: number;
  existYearsRemaining: number;
  loanAmount: number;
  loanRate: number;
  termYears: number;
  extraMonthly: number;
  cashBack: number;
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
  debtBalance: number;
  debtMinPmt: number;
  freedUp: number;
  currentTotalOutflow: number;
  existingMortgageInterest: number;
}

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

export function computeScenarios(inputs: WorksheetInputs): ScenarioResults {
  const termMonths = inputs.termYears * 12;
  const newLoanPmt = monthlyPayment(inputs.loanAmount, inputs.loanRate, termMonths);

  const existingMortgage = amortize(inputs.existBalance, inputs.existRate, inputs.existPayment);

  let debtInterest = 0, debtBalance = 0, debtMinPmt = 0, longestDebtMonths = 0;
  inputs.debts.forEach(d => {
    const { months, totalInterest } = amortize(d.balance, d.rate, d.payment);
    debtInterest += totalInterest;
    debtBalance += d.balance;
    debtMinPmt += d.payment;
    if (months > longestDebtMonths) longestDebtMonths = months;
  });

  const currentMonths = Math.max(existingMortgage.months, longestDebtMonths);
  const current: ScenarioPath = {
    monthlyPmt: inputs.existPayment + inputs.existEscrow + debtMinPmt,
    years: currentMonths / 12,
    totalInterest: existingMortgage.totalInterest + debtInterest,
  };

  const refi = amortize(inputs.loanAmount, inputs.loanRate, newLoanPmt);
  const consolidated: ScenarioPath = {
    monthlyPmt: newLoanPmt,
    years: refi.months / 12,
    totalInterest: refi.totalInterest,
  };

  const acc = amortize(inputs.loanAmount, inputs.loanRate, newLoanPmt, inputs.extraMonthly);
  const accEffRate = effectiveRateFromInterest(inputs.loanAmount, acc.totalInterest, termMonths);
  const accelerated: ScenarioPath = {
    monthlyPmt: newLoanPmt + inputs.extraMonthly,
    years: acc.months / 12,
    totalInterest: acc.totalInterest,
    effectiveRate: accEffRate,
  };

  const freedUp = Math.max(0, (inputs.existPayment + debtMinPmt) - newLoanPmt);
  const currentTotalOutflow = inputs.existPayment + inputs.existEscrow + debtMinPmt;

  return {
    current,
    consolidated,
    accelerated,
    newLoanPmt,
    debtBalance,
    debtMinPmt,
    freedUp,
    currentTotalOutflow,
    existingMortgageInterest: existingMortgage.totalInterest,
  };
}

export const money = (v: number): string =>
  !isFinite(v) ? "—" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pct = (v: number): string => v.toFixed(3) + "%";
export const yrs = (v: number): string => v.toFixed(1) + " yrs";

export const DEFAULT_ADVISOR = {
  preparedBy: "Mykoal DeShazo",
  preparedByTitle: "Vice President | Senior Loan Officer",
  companyName: "Adaxa Home LLC",
  contactPhone: "(949) 418-5486",
  contactEmail: "mykoal@adaxahome.com",
  contactNMLS: "1912347",
  companyNMLS: "2380533",
  licenseStates: "AZ, CO, TX, FL, OR, WA, MN, MI, PA",
};

export const DEFAULT_DEBTS: Debt[] = [
  { name: "Credit Card", balance: 8500, rate: 22.99, payment: 250 },
  { name: "Auto Loan", balance: 14000, rate: 8.5, payment: 320 },
];

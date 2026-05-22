// Product-specific copy for the worksheet banner + "How This Strategy Works"
// Used by both the on-screen WorksheetDocument and the WorksheetPDF.

import {
  WorksheetInputs,
  ScenarioResults,
  ProductType,
  STRUCTURE_LABELS,
  LICENSED_STATES,
  money,
  pct,
} from "./worksheetCalc";

export interface ExplainerCopy {
  banner: string;
  paragraphs: string[];
}

function fixed(n: number, d = 1): string {
  return n.toFixed(d);
}

export function buildExplainer(inputs: WorksheetInputs, results: ScenarioResults): ExplainerCopy {
  const { current, consolidated, accelerated, monthlySavings, newLoanPmt, newLoanApr } = results;
  const totalSaved = consolidated.totalInterest - accelerated.totalInterest;
  const timeSaved = consolidated.years - accelerated.years;
  const effRate = accelerated.effectiveRate ?? 0;
  const aprStr = newLoanApr > 0 ? `${pct(inputs.loanRate)} (${pct(newLoanApr)} APR)` : pct(inputs.loanRate);
  const totalDebt = results.debtBalance;
  const firstMortgagePITI = inputs.hasExistingMortgage ? inputs.existTotalPayment : 0;

  switch (inputs.productType) {
    case "CASH_OUT": {
      const debtBlurb = totalDebt > 0
        ? `consolidating ${money(totalDebt)} in higher-interest debt into a new mortgage`
        : `restructuring into a new mortgage`;
      const banner =
        `By ${debtBlurb} at ${aprStr}, you free up ${money(monthlySavings)}/month. ` +
        `By applying that ${money(monthlySavings)}/month in savings to the new loan's principal each month, your ${pct(inputs.loanRate)} loan effectively costs ${pct(effRate)} — ` +
        `saving ${money(totalSaved)} in interest and ${fixed(timeSaved)} years.`;

      const p1 = inputs.hasExistingMortgage
        ? `Today you pay ${money(current.monthlyPmt)}/month total — your existing mortgage (${money(firstMortgagePITI)}) plus ${money(results.debtMinPmt)} in minimum payments across your other debts.`
        : `Today you pay ${money(current.monthlyPmt)}/month in minimum payments across your higher-interest debts.`;
      const p2 = `By ${inputs.hasExistingMortgage ? "refinancing your mortgage" : "taking out a new mortgage"} of ${money(inputs.loanAmount)} at ${aprStr}, all of those higher-interest debts get rolled into a single lower-rate first mortgage. Your new total monthly outflow drops to ${money(results.newTotalOutflow)}, freeing up ${money(monthlySavings)}/month in cash flow.`;
      const p3 = `By applying that ${money(monthlySavings)}/month in savings to the new loan's principal each month, every dollar of principal you retire early never accrues interest again. If those payments are made consistently, your stated ${pct(inputs.loanRate)} rate behaves like ${pct(effRate)} in practice — saving ${money(totalSaved)} in interest and paying off the loan in ${fixed(accelerated.years)} years instead of ${fixed(consolidated.years, 0)}.`;

      return { banner, paragraphs: [p1, p2, p3] };
    }

    case "RATE_REDUCTION": {
      const oldRateStr = inputs.existRate > 0 ? pct(inputs.existRate) : "your current rate";
      const banner =
        `By refinancing from ${oldRateStr} to ${pct(inputs.loanRate)} AND applying your monthly savings of ${money(monthlySavings)}/month to the new loan's principal each month, ` +
        `your new loan effectively costs you ${pct(effRate)} — saving ${money(totalSaved)} in interest and ${fixed(timeSaved)} years vs. just lowering your rate alone.`;

      const p1 = `Your current mortgage costs you ${money(firstMortgagePITI)}/month${inputs.existRate > 0 ? ` at ${oldRateStr}` : ""}.`;
      const p2 = `By refinancing to ${aprStr}, your new payment drops to ${money(results.newTotalOutflow)} — a monthly savings of ${money(monthlySavings)}.`;
      const p3 = `By applying that ${money(monthlySavings)}/month in savings to the new loan's principal each month, every dollar of principal you retire early never accrues interest again. If those payments are made consistently, your stated ${pct(inputs.loanRate)} behaves like ${pct(effRate)} in practice — saving ${money(totalSaved)} in interest and shaving ${fixed(timeSaved)} years off your payoff timeline.`;

      return { banner, paragraphs: [p1, p2, p3] };
    }

    case "HOME_EQUITY": {
      const banner =
        `By using a Home Equity Loan of ${money(inputs.loanAmount)} to consolidate ${money(totalDebt)} in higher-interest debt, ` +
        `you free up ${money(monthlySavings)}/month while keeping your low-rate first mortgage intact. ` +
        `By applying that ${money(monthlySavings)}/month in savings to the second-mortgage principal each month, it pays off in ${fixed(accelerated.years)} years at an effective rate of ${pct(effRate)}.`;

      const firstRateStr = inputs.existRate > 0 ? ` at ${pct(inputs.existRate)}` : "";
      const p1 = inputs.hasExistingMortgage
        ? `Today you pay ${money(current.monthlyPmt)}/month total — your existing first mortgage${firstRateStr} (${money(firstMortgagePITI)}) plus ${money(results.debtMinPmt)} in minimum payments across your other debts.`
        : `Today you pay ${money(current.monthlyPmt)}/month in minimum payments across your higher-interest debts.`;
      const p2 = `A new Home Equity Loan of ${money(inputs.loanAmount)} at ${aprStr} lets you consolidate those higher-interest debts${inputs.hasExistingMortgage ? " WITHOUT touching your low-rate first mortgage" : ""}. Your new total monthly outflow becomes ${money(results.newTotalOutflow)}${inputs.hasExistingMortgage ? " — your first mortgage payment plus the new second-mortgage payment" : ""} — freeing up ${money(monthlySavings)}/month in cash flow.`;
      const p3 = `By applying that ${money(monthlySavings)}/month in savings to the ${inputs.hasExistingMortgage ? "SECOND" : "new"} mortgage's principal each month, ${inputs.hasExistingMortgage ? "the second mortgage" : "it"} gets paid off in ${fixed(accelerated.years)} years at an effective rate of ${pct(effRate)}, saving ${money(totalSaved)} in interest${inputs.hasExistingMortgage ? " — all while keeping your low-rate first mortgage exactly as it is" : ""}.`;

      return { banner, paragraphs: [p1, p2, p3] };
    }
  }
}

export function buildComplianceFooter(inputs: WorksheetInputs): string {
  const company = inputs.companyName || "Adaxa Home LLC";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isArmOrIo = inputs.loanStructure !== "FIXED";
  const armDisclaimer = isArmOrIo
    ? `${STRUCTURE_LABELS[inputs.loanStructure]} structure: ARM rates may adjust after the initial fixed period. Interest-only loans defer principal payment for an initial period after which principal is required. This illustration assumes the initial rate remains constant for the entire loan term and does not account for rate adjustments or principal recapture.\n\n`
    : "";

  return [
    `${company} | Company NMLS #${inputs.companyNMLS || "2380533"} | ${inputs.preparedBy || "Mykoal DeShazo"} NMLS #${inputs.contactNMLS || "1912347"}. `,
    `Licensed to originate mortgage loans in ${LICENSED_STATES}. Verify licensing at www.nmlsconsumeraccess.org.\n\n`,
    "This document is for informational and illustrative purposes only and does NOT constitute a commitment to lend, an offer to extend credit, a Loan Estimate as required under 12 CFR 1026.19, or a guarantee of any specific terms or rates. The interest rate and APR shown are hypothetical for illustration only. Actual rates, APR, fees, and terms depend on credit approval, property appraisal, income and asset verification, loan-to-value, occupancy, property type, debt-to-income ratio, and current market conditions, and are subject to change without notice.\n\n",
    "APR shown is estimated based on entered closing costs and is for illustration only. Actual APR on your Loan Estimate may vary based on actual finance charges, prepaids, and other factors.\n\n",
    armDisclaimer,
    "The \u201ceffective rate\u201d calculation illustrates how applying additional principal payments may reduce total interest paid over the life of the loan; it is NOT the loan\u2019s contractual interest rate, NOT the Annual Percentage Rate (APR) required under the Truth in Lending Act, and assumes consistent voluntary additional principal payments. Results depend on the borrower actually making those payments.\n\n",
    "Consult a licensed loan originator for an official Loan Estimate disclosing actual loan terms, costs, and APR. All loans subject to underwriting approval. Programs, rates, terms, and conditions subject to change without notice.\n\n",
    `Equal Housing Opportunity. ${company} is an Equal Housing Lender. We do business in accordance with the Federal Fair Housing Law and the Equal Credit Opportunity Act. We do not discriminate on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant has the capacity to enter into a binding contract), because all or part of the applicant\u2019s income derives from any public assistance program, or because the applicant has in good faith exercised any right under the Consumer Credit Protection Act.\n\n`,
    `Prepared ${dateStr}.`,
  ].join("");
}

export function preparedForName(inputs: WorksheetInputs): string {
  const full = `${inputs.clientFirstName.trim()} ${inputs.clientLastName.trim()}`.trim();
  return full || "Client";
}

export function productHeading(productType: ProductType): string {
  switch (productType) {
    case "CASH_OUT":
      return "Cash-Out Refinance Strategy";
    case "RATE_REDUCTION":
      return "Rate Reduction Refinance Strategy";
    case "HOME_EQUITY":
      return "Home Equity / 2nd Mortgage Strategy";
  }
}

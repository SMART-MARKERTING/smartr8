import React from "react";
import {
  WorksheetInputs,
  ScenarioResults,
  STRUCTURE_LABELS,
  money,
  pct,
  yrs,
} from "@/lib/worksheetCalc";
import { buildExplainer, buildComplianceFooter, preparedForName, productHeading } from "@/lib/worksheetCopy";

interface WorksheetDocumentProps {
  id?: string;
  inputs: WorksheetInputs;
  results: ScenarioResults;
}

const NAVY = "#1F2A44";
const GOLD = "#C9A74D";
const LIGHT = "#F4F1EA";
const GREEN = "#2E7D4F";
const RED = "#E31B23";
const GRAY = "#6B7280";
const BORDER = "#E5E5E5";
const ROW_ALT = "#FAFAFA";

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  fontFamily: "Georgia, 'Times New Roman', serif",
  pageBreakInside: "avoid",
};

const thStyle: React.CSSProperties = {
  background: NAVY,
  color: "#fff",
  padding: "7px 10px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 11,
};
const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: `1px solid ${BORDER}`,
  color: "#333",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 12,
};
const tdNumStyle: React.CSSProperties = { ...tdStyle, textAlign: "right" };

const noBreak: React.CSSProperties = { pageBreakInside: "avoid" };

const EhoSvg = ({ color = NAVY, size = 32 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x={0} y={0} width={64} height={64} fill="none" stroke={color} strokeWidth={2} />
    <path d="M 12 34 L 32 18 L 52 34 L 52 52 L 12 52 Z" fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
    <line x1={22} y1={40} x2={42} y2={40} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <line x1={22} y1={46} x2={42} y2={46} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

const HeadshotPlaceholder = ({ size = 64 }: { size?: number }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      border: `2px solid ${GOLD}`,
      background: LIGHT,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: NAVY,
      fontFamily: "Georgia, serif",
      fontWeight: 700,
      fontSize: size / 2.5,
    }}
  >
    {/* simple silhouette */}
    <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill={NAVY}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  </div>
);

const WorksheetDocument = React.forwardRef<HTMLDivElement, WorksheetDocumentProps>(
  ({ id, inputs, results }, ref) => {
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    const { current, consolidated, accelerated, newLoanApr, isNegativeSavings } = results;
    const totalSaved = consolidated.totalInterest - accelerated.totalInterest;
    const timeSaved = consolidated.years - accelerated.years;
    const explainer = buildExplainer(inputs, results);
    const complianceText = buildComplianceFooter(inputs);
    const isHomeEquity = inputs.productType === "HOME_EQUITY";
    const showFirstMortgageRow = inputs.hasExistingMortgage;

    const contactParts: string[] = [];
    if (inputs.contactPhone) contactParts.push(inputs.contactPhone);
    if (inputs.contactEmail) contactParts.push(inputs.contactEmail);
    if (inputs.contactNMLS) contactParts.push("NMLS #" + inputs.contactNMLS);

    const aprStr = newLoanApr > 0 ? `${pct(inputs.loanRate)} Rate / ${pct(newLoanApr)} APR` : pct(inputs.loanRate);
    const newLoanLabel = isHomeEquity ? "New Second Mortgage" : "New Loan";
    const structureLabel = STRUCTURE_LABELS[inputs.loanStructure];

    return (
      <div
        id={id}
        ref={ref}
        style={{
          width: "100%",
          maxWidth: 816,
          margin: "0 auto",
          background: "#fff",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#333",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {/* Header bar */}
        <div style={{ background: NAVY, color: "#fff", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>{inputs.companyName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.85 }}>
              <EhoSvg color="#ffffff" size={22} />
              <span style={{ fontSize: 8, color: "#fff", lineHeight: 1.2 }}>Equal Housing<br />Opportunity</span>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: 2, color: GOLD }}>
            Loan Benefits Worksheet
          </div>
        </div>

        {/* Title row */}
        <div style={{ padding: "20px 24px 4px" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: NAVY }}>
            {productHeading(inputs.productType)}
          </h1>
          <div style={{ color: GRAY, fontSize: 12, marginTop: 4 }}>
            Prepared for <strong style={{ color: NAVY }}>{preparedForName(inputs)}</strong>
            &nbsp;•&nbsp;{dateStr}
          </div>
          <div style={{ color: GRAY, fontSize: 11, marginTop: 2 }}>
            Loan Structure: <strong style={{ color: NAVY }}>{structureLabel}</strong>
          </div>
        </div>

        {/* Negative-savings warning */}
        {isNegativeSavings && (
          <div style={{ margin: "8px 24px 0", padding: "10px 14px", background: "#FEF2F2", border: `1px solid ${RED}`, borderRadius: 4, color: RED, fontSize: 12, ...noBreak }}>
            <strong>Heads up:</strong> With these inputs, the new loan does not produce monthly savings.
            This program may not be a fit — please adjust the inputs or consult Mykoal directly.
          </div>
        )}

        {/* Top row: snapshot + debts */}
        <div style={{ display: "flex", gap: 16, padding: "12px 24px", alignItems: "flex-start" }}>
          {/* Current Picture */}
          <div style={{ flex: 1, ...noBreak }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}`, paddingBottom: 4 }}>
              Your Current Picture
            </h2>
            <table style={tableStyle}>
              <tbody>
                {showFirstMortgageRow && (
                  <>
                    <tr>
                      <td style={tdStyle}>Existing Mortgage Balance</td>
                      <td style={tdNumStyle}>{money(inputs.existBalance)}{inputs.existRate > 0 ? ` @ ${pct(inputs.existRate)}` : ""}</td>
                    </tr>
                    <tr style={{ background: ROW_ALT }}>
                      <td style={tdStyle}>Total Monthly Payment (PITI)</td>
                      <td style={tdNumStyle}>{money(inputs.existTotalPayment)}</td>
                    </tr>
                  </>
                )}
                <tr style={{ background: showFirstMortgageRow ? "#fff" : ROW_ALT }}>
                  <td style={tdStyle}>Total Other Debt Balance</td>
                  <td style={tdNumStyle}>{money(results.debtBalance)}</td>
                </tr>
                <tr style={{ background: showFirstMortgageRow ? ROW_ALT : "#fff" }}>
                  <td style={tdStyle}>Total Debt Min Payments</td>
                  <td style={tdNumStyle}>{money(results.debtMinPmt)}</td>
                </tr>
                <tr style={{ background: LIGHT }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: NAVY }}>Current Total Outflow</td>
                  <td style={{ ...tdNumStyle, fontWeight: 700, color: NAVY }}>{money(results.currentTotalOutflow)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>{newLoanLabel} Amount</td>
                  <td style={tdNumStyle}>{money(inputs.loanAmount)} @ {aprStr}</td>
                </tr>
                <tr style={{ background: ROW_ALT }}>
                  <td style={tdStyle}>{newLoanLabel} Monthly P&I</td>
                  <td style={tdNumStyle}>{money(results.newLoanPmt)}</td>
                </tr>
                <tr>
                  <td style={tdStyle}>New Total Outflow</td>
                  <td style={tdNumStyle}>{money(results.newTotalOutflow)}</td>
                </tr>
                <tr style={{ background: LIGHT }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: isNegativeSavings ? RED : GREEN }}>
                    Monthly Savings (if applied to principal)
                  </td>
                  <td style={{ ...tdNumStyle, fontWeight: 700, color: isNegativeSavings ? RED : GREEN }}>
                    {money(results.monthlySavings)}
                  </td>
                </tr>
                {inputs.cashBack > 0 && (
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>Cash Back at Closing</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700, color: GREEN }}>{money(inputs.cashBack)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Debts table */}
          {inputs.debts.length > 0 && (
            <div style={{ flex: 1, ...noBreak }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}`, paddingBottom: 4 }}>
                Debts Rolled Into New {isHomeEquity ? "2nd Mortgage" : "Mortgage"}
              </h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Debt</th>
                    <th style={thNumStyle}>Balance</th>
                    <th style={thNumStyle}>Min Pmt</th>
                  </tr>
                </thead>
                <tbody>
                  {inputs.debts.map((d, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? ROW_ALT : "#fff" }}>
                      <td style={tdStyle}>{d.name || "—"}</td>
                      <td style={tdNumStyle}>{money(d.balance)}</td>
                      <td style={tdNumStyle}>{money(d.payment)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: LIGHT }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: NAVY }}>TOTALS</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700 }}>{money(results.debtBalance)}</td>
                    <td style={{ ...tdNumStyle, fontWeight: 700 }}>{money(results.debtMinPmt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Comparison table */}
        <div style={{ padding: "4px 24px 12px", ...noBreak }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}`, paddingBottom: 4 }}>
            Your Three Paths Compared
          </h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "22%" }}></th>
                <th style={{ ...thNumStyle, width: "26%" }}>
                  Current Path<br /><span style={{ fontWeight: 400, fontSize: 10 }}>(Keep Existing + Debts)</span>
                </th>
                <th style={{ ...thNumStyle, width: "26%" }}>
                  {isHomeEquity ? "Home Equity Loan" : "Refinance"}<br /><span style={{ fontWeight: 400, fontSize: 10 }}>(Standard Payment)</span>
                </th>
                <th style={{ ...thNumStyle, width: "26%", background: GOLD, color: NAVY }}>
                  {isHomeEquity ? "Home Equity Loan" : "Refinance"}<br /><span style={{ fontWeight: 400, fontSize: 10 }}>+ Savings Applied</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Monthly Payment", cur: money(current.monthlyPmt), con: money(consolidated.monthlyPmt), acc: money(accelerated.monthlyPmt) },
                { label: "Time to Debt-Free", cur: yrs(current.years), con: yrs(consolidated.years), acc: yrs(accelerated.years) },
                { label: "Total Interest", cur: "—", con: money(consolidated.totalInterest), acc: money(accelerated.totalInterest) },
                { label: "Interest Saved", cur: "—", con: "— (baseline)", acc: money(totalSaved), highlight: true },
                { label: "Time Saved", cur: "—", con: "— (baseline)", acc: yrs(timeSaved), highlight: true },
                ...(isNegativeSavings ? [] : [{
                  label: "Effective Rate on New Loan",
                  cur: "—",
                  con: aprStr,
                  acc: pct(accelerated.effectiveRate ?? 0) + " eff.†",
                }]),
              ].map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? ROW_ALT : "#fff" }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: NAVY }}>{row.label}</td>
                  <td style={tdNumStyle}>{row.cur}</td>
                  <td style={tdNumStyle}>{row.con}</td>
                  <td style={{ ...tdNumStyle, background: "rgba(201,167,77,0.12)", fontWeight: row.highlight ? 700 : undefined, color: row.highlight ? GREEN : undefined }}>
                    {row.acc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: GRAY, marginTop: 4 }}>
            † Illustrated effective rate assumes {money(results.extraMonthly)}/mo extra principal payment; this is not the loan&apos;s APR.
          </div>
        </div>

        {/* Banner */}
        {!isNegativeSavings && (
          <div style={{ margin: "0 24px 12px", background: NAVY, color: "#fff", padding: "12px 16px", borderRadius: 4, fontSize: 12, lineHeight: 1.6, ...noBreak }}>
            {explainer.banner}
          </div>
        )}

        {/* Bottom row: explainer + key numbers */}
        <div style={{ display: "flex", gap: 16, padding: "4px 24px 12px" }}>
          <div style={{ flex: 2, ...noBreak }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}`, paddingBottom: 4 }}>
              How This Strategy Works
            </h2>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "#333" }}>
              {explainer.paragraphs.map((p, i) => (
                <p key={i} style={{ margin: i < explainer.paragraphs.length - 1 ? "0 0 8px" : 0 }}>{p}</p>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, ...noBreak }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${GOLD}`, paddingBottom: 4 }}>
              Key Numbers at a Glance
            </h2>
            <table style={tableStyle}>
              <tbody>
                {[
                  ["Stated interest rate", pct(inputs.loanRate)],
                  ["APR (estimated)", newLoanApr > 0 ? pct(newLoanApr) : pct(inputs.loanRate)],
                  ["Loan structure", STRUCTURE_LABELS[inputs.loanStructure]],
                  ...(isNegativeSavings ? [] : [
                    ["Monthly savings (if applied)", money(results.extraMonthly)] as [string, string],
                    ["Years shaved off", timeSaved.toFixed(1) + " years"] as [string, string],
                    ["Total interest eliminated", money(totalSaved)] as [string, string],
                    ["Effective interest rate†", pct(accelerated.effectiveRate ?? 0)] as [string, string],
                  ]),
                  ...(inputs.cashBack > 0 ? [["Cash back at closing", money(inputs.cashBack)] as [string, string]] : []),
                ].map(([label, val], i) => (
                  <tr key={i} style={{ background: i % 2 === 1 ? ROW_ALT : "#fff" }}>
                    <td style={tdStyle}>{label}</td>
                    <td style={{ ...tdNumStyle, color: GREEN, fontWeight: 600 }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature block */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 24px", borderTop: `3px solid ${GOLD}`, marginTop: 8, ...noBreak }}>
          {inputs.headshotDataUrl ? (
            <img
              src={inputs.headshotDataUrl}
              alt={inputs.preparedBy}
              style={{
                width: 64, height: 64, borderRadius: "50%", objectFit: "cover",
                objectPosition: "top", border: `2px solid ${GOLD}`, flexShrink: 0,
              }}
            />
          ) : (
            <HeadshotPlaceholder size={64} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{inputs.preparedBy}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{inputs.preparedByTitle}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{inputs.companyName}</div>
            <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>{contactParts.join(" • ")}</div>
          </div>
        </div>

        {/* Compliance footer */}
        <div style={{ background: LIGHT, padding: "10px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 16, alignItems: "flex-start", ...noBreak }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <EhoSvg color={NAVY} size={32} />
            <div style={{ fontSize: 8, color: NAVY, lineHeight: 1.3, textAlign: "center", maxWidth: 60 }}>
              <strong>Equal Housing<br />Opportunity</strong>
            </div>
          </div>
          <div style={{ fontSize: 8.5, color: GRAY, lineHeight: 1.55, whiteSpace: "pre-line" }}>
            {complianceText}
          </div>
        </div>
      </div>
    );
  },
);
WorksheetDocument.displayName = "WorksheetDocument";
export default WorksheetDocument;

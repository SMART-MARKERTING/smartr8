import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Rect,
  Path,
  Line,
} from "@react-pdf/renderer";
import {
  WorksheetInputs,
  ScenarioResults,
  money,
  pct,
  yrs,
} from "@/lib/worksheetCalc";

const NAVY = "#1F2A44";
const GOLD = "#C9A74D";
const LIGHT = "#F4F1EA";
const GREEN = "#2E7D4F";
const GRAY = "#6B7280";
const BORDER = "#E5E5E5";
const ROW_ALT = "#FAFAFA";
const WHITE = "#FFFFFF";

const s = StyleSheet.create({
  page: {
    backgroundColor: WHITE,
    fontFamily: "Times-Roman",
    fontSize: 8.5,
    color: "#333333",
  },
  headerBar: {
    backgroundColor: NAVY,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  headerLeft: {
    color: WHITE,
    fontFamily: "Times-Bold",
    fontSize: 12,
  },
  headerRight: {
    color: GOLD,
    fontFamily: "Times-Bold",
    fontSize: 8,
    letterSpacing: 1.5,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  titleH1: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    color: NAVY,
    marginTop: 10,
    marginBottom: 2,
  },
  titleSub: {
    fontSize: 8,
    color: GRAY,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: "Times-Bold",
    fontSize: 9,
    color: NAVY,
    borderBottomWidth: 1.5,
    borderBottomColor: GOLD,
    paddingBottom: 2.5,
    marginBottom: 4,
  },
  twoCol: {
    flexDirection: "row",
    marginBottom: 8,
  },
  th: {
    backgroundColor: NAVY,
    paddingHorizontal: 5,
    paddingVertical: 3.5,
  },
  thText: {
    color: WHITE,
    fontFamily: "Times-Bold",
    fontSize: 7.5,
  },
  thTextRight: {
    color: WHITE,
    fontFamily: "Times-Bold",
    fontSize: 7.5,
    textAlign: "right",
  },
  thGold: {
    backgroundColor: GOLD,
    paddingHorizontal: 5,
    paddingVertical: 3.5,
  },
  thGoldText: {
    color: NAVY,
    fontFamily: "Times-Bold",
    fontSize: 7.5,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
  },
  td: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tdText: {
    fontSize: 8,
    color: "#333333",
  },
  tdNum: {
    fontSize: 8,
    color: "#333333",
    textAlign: "right",
  },
  tdGold: {
    backgroundColor: "#FDF5E0",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  totalsRow: {
    backgroundColor: LIGHT,
    flexDirection: "row",
  },
  totalsLabel: {
    fontFamily: "Times-Bold",
    fontSize: 8,
    color: NAVY,
  },
  totalsNum: {
    fontFamily: "Times-Bold",
    fontSize: 8,
    color: NAVY,
    textAlign: "right",
  },
  banner: {
    backgroundColor: NAVY,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  bannerText: {
    color: WHITE,
    fontSize: 8,
    lineHeight: 1.6,
  },
  highlightNum: {
    color: GREEN,
    fontFamily: "Times-Bold",
    fontSize: 8,
    textAlign: "right",
  },
  sigBlock: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: GOLD,
    paddingTop: 8,
    marginTop: 6,
  },
  sigHeadshot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
  },
  sigName: {
    fontFamily: "Times-Bold",
    fontSize: 10,
    color: NAVY,
    marginBottom: 1,
  },
  sigDetail: {
    fontSize: 7.5,
    color: GRAY,
  },
  compliance: {
    backgroundColor: LIGHT,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingHorizontal: 22,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ehoBox: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    flexShrink: 0,
  },
  ehoLabel: {
    fontSize: 6.5,
    color: NAVY,
    fontFamily: "Times-Bold",
    marginLeft: 4,
    lineHeight: 1.4,
  },
  complianceText: {
    fontSize: 6.5,
    color: GRAY,
    lineHeight: 1.5,
    flex: 1,
  },
});

export interface WorksheetPDFProps {
  inputs: WorksheetInputs;
  results: ScenarioResults;
  headshotUrl?: string;
}

export function WorksheetPDF({ inputs, results, headshotUrl }: WorksheetPDFProps) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const { current, consolidated, accelerated } = results;
  const totalSaved = consolidated.totalInterest - accelerated.totalInterest;
  const timeSaved = consolidated.years - accelerated.years;

  const contactParts: string[] = [];
  if (inputs.contactPhone) contactParts.push(inputs.contactPhone);
  if (inputs.contactEmail) contactParts.push(inputs.contactEmail);
  if (inputs.contactNMLS) contactParts.push("NMLS #" + inputs.contactNMLS);

  const licensingLine: string[] = [];
  if (inputs.companyName) licensingLine.push(inputs.companyName);
  if (inputs.companyNMLS) licensingLine.push("Company NMLS #" + inputs.companyNMLS);
  if (inputs.contactNMLS) licensingLine.push(inputs.preparedBy + " NMLS #" + inputs.contactNMLS);
  const licensingStr = licensingLine.join(" | ");
  const stateStr = inputs.licenseStates
    ? `Licensed to originate mortgage loans in ${inputs.licenseStates}.`
    : "";

  const snapshotRows: [string, string][] = [
    ["Existing Mortgage Balance", `${money(inputs.existBalance)} @ ${pct(inputs.existRate)}`],
    ["Existing Mortgage P&I", money(inputs.existPayment)],
    ["Monthly Escrow (taxes & ins.)", money(inputs.existEscrow)],
    ["Total Other Debt Balance", money(results.debtBalance)],
    ["Total Debt Payments", money(results.debtMinPmt)],
  ];

  const snapshotExtra: [string, string, boolean?][] = [
    ["New Loan Amount", `${money(inputs.loanAmount)} @ ${pct(inputs.loanRate)}`],
    ["New Loan Monthly P&I", money(results.newLoanPmt)],
    ["Extra Monthly Contribution", money(inputs.extraMonthly)],
    ...(inputs.cashBack > 0
      ? [["Cash Back at Closing", money(inputs.cashBack), true] as [string, string, boolean]]
      : []),
  ];

  type CmpRow = {
    label: string;
    cur: string;
    con: string;
    acc: string;
    highlight?: boolean;
    boldCon?: boolean;
    boldAcc?: boolean;
  };

  const cmpRows: CmpRow[] = [
    {
      label: "Monthly Payment",
      cur: money(current.monthlyPmt),
      con: money(consolidated.monthlyPmt),
      acc: money(accelerated.monthlyPmt) + "*",
    },
    {
      label: "Time to Debt-Free",
      cur: yrs(current.years),
      con: yrs(consolidated.years),
      acc: yrs(accelerated.years),
    },
    {
      label: "Total Interest",
      cur: "—",
      con: money(consolidated.totalInterest),
      acc: money(accelerated.totalInterest),
    },
    {
      label: "Interest Saved",
      cur: "—",
      con: "— (baseline)",
      acc: money(totalSaved),
      highlight: true,
    },
    {
      label: "Time Saved",
      cur: "—",
      con: "— (baseline)",
      acc: timeSaved.toFixed(1) + " yrs",
      highlight: true,
    },
    {
      label: "Effective Rate on New Loan",
      cur: "—",
      con: pct(inputs.loanRate),
      acc: pct(accelerated.effectiveRate ?? 0),
      boldCon: true,
      boldAcc: true,
    },
  ];

  const keyNumbers: [string, string][] = [
    ["Monthly amount applied to principal", money(inputs.extraMonthly)],
    ["Years shaved off", timeSaved.toFixed(1) + " years"],
    ["Total interest eliminated", money(totalSaved)],
    ["Effective interest rate", pct(accelerated.effectiveRate ?? 0)],
    ...(inputs.cashBack > 0
      ? [["Cash back at closing", money(inputs.cashBack)] as [string, string]]
      : []),
  ];

  return (
    <Document title="Loan Benefits Worksheet" author={inputs.preparedBy}>
      <Page size="LETTER" style={s.page}>
        {/* Full-width navy header */}
        <View style={s.headerBar}>
          <Text style={s.headerLeft}>{inputs.companyName}</Text>
          <Text style={s.headerRight}>LOAN BENEFITS WORKSHEET</Text>
        </View>

        {/* Padded body */}
        <View style={s.body}>
          <Text style={s.titleH1}>Loan Benefits Worksheet</Text>
          <Text style={s.titleSub}>
            {"Prepared for "}
            <Text style={{ fontFamily: "Times-Bold", color: NAVY }}>
              {inputs.clientName || "Client"}
            </Text>
            {"  \u2022  " + dateStr}
          </Text>

          {/* ── Top two-column: snapshot | debts ── */}
          <View style={s.twoCol}>
            {/* Snapshot */}
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={s.sectionHeading}>Your Current Picture</Text>
              {snapshotRows.map(([label, val], i) => (
                <View
                  key={i}
                  style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}
                >
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={s.tdText}>{label}</Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={s.tdNum}>{val}</Text>
                  </View>
                </View>
              ))}
              {/* Totals row */}
              <View style={s.totalsRow}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.totalsLabel}>Current Total Outflow</Text>
                </View>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.totalsNum}>{money(results.currentTotalOutflow)}</Text>
                </View>
              </View>
              {/* Extra rows */}
              {snapshotExtra.map(([label, val, isCash], i) => (
                <View
                  key={i}
                  style={[s.tableRow, { backgroundColor: i % 2 === 0 ? WHITE : ROW_ALT }]}
                >
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={[s.tdText, isCash ? { fontFamily: "Times-Bold" } : {}]}>
                      {label}
                    </Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text
                      style={[
                        s.tdNum,
                        isCash ? { fontFamily: "Times-Bold", color: GREEN } : {},
                      ]}
                    >
                      {val}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Debts */}
            <View style={{ flex: 1 }}>
              <Text style={s.sectionHeading}>Debts Rolled Into New Mortgage</Text>
              <View style={s.tableRow}>
                <View style={[s.th, { flex: 2 }]}>
                  <Text style={s.thText}>Debt</Text>
                </View>
                <View style={[s.th, { flex: 1 }]}>
                  <Text style={s.thTextRight}>Balance</Text>
                </View>
                <View style={[s.th, { flex: 1 }]}>
                  <Text style={s.thTextRight}>Rate</Text>
                </View>
                <View style={[s.th, { flex: 1 }]}>
                  <Text style={s.thTextRight}>Min Pmt</Text>
                </View>
              </View>
              {inputs.debts.map((d, i) => (
                <View
                  key={i}
                  style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}
                >
                  <View style={[s.td, { flex: 2 }]}>
                    <Text style={s.tdText}>{d.name}</Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={s.tdNum}>{money(d.balance)}</Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={s.tdNum}>{pct(d.rate)}</Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={s.tdNum}>{money(d.payment)}</Text>
                  </View>
                </View>
              ))}
              <View style={s.totalsRow}>
                <View style={[s.td, { flex: 2 }]}>
                  <Text style={s.totalsLabel}>TOTALS</Text>
                </View>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.totalsNum}>{money(results.debtBalance)}</Text>
                </View>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.tdNum}>—</Text>
                </View>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.totalsNum}>{money(results.debtMinPmt)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Comparison table (no-split) ── */}
          <View wrap={false}>
            <Text style={s.sectionHeading}>Your Three Paths Compared</Text>
            {/* Header */}
            <View style={s.tableRow}>
              <View style={[s.th, { flex: 22 }]}>
                <Text style={s.thText}> </Text>
              </View>
              <View style={[s.th, { flex: 26 }]}>
                <Text style={s.thTextRight}>Current Path</Text>
                <Text style={[s.thTextRight, { fontFamily: "Times-Roman", fontSize: 7 }]}>
                  (Keep Existing + Debts)
                </Text>
              </View>
              <View style={[s.th, { flex: 26 }]}>
                <Text style={s.thTextRight}>Refinance</Text>
                <Text style={[s.thTextRight, { fontFamily: "Times-Roman", fontSize: 7 }]}>
                  (Standard Payment)
                </Text>
              </View>
              <View style={[s.thGold, { flex: 26 }]}>
                <Text style={s.thGoldText}>Refinance</Text>
                <Text style={[s.thGoldText, { fontFamily: "Times-Roman", fontSize: 7 }]}>
                  + Savings Applied
                </Text>
              </View>
            </View>
            {/* Data rows */}
            {cmpRows.map((row, i) => (
              <View
                key={i}
                style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}
              >
                <View style={[s.td, { flex: 22 }]}>
                  <Text style={[s.tdText, { fontFamily: "Times-Bold", color: NAVY }]}>
                    {row.label}
                  </Text>
                </View>
                <View style={[s.td, { flex: 26 }]}>
                  <Text style={s.tdNum}>{row.cur}</Text>
                </View>
                <View style={[s.td, { flex: 26 }]}>
                  <Text style={[s.tdNum, row.boldCon ? { fontFamily: "Times-Bold" } : {}]}>
                    {row.con}
                  </Text>
                </View>
                <View style={[s.tdGold, { flex: 26 }]}>
                  {row.highlight ? (
                    <Text style={s.highlightNum}>{row.acc}</Text>
                  ) : (
                    <Text style={[s.tdNum, row.boldAcc ? { fontFamily: "Times-Bold" } : {}]}>
                      {row.acc}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            <View style={{ paddingHorizontal: 5, paddingTop: 3 }}>
              <Text style={{ fontSize: 6.5, color: GRAY }}>
                * Includes {money(inputs.extraMonthly)}/mo extra principal payment
              </Text>
            </View>
          </View>

          {/* ── Banner ── */}
          <View style={s.banner} wrap={false}>
            <Text style={s.bannerText}>
              {`By redirecting ${money(inputs.extraMonthly)}/month back onto your new loan's principal, your ${pct(inputs.loanRate)} loan effectively costs you ${pct(accelerated.effectiveRate ?? 0)} — saving ${money(totalSaved)} and ${timeSaved.toFixed(1)} years vs. a standard refinance.`}
            </Text>
          </View>

          {/* ── Bottom two-column: explainer | key numbers ── */}
          <View style={s.twoCol}>
            {/* Explainer */}
            <View style={{ flex: 2, marginRight: 12 }}>
              <Text style={s.sectionHeading}>How This Strategy Works</Text>
              <Text style={{ fontSize: 8, lineHeight: 1.7, color: "#333333", marginBottom: 5 }}>
                {`Today you pay a mortgage payment plus every other debt — ${money(results.currentTotalOutflow)} total each month. When the refi closes, the existing mortgage and all other debts are replaced by a single ${money(results.newLoanPmt)} payment — freeing up ${money(results.freedUp)} of monthly cash flow.`}
              </Text>
              <Text style={{ fontSize: 8, lineHeight: 1.7, color: "#333333", marginBottom: 5 }}>
                {`You then commit ${money(inputs.extraMonthly)} of that freed-up cash back to the new loan's principal each month. Every dollar of principal retired early never accrues interest again, which is why your stated ${pct(inputs.loanRate)} behaves like ${pct(accelerated.effectiveRate ?? 0)} in practice.`}
              </Text>
              <Text style={{ fontSize: 8, lineHeight: 1.7, color: "#333333" }}>
                {`Cash flow actually improves — you pay ${money(results.freedUp - inputs.extraMonthly)} less per month than you do today while still paying the loan off in ${accelerated.years.toFixed(1)} years instead of ${consolidated.years.toFixed(0)}.`}
              </Text>
            </View>

            {/* Key numbers */}
            <View style={{ flex: 1 }}>
              <Text style={s.sectionHeading}>Key Numbers at a Glance</Text>
              {keyNumbers.map(([label, val], i) => (
                <View
                  key={i}
                  style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}
                >
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={s.tdText}>{label}</Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={[s.tdNum, { color: GREEN, fontFamily: "Times-Bold" }]}>
                      {val}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── Signature block ── */}
          <View style={s.sigBlock} wrap={false}>
            {headshotUrl ? (
              <Image src={headshotUrl} style={s.sigHeadshot} />
            ) : null}
            <View>
              <Text style={s.sigName}>{inputs.preparedBy}</Text>
              <Text style={s.sigDetail}>{inputs.preparedByTitle}</Text>
              <Text style={s.sigDetail}>{inputs.companyName}</Text>
              {contactParts.length > 0 && (
                <Text style={[s.sigDetail, { marginTop: 2 }]}>{contactParts.join(" \u2022 ")}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Compliance footer ── */}
        <View style={s.compliance} wrap={false}>
          <View style={s.ehoBox}>
            <Svg width={24} height={24} viewBox="0 0 64 64">
              <Rect
                x={0}
                y={0}
                width={64}
                height={64}
                fill="none"
                stroke={NAVY}
                strokeWidth={2}
              />
              <Path
                d="M 12 34 L 32 18 L 52 34 L 52 52 L 12 52 Z"
                fill="none"
                stroke={NAVY}
                strokeWidth={2.5}
              />
              <Line x1={22} y1={40} x2={42} y2={40} stroke={NAVY} strokeWidth={2.5} />
              <Line x1={22} y1={46} x2={42} y2={46} stroke={NAVY} strokeWidth={2.5} />
            </Svg>
            <Text style={s.ehoLabel}>{"Equal\nHousing\nOpportunity"}</Text>
          </View>
          <Text style={s.complianceText}>
            {licensingStr ? licensingStr + ". " : ""}
            {stateStr ? stateStr + " " : ""}
            {"Verify licensing at www.nmlsconsumeraccess.org. This document is for informational and illustrative purposes only and does not constitute a commitment to lend, an offer to extend credit, a Loan Estimate, or a guarantee of any specific terms or rates. All loan applications are subject to credit approval, property appraisal, income and asset verification, and underwriting guidelines. Rates, terms, and program availability are subject to change without notice. The \u201ceffective rate\u201d calculation illustrates how applying additional principal payments may reduce total interest paid; it is not the loan\u2019s contractual or Annual Percentage Rate (APR). Consult a licensed loan originator for an official Loan Estimate. Prepared " +
              dateStr +
              "."}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

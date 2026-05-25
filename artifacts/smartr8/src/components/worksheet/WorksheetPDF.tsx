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
  STRUCTURE_LABELS,
  money,
  pct,
  yrs,
} from "@/lib/worksheetCalc";
import { buildExplainer, buildComplianceFooter, preparedForName, productHeading } from "@/lib/worksheetCopy";

const NAVY = "#1F2A44";
const GOLD = "#C9A74D";
const LIGHT = "#F4F1EA";
const GREEN = "#2E7D4F";
const RED = "#E31B23";
const GRAY = "#6B7280";
const BORDER = "#E5E5E5";
const ROW_ALT = "#FAFAFA";
const WHITE = "#FFFFFF";

// 0.5in = 36pt margins. Slightly larger fonts and more whitespace for readability.
const s = StyleSheet.create({
  page: { backgroundColor: WHITE, fontFamily: "Times-Roman", fontSize: 9.5, color: "#333333" },
  headerBar: { backgroundColor: NAVY, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 36, paddingVertical: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerCompany: { color: WHITE, fontFamily: "Times-Bold", fontSize: 13, marginRight: 8 },
  headerEhoLabel: { color: WHITE, fontSize: 6, lineHeight: 1.3, opacity: 0.9, marginLeft: 4 },
  headerRight: { color: GOLD, fontFamily: "Times-Bold", fontSize: 9, letterSpacing: 1.5 },
  body: { paddingHorizontal: 36, paddingBottom: 14 },
  titleH1: { fontFamily: "Times-Bold", fontSize: 18, color: NAVY, marginTop: 14, marginBottom: 3 },
  titleSub: { fontSize: 9, color: GRAY, marginBottom: 2 },
  titleStruct: { fontSize: 8.5, color: GRAY, marginBottom: 12 },
  warning: { borderWidth: 1, borderColor: RED, backgroundColor: "#FEF2F2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 3, marginBottom: 12, color: RED, fontSize: 9 },
  sectionHeading: { fontFamily: "Times-Bold", fontSize: 11, color: NAVY, borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 3, marginBottom: 6 },
  twoCol: { flexDirection: "row", marginBottom: 12 },
  fullSection: { marginBottom: 14 },
  th: { backgroundColor: NAVY, paddingHorizontal: 7, paddingVertical: 5 },
  thText: { color: WHITE, fontFamily: "Times-Bold", fontSize: 8.5 },
  thTextRight: { color: WHITE, fontFamily: "Times-Bold", fontSize: 8.5, textAlign: "right" },
  thGold: { backgroundColor: GOLD, paddingHorizontal: 7, paddingVertical: 5 },
  thGoldText: { color: NAVY, fontFamily: "Times-Bold", fontSize: 8.5, textAlign: "right" },
  tableRow: { flexDirection: "row" },
  td: { paddingHorizontal: 7, paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tdText: { fontSize: 9, color: "#333333" },
  tdNum: { fontSize: 9, color: "#333333", textAlign: "right" },
  tdGold: { backgroundColor: "#FDF5E0", paddingHorizontal: 7, paddingVertical: 4.5, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  totalsRow: { backgroundColor: LIGHT, flexDirection: "row" },
  totalsLabel: { fontFamily: "Times-Bold", fontSize: 9, color: NAVY },
  totalsNum: { fontFamily: "Times-Bold", fontSize: 9, color: NAVY, textAlign: "right" },
  savingsLabel: { fontFamily: "Times-Bold", fontSize: 9, color: GREEN },
  savingsNum: { fontFamily: "Times-Bold", fontSize: 9, color: GREEN, textAlign: "right" },
  banner: { backgroundColor: NAVY, borderRadius: 3, paddingHorizontal: 14, paddingVertical: 10, marginTop: 2, marginBottom: 12 },
  bannerText: { color: WHITE, fontSize: 9, lineHeight: 1.65 },
  highlightNum: { color: GREEN, fontFamily: "Times-Bold", fontSize: 9, textAlign: "right" },
  explainerPara: { fontSize: 9.5, lineHeight: 1.7, color: "#333333", marginBottom: 7 },
  sigBlock: { flexDirection: "row", alignItems: "center", borderTopWidth: 2, borderTopColor: GOLD, paddingTop: 10, marginTop: 8 },
  sigHeadshot: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  sigPlaceholder: { width: 54, height: 54, borderRadius: 27, marginRight: 12, backgroundColor: LIGHT, borderWidth: 1.5, borderColor: GOLD },
  sigName: { fontFamily: "Times-Bold", fontSize: 11, color: NAVY, marginBottom: 1 },
  sigDetail: { fontSize: 8.5, color: GRAY },
  compliance: { backgroundColor: LIGHT, borderTopWidth: 0.5, borderTopColor: BORDER, paddingHorizontal: 36, paddingVertical: 10, flexDirection: "row", alignItems: "flex-start" },
  ehoBox: { flexDirection: "column", alignItems: "center", marginRight: 10, flexShrink: 0 },
  ehoLabel: { fontSize: 6, color: NAVY, fontFamily: "Times-Bold", marginTop: 3, textAlign: "center", lineHeight: 1.3 },
  complianceText: { fontSize: 7, color: GRAY, lineHeight: 1.5, flex: 1 },
  footnote: { fontSize: 7.5, color: GRAY, paddingHorizontal: 5, paddingTop: 4 },
});

function EhoPdf({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64">
      <Rect x={0} y={0} width={64} height={64} fill="none" stroke={color} strokeWidth={2} />
      <Path d="M 12 34 L 32 18 L 52 34 L 52 52 L 12 52 Z" fill="none" stroke={color} strokeWidth={2.5} />
      <Line x1={22} y1={40} x2={42} y2={40} stroke={color} strokeWidth={2.5} />
      <Line x1={22} y1={46} x2={42} y2={46} stroke={color} strokeWidth={2.5} />
    </Svg>
  );
}

export interface WorksheetPDFProps {
  inputs: WorksheetInputs;
  results: ScenarioResults;
  /** Headshot URL or data URL. If omitted, uses inputs.headshotDataUrl, else placeholder. */
  headshotUrl?: string;
}

export function WorksheetPDF({ inputs, results, headshotUrl }: WorksheetPDFProps) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const { current, consolidated, accelerated, newLoanApr, isNegativeSavings } = results;
  const totalSaved = consolidated.totalInterest - accelerated.totalInterest;
  const timeSaved = consolidated.years - accelerated.years;
  const explainer = buildExplainer(inputs, results);
  const complianceBody = buildComplianceFooter(inputs);
  const isHomeEquity = inputs.productType === "HOME_EQUITY";
  const showFirstMortgageRow = inputs.hasExistingMortgage;
  const aprStr = newLoanApr > 0 ? `${pct(inputs.loanRate)} / ${pct(newLoanApr)} APR` : pct(inputs.loanRate);
  const newLoanLabel = isHomeEquity ? "New 2nd Mortgage" : "New Loan";

  const contactParts: string[] = [];
  if (inputs.contactPhone) contactParts.push(inputs.contactPhone);
  if (inputs.contactEmail) contactParts.push(inputs.contactEmail);
  if (inputs.contactNMLS) contactParts.push("NMLS #" + inputs.contactNMLS);

  const effectiveHeadshot = headshotUrl || inputs.headshotDataUrl;

  // ── Snapshot rows ──
  type RowDef = { label: string; val: string; bold?: boolean; color?: string };
  const snapshotRows: RowDef[] = [];
  if (showFirstMortgageRow) {
    snapshotRows.push({
      label: "Existing Mortgage Balance",
      val: `${money(inputs.existBalance)}${inputs.existRate > 0 ? ` @ ${pct(inputs.existRate)}` : ""}`,
    });
    snapshotRows.push({ label: "Total Monthly Payment (PITI)", val: money(inputs.existTotalPayment) });
  }
  snapshotRows.push({ label: "Total Other Debt Balance", val: money(results.debtBalance) });
  snapshotRows.push({ label: "Total Debt Min Payments", val: money(results.debtMinPmt) });

  const snapshotTotals: RowDef[] = [
    { label: "Current Total Outflow", val: money(results.currentTotalOutflow), bold: true, color: NAVY },
  ];

  const snapshotExtra: RowDef[] = [
    { label: `${newLoanLabel} Amount`, val: `${money(inputs.loanAmount)} @ ${aprStr}` },
    { label: `${newLoanLabel} Monthly P&I`, val: money(results.newLoanPmt) },
    { label: "New Total Outflow", val: money(results.newTotalOutflow) },
  ];

  type CmpRow = { label: string; cur: string; con: string; acc: string; highlight?: boolean; boldCon?: boolean; boldAcc?: boolean; };
  const cmpRows: CmpRow[] = [
    { label: "Monthly Payment", cur: money(current.monthlyPmt), con: money(consolidated.monthlyPmt), acc: money(accelerated.monthlyPmt) + "*" },
    { label: "Time to Debt-Free", cur: yrs(current.years), con: yrs(consolidated.years), acc: yrs(accelerated.years) },
    { label: "Total Interest", cur: "—", con: money(consolidated.totalInterest), acc: money(accelerated.totalInterest) },
    { label: "Interest Saved", cur: "—", con: "— (baseline)", acc: money(totalSaved), highlight: true },
    { label: "Time Saved", cur: "—", con: "— (baseline)", acc: timeSaved.toFixed(1) + " yrs", highlight: true },
  ];
  if (!isNegativeSavings) {
    cmpRows.push({
      label: "Effective Rate on New Loan",
      cur: "—",
      con: aprStr,
      acc: pct(accelerated.effectiveRate ?? 0) + " eff.",
      boldCon: true,
      boldAcc: true,
    });
  }

  const keyNumbers: [string, string][] = [
    ["Stated interest rate", pct(inputs.loanRate)],
    ["APR (estimated)", newLoanApr > 0 ? pct(newLoanApr) : pct(inputs.loanRate)],
    ["Loan structure", STRUCTURE_LABELS[inputs.loanStructure]],
  ];
  if (!isNegativeSavings) {
    keyNumbers.push(
      ["Monthly savings (if applied)", money(results.extraMonthly)],
      ["Years shaved off", timeSaved.toFixed(1) + " years"],
      ["Total interest eliminated", money(totalSaved)],
      ["Effective interest rate\u2020", pct(accelerated.effectiveRate ?? 0)],
    );
  }
  if (inputs.cashBack > 0) {
    keyNumbers.push(["Cash back at closing", money(inputs.cashBack)]);
  }

  return (
    <Document title="Loan Benefits Worksheet" author={inputs.preparedBy}>
      <Page size="LETTER" style={s.page}>
        <View style={s.headerBar} fixed>
          <View style={s.headerLeft}>
            <Text style={s.headerCompany}>{inputs.companyName}</Text>
            <EhoPdf color={WHITE} />
            <Text style={s.headerEhoLabel}>{"Equal\nHousing\nOpportunity"}</Text>
          </View>
          <Text style={s.headerRight}>LOAN BENEFITS WORKSHEET</Text>
        </View>

        <View style={s.body}>
          <Text style={s.titleH1}>{productHeading(inputs.productType)}</Text>
          <Text style={s.titleSub}>
            {"Prepared for "}
            <Text style={{ fontFamily: "Times-Bold", color: NAVY }}>{preparedForName(inputs)}</Text>
            {"  \u2022  " + dateStr}
          </Text>
          <Text style={s.titleStruct}>
            Loan Structure: <Text style={{ fontFamily: "Times-Bold", color: NAVY }}>{STRUCTURE_LABELS[inputs.loanStructure]}</Text>
          </Text>

          {isNegativeSavings && (
            <View style={s.warning} wrap={false}>
              <Text>
                Heads up: With these inputs, the new loan does not produce monthly savings.
                This program may not be a fit — please adjust inputs or consult Mykoal directly.
              </Text>
            </View>
          )}

          {/* Top two-col: snapshot + debts */}
          <View style={s.twoCol}>
            <View style={{ flex: 1, marginRight: inputs.debts.length > 0 ? 10 : 0 }} wrap={false}>
              <Text style={s.sectionHeading}>Your Current Picture</Text>
              {snapshotRows.map((r, i) => (
                <View key={`s${i}`} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.tdText}>{r.label}</Text></View>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.tdNum}>{r.val}</Text></View>
                </View>
              ))}
              {snapshotTotals.map((r, i) => (
                <View key={`t${i}`} style={s.totalsRow}>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.totalsLabel}>{r.label}</Text></View>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.totalsNum}>{r.val}</Text></View>
                </View>
              ))}
              {snapshotExtra.map((r, i) => (
                <View key={`e${i}`} style={[s.tableRow, { backgroundColor: i % 2 === 0 ? WHITE : ROW_ALT }]}>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.tdText}>{r.label}</Text></View>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.tdNum}>{r.val}</Text></View>
                </View>
              ))}
              {/* Auto-applied savings highlighted row */}
              <View style={s.totalsRow}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={isNegativeSavings ? { ...s.totalsLabel, color: RED } : s.savingsLabel}>
                    Monthly Savings (if applied to principal)
                  </Text>
                </View>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={isNegativeSavings ? { ...s.totalsNum, color: RED } : s.savingsNum}>
                    {money(results.monthlySavings)}
                  </Text>
                </View>
              </View>
              {inputs.cashBack > 0 && (
                <View style={[s.tableRow, { backgroundColor: WHITE }]}>
                  <View style={[s.td, { flex: 1 }]}><Text style={[s.tdText, { fontFamily: "Times-Bold" }]}>Cash Back at Closing</Text></View>
                  <View style={[s.td, { flex: 1 }]}><Text style={[s.tdNum, { fontFamily: "Times-Bold", color: GREEN }]}>{money(inputs.cashBack)}</Text></View>
                </View>
              )}
            </View>

            {inputs.debts.length > 0 && (
              <View style={{ flex: 1 }} wrap={false}>
                <Text style={s.sectionHeading}>
                  Debts Rolled Into New {isHomeEquity ? "2nd Mortgage" : "Mortgage"}
                </Text>
                <View style={s.tableRow}>
                  <View style={[s.th, { flex: 2 }]}><Text style={s.thText}>Debt</Text></View>
                  <View style={[s.th, { flex: 1 }]}><Text style={s.thTextRight}>Balance</Text></View>
                  <View style={[s.th, { flex: 1 }]}><Text style={s.thTextRight}>Min Pmt</Text></View>
                </View>
                {inputs.debts.map((d, i) => (
                  <View key={`d${i}`} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}>
                    <View style={[s.td, { flex: 2 }]}><Text style={s.tdText}>{d.name || "—"}</Text></View>
                    <View style={[s.td, { flex: 1 }]}><Text style={s.tdNum}>{money(d.balance)}</Text></View>
                    <View style={[s.td, { flex: 1 }]}><Text style={s.tdNum}>{money(d.payment)}</Text></View>
                  </View>
                ))}
                <View style={s.totalsRow}>
                  <View style={[s.td, { flex: 2 }]}><Text style={s.totalsLabel}>TOTALS</Text></View>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.totalsNum}>{money(results.debtBalance)}</Text></View>
                  <View style={[s.td, { flex: 1 }]}><Text style={s.totalsNum}>{money(results.debtMinPmt)}</Text></View>
                </View>
              </View>
            )}
          </View>

          {/* Comparison table */}
          <View wrap={false}>
            <Text style={s.sectionHeading}>Your Three Paths Compared</Text>
            <View style={s.tableRow}>
              <View style={[s.th, { flex: 22 }]}><Text style={s.thText}> </Text></View>
              <View style={[s.th, { flex: 26 }]}>
                <Text style={s.thTextRight}>Current Path</Text>
                <Text style={[s.thTextRight, { fontFamily: "Times-Roman", fontSize: 7 }]}>(Keep Existing + Debts)</Text>
              </View>
              <View style={[s.th, { flex: 26 }]}>
                <Text style={s.thTextRight}>{isHomeEquity ? "Home Equity Loan" : "Refinance"}</Text>
                <Text style={[s.thTextRight, { fontFamily: "Times-Roman", fontSize: 7 }]}>(Standard Payment)</Text>
              </View>
              <View style={[s.thGold, { flex: 26 }]}>
                <Text style={s.thGoldText}>{isHomeEquity ? "Home Equity Loan" : "Refinance"}</Text>
                <Text style={[s.thGoldText, { fontFamily: "Times-Roman", fontSize: 7 }]}>+ Savings Applied</Text>
              </View>
            </View>
            {cmpRows.map((row, i) => (
              <View key={`c${i}`} style={[s.tableRow, { backgroundColor: i % 2 === 1 ? ROW_ALT : WHITE }]}>
                <View style={[s.td, { flex: 22 }]}>
                  <Text style={[s.tdText, { fontFamily: "Times-Bold", color: NAVY }]}>{row.label}</Text>
                </View>
                <View style={[s.td, { flex: 26 }]}><Text style={s.tdNum}>{row.cur}</Text></View>
                <View style={[s.td, { flex: 26 }]}>
                  <Text style={[s.tdNum, row.boldCon ? { fontFamily: "Times-Bold" } : {}]}>{row.con}</Text>
                </View>
                <View style={[s.tdGold, { flex: 26 }]}>
                  {row.highlight ? (
                    <Text style={s.highlightNum}>{row.acc}</Text>
                  ) : (
                    <Text style={[s.tdNum, row.boldAcc ? { fontFamily: "Times-Bold" } : {}]}>{row.acc}</Text>
                  )}
                </View>
              </View>
            ))}
            <Text style={s.footnote}>
              * Includes {money(results.extraMonthly)}/mo extra principal payment{"\n"}
              {"\u2020"} Illustrated effective rate assumes extra principal payments; this is not the loan&apos;s APR.
            </Text>
          </View>

          {!isNegativeSavings && (
            <View style={s.banner} wrap={false}>
              <Text style={s.bannerText}>{explainer.banner}</Text>
            </View>
          )}

          {/* Full-width explainer paragraph block */}
          <View style={s.fullSection} wrap={false}>
            <Text style={s.sectionHeading}>How This Strategy Works</Text>
            {explainer.paragraphs.map((p, i) => (
              <Text
                key={`p${i}`}
                style={[
                  s.explainerPara,
                  i === explainer.paragraphs.length - 1 ? { marginBottom: 0 } : {},
                ]}
              >
                {p}
              </Text>
            ))}
          </View>

          {/* Full-width Key Numbers as a two-column compact table */}
          <View style={s.fullSection} wrap={false}>
            <Text style={s.sectionHeading}>Key Numbers at a Glance</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {keyNumbers.map(([label, val], i) => (
                <View
                  key={`k${i}`}
                  style={{
                    width: "50%",
                    flexDirection: "row",
                    backgroundColor: Math.floor(i / 2) % 2 === 1 ? ROW_ALT : WHITE,
                  }}
                >
                  <View style={[s.td, { flex: 1.5 }]}>
                    <Text style={s.tdText}>{label}</Text>
                  </View>
                  <View style={[s.td, { flex: 1 }]}>
                    <Text style={[s.tdNum, { color: GREEN, fontFamily: "Times-Bold" }]}>{val}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Signature block */}
          <View style={s.sigBlock} wrap={false}>
            {effectiveHeadshot ? (
              <Image src={effectiveHeadshot} style={s.sigHeadshot} />
            ) : (
              <View style={s.sigPlaceholder} />
            )}
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

        {/* Compliance footer */}
        <View style={s.compliance} wrap={false}>
          <View style={s.ehoBox}>
            <EhoPdf color={NAVY} />
            <Text style={s.ehoLabel}>{"Equal\nHousing\nOpportunity"}</Text>
          </View>
          <Text style={s.complianceText}>{complianceBody}</Text>
        </View>
      </Page>
    </Document>
  );
}

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import WorksheetDocument from "@/components/worksheet/WorksheetDocument";
import WorksheetInputPanel from "@/components/worksheet/WorksheetInputPanel";
import LeadCaptureModal from "@/components/worksheet/LeadCaptureModal";
import EmailSelfModal from "@/components/worksheet/EmailSelfModal";
import { computeScenarios, money, WorksheetInputs, DEFAULT_ADVISOR, DEFAULT_DEBTS } from "@/lib/worksheetCalc";
import { downloadWorksheetPdf } from "@/lib/generatePdf";

const DEFAULT_INPUTS: WorksheetInputs = {
  clientName: "",
  ...DEFAULT_ADVISOR,
  existBalance: 320000,
  existRate: 6.875,
  existAPR: 0,
  existPayment: 2100,
  existEscrow: 450,
  existYearsRemaining: 27,
  loanAmount: 380000,
  loanRate: 6.5,
  loanAPR: 0,
  termYears: 30,
  extraMonthly: 400,
  cashBack: 0,
  debts: DEFAULT_DEBTS,
};

function buildSummary(inputs: WorksheetInputs, results: ReturnType<typeof computeScenarios>): string {
  return [
    `New loan: ${money(inputs.loanAmount)} @ ${inputs.loanRate}% for ${inputs.termYears} yrs`,
    `Extra/mo: ${money(inputs.extraMonthly)}`,
    `Interest saved: ${money(results.consolidated.totalInterest - results.accelerated.totalInterest)}`,
    `Time saved: ${(results.consolidated.years - results.accelerated.years).toFixed(1)} yrs`,
  ].join(" | ");
}

export default function Worksheet() {
  const [inputs, setInputs] = useState<WorksheetInputs>(DEFAULT_INPUTS);
  const [gateOpen, setGateOpen] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [lead, setLead] = useState<{ firstName: string } | null>(null);
  const [emailSelfOpen, setEmailSelfOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const results = useMemo(() => computeScenarios(inputs), [inputs]);

  function handleLeadSuccess(leadData: { firstName: string }) {
    setLead(leadData);
    setUnlocked(true);
    setGateOpen(false);
    setInputs((prev) => ({ ...prev, clientName: leadData.firstName }));
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    setPdfLoading(true);
    try {
      const name = lead?.firstName ?? "Client";
      await downloadWorksheetPdf(inputs, results, `Loan-Benefits-Worksheet-${name}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
    setPdfLoading(false);
  }

  const worksheetSummary = buildSummary(inputs, results);

  return (
    <>
      <PageMeta
        title="Loan Benefits Worksheet | Adaxa Home"
        description="See exactly how consolidating your debts into a new mortgage could lower your monthly payment, eliminate interest, and get you debt-free years sooner."
        canonical="/worksheet"
        noIndex
      />
      <div className="min-h-screen bg-background flex flex-col print:bg-white">
        <div className="print:hidden">
          <Header />
        </div>

        <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 print:p-0">
          <div className="print:hidden mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
            <h1 className="text-3xl font-bold text-primary mt-4 mb-1">Loan Benefits Worksheet</h1>
            <p className="text-muted-foreground">
              Adjust the numbers to see how a refinance + debt consolidation strategy plays out for
              your situation. Powered by the same math Mykoal uses with every client.
            </p>
          </div>

          {!unlocked ? (
            /* Blurred preview gate */
            <div className="relative">
              <div className="pointer-events-none select-none filter blur-[6px] opacity-60 overflow-hidden rounded-lg border">
                <WorksheetDocument inputs={inputs} results={results} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/95 shadow-2xl rounded-xl p-8 max-w-sm text-center border">
                  <div className="text-4xl mb-3">📊</div>
                  <h2 className="text-xl font-bold text-primary mb-2">Your Free Worksheet</h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    See exactly how much you could save — personalized numbers, no credit check.
                  </p>
                  <button
                    onClick={() => setGateOpen(true)}
                    className="w-full h-11 rounded-md font-semibold text-white text-sm"
                    style={{ background: "#C9A74D" }}
                  >
                    Unlock My Worksheet →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Unlocked: two-column layout */
            <div className="flex flex-col lg:flex-row gap-8 print:block">
              {/* Input panel */}
              <aside className="lg:w-72 xl:w-80 shrink-0 print:hidden">
                <div className="sticky top-4 bg-card border rounded-lg p-5 shadow-sm">
                  <h2 className="font-semibold text-primary mb-4">Adjust the Numbers</h2>
                  <WorksheetInputPanel
                    inputs={inputs}
                    onChange={setInputs}
                    onPrint={handlePrint}
                    onDownloadPdf={handleDownloadPdf}
                    onEmailSelf={() => setEmailSelfOpen(true)}
                    pdfLoading={pdfLoading}
                  />
                </div>
              </aside>

              {/* Worksheet document */}
              <div className="flex-1 overflow-x-auto">
                <div className="min-w-[600px] border rounded-lg shadow-sm overflow-hidden">
                  <WorksheetDocument inputs={inputs} results={results} />
                </div>
              </div>
            </div>
          )}
        </main>

        <div className="print:hidden">
          <Footer />
        </div>

        <LeadCaptureModal
          open={gateOpen}
          onOpenChange={(open) => {
            if (!unlocked) setGateOpen(open);
          }}
          onSuccess={handleLeadSuccess}
        />

        <EmailSelfModal
          open={emailSelfOpen}
          onOpenChange={setEmailSelfOpen}
          inputs={inputs}
          results={results}
          worksheetSummary={worksheetSummary}
        />
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          body { margin: 0; }
        }
      `}</style>
    </>
  );
}

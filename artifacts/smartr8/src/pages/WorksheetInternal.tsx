import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Lock, Loader2, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import WorksheetDocument from "@/components/worksheet/WorksheetDocument";
import WorksheetInputPanel from "@/components/worksheet/WorksheetInputPanel";
import { computeScenarios, WorksheetInputs, DEFAULT_ADVISOR, DEFAULT_DEBTS } from "@/lib/worksheetCalc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const SESSION_KEY = "ws_internal_auth";

const DEFAULT_INPUTS: WorksheetInputs = {
  clientName: "",
  ...DEFAULT_ADVISOR,
  existBalance: 320000,
  existRate: 6.875,
  existPayment: 2100,
  existEscrow: 450,
  existYearsRemaining: 27,
  loanAmount: 380000,
  loanRate: 6.5,
  termYears: 30,
  extraMonthly: 400,
  cashBack: 0,
  debts: DEFAULT_DEBTS,
};

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/worksheet/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        sessionStorage.setItem(SESSION_KEY, "1");
        onSuccess();
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-card border rounded-xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-primary text-center mb-1">Internal Access</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Adaxa Home team only
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}

function EmailClientModal({
  open,
  onOpenChange,
  inputs,
  results,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inputs: WorksheetInputs;
  results: ReturnType<typeof computeScenarios>;
}) {
  const { toast } = useToast();
  const [clientEmail, setClientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const worksheetRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    if (!clientEmail.trim()) return;
    setSending(true);
    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;

      const el = document.getElementById("ws-internal-doc");
      if (!el) throw new Error("Worksheet element not found");

      const canvas = await html2canvas(el as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      const pdfWidth = 8.5;
      const pdfHeight = (canvas.height / canvas.width) * pdfWidth;
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, Math.min(pdfHeight, 11));

      const base64 = pdf.output("datauristring").split(",")[1];

      const res = await fetch("/api/worksheet/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "worksheet-internal",
          clientName: inputs.clientName,
          clientEmail,
          advisorName: inputs.preparedBy,
          pdfBase64: base64,
          fileName: `Loan-Benefits-Worksheet-${inputs.clientName.replace(/\s+/g, "-")}.pdf`,
        }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        toast({ title: "Worksheet sent!", description: `Email delivered to ${clientEmail}` });
        onOpenChange(false);
      } else {
        toast({ title: "Send failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
    setSending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Email Worksheet to Client</DialogTitle>
          <DialogDescription>
            The PDF will be generated and emailed to the client via Resend.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Client Email</Label>
            <Input
              type="email"
              placeholder="client@example.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Client Name</Label>
            <Input value={inputs.clientName} disabled className="bg-muted" />
          </div>
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-white"
            onClick={handleSend}
            disabled={sending || !clientEmail.trim()}
          >
            {sending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Send Worksheet</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WorksheetInternal() {
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
  });
  const [inputs, setInputs] = useState<WorksheetInputs>(DEFAULT_INPUTS);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { toast } = useToast();

  const results = useMemo(() => computeScenarios(inputs), [inputs]);

  if (!authed) {
    return (
      <>
        <PageMeta title="Internal | Adaxa Home" description="Internal worksheet tool." canonical="/worksheet/internal" noIndex />
        <LoginGate onSuccess={() => setAuthed(true)} />
      </>
    );
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    const el = document.getElementById("ws-internal-doc");
    if (!el) return;
    setPdfLoading(true);
    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;

      const canvas = await html2canvas(el as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      const pdfWidth = 8.5;
      const pdfHeight = (canvas.height / canvas.width) * pdfWidth;

      if (pdfHeight <= 11) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      } else {
        const pageHeightPx = (11 / pdfWidth) * canvas.width;
        let yOffset = 0;
        let page = 0;
        while (yOffset < canvas.height) {
          if (page > 0) pdf.addPage();
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.min(pageHeightPx, canvas.height - yOffset);
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -yOffset);
          const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
          const sliceHeight = (sliceCanvas.height / canvas.width) * pdfWidth;
          pdf.addImage(sliceData, "JPEG", 0, 0, pdfWidth, sliceHeight);
          yOffset += pageHeightPx;
          page++;
        }
      }

      const name = inputs.clientName.replace(/\s+/g, "-") || "Client";
      pdf.save(`Loan-Benefits-Worksheet-${name}.pdf`);
    } catch (err) {
      toast({ title: "PDF error", description: String(err), variant: "destructive" });
    }
    setPdfLoading(false);
  }

  return (
    <>
      <PageMeta title="Worksheet — Internal | Adaxa Home" description="Internal worksheet tool for Adaxa Home advisors." canonical="/worksheet/internal" noIndex />
      <div className="min-h-screen bg-background flex flex-col print:bg-white">
        <div className="print:hidden">
          <Header />
        </div>

        <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 print:p-0">
          <div className="print:hidden mb-6 flex items-center justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to home
              </Link>
              <h1 className="text-3xl font-bold text-primary mt-4 mb-1">
                Loan Benefits Worksheet <span className="text-base font-medium text-muted-foreground ml-2">— Internal</span>
              </h1>
              <p className="text-muted-foreground">
                Build a personalized worksheet for a client, then download or email the PDF.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-3 py-1">
              <Lock className="h-3 w-3" /> Internal only
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 print:block">
            {/* Input panel */}
            <aside className="lg:w-72 xl:w-80 shrink-0 print:hidden">
              <div className="sticky top-4 bg-card border rounded-lg p-5 shadow-sm">
                <h2 className="font-semibold text-primary mb-4">Worksheet Inputs</h2>
                <WorksheetInputPanel
                  inputs={inputs}
                  onChange={setInputs}
                  onPrint={handlePrint}
                  onDownloadPdf={handleDownloadPdf}
                  onEmailClient={() => setEmailOpen(true)}
                  isInternal
                  pdfLoading={pdfLoading}
                />
              </div>
            </aside>

            {/* Worksheet document */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[600px] border rounded-lg shadow-sm overflow-hidden">
                <WorksheetDocument id="ws-internal-doc" inputs={inputs} results={results} />
              </div>
            </div>
          </div>
        </main>

        <div className="print:hidden">
          <Footer />
        </div>
      </div>

      <EmailClientModal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        inputs={inputs}
        results={results}
      />

      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          body { margin: 0; }
        }
      `}</style>
    </>
  );
}

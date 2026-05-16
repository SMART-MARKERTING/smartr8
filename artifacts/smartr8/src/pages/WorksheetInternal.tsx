import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Lock, Loader2, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import WorksheetDocument from "@/components/worksheet/WorksheetDocument";
import WorksheetInputPanel from "@/components/worksheet/WorksheetInputPanel";
import { computeScenarios, WorksheetInputs, DEFAULT_ADVISOR, DEFAULT_DEBTS } from "@/lib/worksheetCalc";
import { downloadWorksheetPdf, getWorksheetPdfBase64 } from "@/lib/generatePdf";
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
        <p className="text-sm text-muted-foreground text-center mb-6">Adaxa Home team only</p>
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
  const [clientFirstName, setClientFirstName] = useState(
    () => inputs.clientName.trim().split(/\s+/)[0] ?? ""
  );
  const [clientLastName, setClientLastName] = useState(
    () => inputs.clientName.trim().split(/\s+/).slice(1).join(" ") ?? ""
  );
  const [clientEmail, setClientEmail] = useState("");
  const [sending, setSending] = useState(false);

  const clientName = `${clientFirstName.trim()} ${clientLastName.trim()}`.trim();

  async function handleSend() {
    if (!clientEmail.trim() || !clientFirstName.trim()) return;
    setSending(true);
    try {
      const base64 = await getWorksheetPdfBase64(inputs, results);
      const name = clientName || inputs.clientName || "Client";
      const res = await fetch("/api/worksheet/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "worksheet-internal",
          clientName: name,
          clientFirstName: clientFirstName.trim(),
          clientLastName: clientLastName.trim(),
          clientEmail,
          advisorName: inputs.preparedBy,
          pdfBase64: base64,
          fileName: `Loan-Benefits-Worksheet-${name.replace(/\s+/g, "-")}.pdf`,
          worksheetSummary: "",
        }),
      });

      const data = (await res.json()) as { success: boolean; emailOk?: boolean; emailError?: string; error?: string };
      if (data.success && data.emailOk) {
        toast({ title: `Sent to ${clientFirstName}!`, description: `Email delivered to ${clientEmail}` });
        onOpenChange(false);
      } else if (data.success && !data.emailOk) {
        toast({
          title: "Lead logged, but email may not have delivered",
          description: data.emailError ?? "Check Cloudflare logs — RESEND_API_KEY may not be set or domain not verified.",
          variant: "destructive",
        });
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
          <DialogTitle>Email Worksheet to a Client</DialogTitle>
          <DialogDescription>
            Generates the PDF from current worksheet numbers and emails it directly to the client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Jane"
                value={clientFirstName}
                onChange={(e) => setClientFirstName(e.target.value)}
                disabled={sending}
              />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input
                placeholder="Smith"
                value={clientLastName}
                onChange={(e) => setClientLastName(e.target.value)}
                disabled={sending}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Client Email <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              placeholder="client@example.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              disabled={sending}
            />
          </div>
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-white"
            onClick={handleSend}
            disabled={sending || !clientEmail.trim() || !clientFirstName.trim()}
          >
            {sending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Send to {clientFirstName || "Client"}</>
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
    setPdfLoading(true);
    try {
      const name = inputs.clientName.replace(/\s+/g, "-") || "Client";
      await downloadWorksheetPdf(inputs, results, `Loan-Benefits-Worksheet-${name}.pdf`);
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
                Loan Benefits Worksheet{" "}
                <span className="text-base font-medium text-muted-foreground ml-2">— Internal</span>
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

            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[600px] border rounded-lg shadow-sm overflow-hidden">
                <WorksheetDocument inputs={inputs} results={results} />
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

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, Download, Mail } from "lucide-react";
import { getWorksheetPdfBase64, downloadWorksheetPdf } from "@/lib/generatePdf";
import { computeScenarios, type WorksheetInputs } from "@/lib/worksheetCalc";

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";
const FORMSPREE = "https://formspree.io/f/meennekb";
const STATES = ["AZ", "CO", "CT", "FL", "MI", "MN", "OR", "PA", "TX", "VA", "WA"];

interface ExportLeadModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inputs: WorksheetInputs;
  results: ReturnType<typeof computeScenarios>;
  worksheetSummary: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  tcpa: boolean;
}

type ActionStatus = "idle" | "downloading" | "emailing" | "done-download" | "done-email" | "error";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function ExportLeadModal({
  open,
  onOpenChange,
  inputs,
  results,
  worksheetSummary,
}: ExportLeadModalProps) {
  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    state: "AZ",
    tcpa: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [errMsg, setErrMsg] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) e.firstName = "Required.";
    if (!form.lastName.trim()) e.lastName = "Required.";
    if (!form.email.trim() || !form.email.includes("@")) e.email = "Enter a valid email.";
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10)
      e.phone = "Enter a valid 10-digit phone number.";
    if (!form.state) e.state = "Required.";
    if (!form.tcpa) e.tcpa = "You must agree to be contacted.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submitLead(): Promise<void> {
    const lmPayload = {
      FirstName: form.firstName.trim(),
      LastName: form.lastName.trim(),
      Email: form.email.trim(),
      MobilePhone: form.phone.replace(/\D/g, ""),
      Phys_State: form.state,
      Loan_Request: "Worksheet Lead",
      Notes: [
        "Funnel: worksheet",
        `Submitted: ${new Date().toISOString()}`,
        "Source: smartr8.com/worksheet",
        worksheetSummary ? `\nWorksheet summary:\n${worksheetSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };

    try {
      const res = await fetch("/api/worksheet/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone,
          state: form.state,
          worksheetSummary,
          funnelType: "worksheet",
          submittedAt: new Date().toISOString(),
        }),
      });
      const data = (await res.json()) as { success: boolean; lmPayload?: Record<string, string> | null };
      if (data.lmPayload) {
        fetch(LM_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(data.lmPayload),
        }).catch(() => {});
      }
    } catch {
      fetch(LM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(lmPayload),
      }).catch(() => {});
      fetch(FORMSPREE, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _subject: `New Worksheet Lead — ${form.firstName} ${form.lastName}`,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone,
          state: form.state,
          source: "worksheet",
          worksheetSummary,
        }),
      }).catch(() => {});
    }
  }

  async function handleDownload() {
    if (!validate()) return;
    setStatus("downloading");
    setErrMsg("");
    try {
      await submitLead();
      const name = `${form.firstName.trim()}-${form.lastName.trim()}`;
      await downloadWorksheetPdf(inputs, results, `Loan-Benefits-Worksheet-${name}.pdf`);
      setStatus("done-download");
      setTimeout(() => handleClose(false), 1500);
    } catch {
      setStatus("error");
      setErrMsg("PDF generation failed. Please try again.");
    }
  }

  async function handleEmail() {
    if (!validate()) return;
    setStatus("emailing");
    setErrMsg("");
    const clientName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    try {
      const pdfBase64 = await getWorksheetPdfBase64(inputs, results);
      const res = await fetch("/api/worksheet/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "worksheet-self",
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          clientName,
          clientEmail: form.email.trim(),
          phone: form.phone,
          state: form.state,
          pdfBase64,
          fileName: `Loan-Benefits-Worksheet-${clientName.replace(/\s+/g, "-")}.pdf`,
          worksheetSummary,
        }),
      });
      const data = (await res.json()) as { success: boolean; emailOk?: boolean; error?: string };
      if (data.success) {
        setStatus("done-email");
      } else {
        setStatus("error");
        setErrMsg(data.error ?? "Email delivery failed. Please download instead.");
      }
    } catch {
      setStatus("error");
      setErrMsg("Could not send. Check your connection and try again.");
    }
  }

  function handleClose(v: boolean) {
    if (status === "downloading" || status === "emailing") return;
    onOpenChange(v);
    if (!v) {
      setTimeout(() => {
        setStatus("idle");
        setErrMsg("");
        setErrors({});
      }, 300);
    }
  }

  const busy = status === "downloading" || status === "emailing";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">Get your personalized worksheet</DialogTitle>
          <DialogDescription>
            Enter your info to download or email your results.
          </DialogDescription>
        </DialogHeader>

        {status === "done-email" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-semibold text-primary text-lg">Check your inbox.</p>
            <p className="text-sm text-muted-foreground">
              I'll be in touch shortly. — Mykoal
            </p>
            <Button className="w-full mt-2" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4 pt-1">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ex-firstName" className="text-sm font-medium">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ex-firstName"
                  placeholder="Jane"
                  value={form.firstName}
                  autoFocus
                  onChange={(e) => set("firstName", e.target.value)}
                  disabled={busy}
                />
                {errors.firstName && (
                  <p className="text-destructive text-xs">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ex-lastName" className="text-sm font-medium">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ex-lastName"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  disabled={busy}
                />
                {errors.lastName && (
                  <p className="text-destructive text-xs">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="ex-email" className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ex-email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={busy}
              />
              {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
            </div>

            {/* Phone + State */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ex-phone" className="text-sm font-medium">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ex-phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={form.phone}
                  onChange={(e) => set("phone", formatPhone(e.target.value))}
                  disabled={busy}
                />
                {errors.phone && <p className="text-destructive text-xs">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  State <span className="text-destructive">*</span>
                </Label>
                <Select value={form.state} onValueChange={(v) => set("state", v)} disabled={busy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.state && <p className="text-destructive text-xs">{errors.state}</p>}
              </div>
            </div>

            {/* TCPA */}
            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="ex-tcpa"
                  checked={form.tcpa}
                  onCheckedChange={(checked) => set("tcpa", checked === true)}
                  disabled={busy}
                />
                <Label
                  htmlFor="ex-tcpa"
                  className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                >
                  By checking this box I agree to be contacted by Mykoal DeShazo / Adaxa Home LLC
                  via phone, email, or text (including automated means) regarding mortgage products.
                  I understand consent is not required to obtain services. Message and data rates may
                  apply.
                </Label>
              </div>
              {errors.tcpa && (
                <p className="text-destructive text-xs pl-6">{errors.tcpa}</p>
              )}
            </div>

            {errMsg && (
              <p className="text-destructive text-sm text-center">{errMsg}</p>
            )}

            {status === "done-download" && (
              <p className="text-green-600 text-sm text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Download started!
              </p>
            )}

            {/* Two action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                type="button"
                className="h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
                onClick={handleDownload}
                disabled={busy}
              >
                {status === "downloading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download PDF
                  </>
                )}
              </Button>
              <Button
                type="button"
                className="h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
                onClick={handleEmail}
                disabled={busy}
              >
                {status === "emailing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Mail className="mr-1.5 h-4 w-4" />
                    Email to Myself
                  </>
                )}
              </Button>
            </div>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors py-1"
              onClick={() => handleClose(false)}
              disabled={busy}
            >
              Not ready yet
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

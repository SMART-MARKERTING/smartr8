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
import { Loader2, CheckCircle2, Mail } from "lucide-react";
import { getWorksheetPdfBase64 } from "@/lib/generatePdf";
import { computeScenarios, type WorksheetInputs } from "@/lib/worksheetCalc";
import { getOrCreateTrackingId } from "@/lib/submitLead";

interface ExportLeadModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inputs: WorksheetInputs;
  results: ReturnType<typeof computeScenarios>;
  worksheetSummary: string;
  /** Where to redirect after success. Defaults to /whats-next. */
  redirectTo?: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  tcpa: boolean;
}

type ActionStatus = "idle" | "sending" | "done" | "error";

export default function ExportLeadModal({
  open,
  onOpenChange,
  inputs,
  results,
  worksheetSummary,
  redirectTo,
}: ExportLeadModalProps) {
  // Pre-fill from worksheet inputs OR funnel contact sessionStorage (if user
  // already filled the unified funnel contact step before reaching the worksheet)
  const [form, setForm] = useState<FormState>(() => {
    let firstName = inputs.clientFirstName || "";
    let lastName = inputs.clientLastName || "";
    let email = "";
    try {
      const raw = sessionStorage.getItem("smartr8_funnel_contact_v1");
      if (raw) {
        const c = JSON.parse(raw);
        if (!firstName && c.firstName) firstName = c.firstName;
        if (!lastName && c.lastName) lastName = c.lastName;
        if (c.email) email = c.email;
      }
    } catch {}
    return { firstName, lastName, email, tcpa: false };
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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSend() {
    if (!validate()) return;
    setStatus("sending");
    setErrMsg("");
    const clientName = `${form.firstName.trim()} ${form.lastName.trim()}`;

    // Inject the lead's name onto the inputs so the PDF "Prepared For" line uses it
    const inputsWithName: WorksheetInputs = {
      ...inputs,
      clientFirstName: form.firstName.trim(),
      clientLastName: form.lastName.trim(),
    };

    try {
      const pdfBase64 = await getWorksheetPdfBase64(inputsWithName, results);
      const res = await fetch("/api/worksheet/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "worksheet-self",
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          clientName,
          clientEmail: form.email.trim(),
          phone: (() => { try { const c = sessionStorage.getItem("smartr8_funnel_contact_v1"); return c ? JSON.parse(c).mobile ?? "" : ""; } catch { return ""; } })(),
          pdfBase64,
          fileName: `Loan-Benefits-Worksheet-${clientName.replace(/\s+/g, "-")}.pdf`,
          worksheetSummary,
          trackingId: getOrCreateTrackingId(),
          consentBoxChecked: form.tcpa,
        }),
      });
      const data = (await res.json()) as { success: boolean; emailOk?: boolean; error?: string };
      if (data.success) {
        setStatus("done");
        // Meta Pixel `Lead` is fired on /whats-next mount (single source of truth).
        // 2-second redirect to /whats-next
        const redirect =
          redirectTo ??
          `/whats-next?source=worksheet&name=${encodeURIComponent(form.firstName.trim())}`;
        setTimeout(() => {
          window.location.href = redirect;
        }, 2000);
      } else {
        setStatus("error");
        setErrMsg(data.error ?? "Email delivery failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrMsg("Could not send. Check your connection and try again.");
    }
  }

  function handleClose(v: boolean) {
    if (status === "sending") return;
    onOpenChange(v);
    if (!v) {
      setTimeout(() => {
        setStatus("idle");
        setErrMsg("");
        setErrors({});
      }, 300);
    }
  }

  const busy = status === "sending";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">Email My Worksheet</DialogTitle>
          <DialogDescription>
            We&apos;ll email a personalized PDF of your results. No spam, ever.
          </DialogDescription>
        </DialogHeader>

        {status === "done" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="font-semibold text-primary text-lg">Sent! Check your inbox.</p>
            <p className="text-sm text-muted-foreground">
              Redirecting you to next steps…
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
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
                  By submitting this form, I agree to be contacted by Mykoal DeShazo / Adaxa Home
                  LLC via phone, email, or text (including automated means) regarding mortgage
                  products. Checking the box above is optional and confirms my consent. Consent is
                  not required to obtain services. Message and data rates may apply.
                </Label>
              </div>
              {errors.tcpa && (
                <p className="text-destructive text-xs pl-6">{errors.tcpa}</p>
              )}
            </div>

            {errMsg && (
              <p className="text-destructive text-sm text-center">{errMsg}</p>
            )}

            {/* Single action button */}
            <Button
              type="button"
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
              onClick={handleSend}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send My Worksheet
                </>
              )}
            </Button>

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

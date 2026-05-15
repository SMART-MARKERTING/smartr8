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
import { Loader2, CheckCircle2 } from "lucide-react";
import { getWorksheetPdfBase64 } from "@/lib/generatePdf";
import type { WorksheetInputs, ScenarioResults } from "@/lib/worksheetCalc";

interface EmailSelfModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inputs: WorksheetInputs;
  results: ScenarioResults;
  worksheetSummary: string;
}

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";

export default function EmailSelfModal({
  open,
  onOpenChange,
  inputs,
  results,
  worksheetSummary,
}: EmailSelfModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    setStatus("sending");
    setErrMsg("");

    const clientName = inputs.clientName || "Client";
    const nameParts = clientName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") ?? "";
    const fileName = `Loan-Benefits-Worksheet-${clientName.replace(/\s+/g, "-")}.pdf`;

    try {
      const pdfBase64 = await getWorksheetPdfBase64(inputs, results);

      const res = await fetch("/api/worksheet/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "worksheet-self",
          clientName,
          clientEmail: trimmed,
          pdfBase64,
          fileName,
          worksheetSummary,
        }),
      });

      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setStatus("done");
        // Browser-side LeadMailbox fallback
        fetch(LM_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            FirstName: firstName,
            LastName: lastName,
            Email: trimmed,
            MobilePhone: "",
            Phys_State: "",
            Loan_Request: "Worksheet Self-Send",
            Notes: `Funnel: worksheet-self\n${worksheetSummary}`,
          }),
        }).catch(() => {});
      } else {
        setStatus("error");
        setErrMsg(data.error ?? "Something went wrong. Please try again.");
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
        setEmail("");
        setErrMsg("");
      }, 300);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Email My Worksheet</DialogTitle>
          <DialogDescription>
            We'll send your personalized PDF straight to your inbox — no spam, just your numbers.
          </DialogDescription>
        </DialogHeader>

        {status === "done" ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="font-semibold text-primary text-lg">On its way!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check your inbox for your Loan Benefits Worksheet PDF. Mykoal will also reach out
                personally to walk through the numbers with you.
              </p>
            </div>
            <Button className="w-full mt-2" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="self-email">Your Email Address</Label>
              <Input
                id="self-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={status === "sending"}
                autoFocus
                className="h-11"
              />
            </div>

            {errMsg && <p className="text-destructive text-sm">{errMsg}</p>}

            <Button
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
              onClick={handleSend}
              disabled={
                status === "sending" || !email.trim() || !email.trim().includes("@")
              }
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating &amp; Sending…
                </>
              ) : (
                "Send My Worksheet →"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your info is only used to send your worksheet and for Mykoal to follow up.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

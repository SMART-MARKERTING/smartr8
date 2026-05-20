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
import { Loader2 } from "lucide-react";

interface LeadCaptureModalProps {
  open: boolean;
  onSuccess: (lead: { firstName: string; lastName: string; email: string }) => void;
  onOpenChange: (open: boolean) => void;
  worksheetSummary?: string;
}

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";
const FORMSPREE = "https://formspree.io/f/meennekb";

function getOrCreateTrackingId(): string {
  try {
    const key = "smartr8_tid";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export default function LeadCaptureModal({
  open,
  onSuccess,
  onOpenChange,
  worksheetSummary = "",
}: LeadCaptureModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tcpa, setTcpa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    tcpa?: string;
  }>({});

  const pageLoadTime = useState(() => Date.now())[0];

  function validate() {
    const e: typeof errors = {};
    if (!firstName.trim()) e.firstName = "First name is required.";
    if (!lastName.trim()) e.lastName = "Last name is required.";
    if (!email.trim() || !email.includes("@")) e.email = "Enter a valid email address.";
    return e;
  }

  async function handleSubmit(evt: React.FormEvent) {
    evt.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const lmPayload = {
      FirstName: firstName.trim(),
      LastName: lastName.trim(),
      Email: email.trim(),
      MobilePhone: "",
      Phys_State: "",
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

    // Fire lead submission in background — don't block unlock
    const trackingId = getOrCreateTrackingId();

    fetch("/api/worksheet/submit-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        funnelType: "worksheet",
        worksheetSummary,
        honeypot: "",
        pageLoadTime,
        submittedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        trackingId,
        consentBoxChecked: tcpa,
      }),
    })
      .then((res) => res.json())
      .then((result: { success: boolean; lmPayload?: Record<string, string> | null }) => {
        if (result.lmPayload) {
          // Server-side LM failed — try from browser
          fetch(LM_ENDPOINT, {
            method: "POST",
            mode: "no-cors",
            keepalive: true,
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(result.lmPayload),
          }).catch(() => {});
        }
      })
      .catch(() => {
        // Server unreachable — fire LM directly from browser
        fetch(LM_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(lmPayload),
        }).catch(() => {});
        // Formspree backup
        fetch(FORMSPREE, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _subject: `New Worksheet Lead — ${firstName} ${lastName}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            source: "worksheet",
            worksheetSummary,
          }),
        }).catch(() => {});
      });

    setSubmitting(false);
    onSuccess({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">Unlock Your Free Worksheet</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            See exactly how much you could save — personalized numbers, no credit check, no
            commitment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={firstName}
                autoFocus
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined }));
                }}
              />
              {errors.firstName && (
                <p className="text-destructive text-xs">{errors.firstName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined }));
                }}
              />
              {errors.lastName && (
                <p className="text-destructive text-xs">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
            />
            {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
          </div>

          {/* TCPA */}
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox
                id="tcpa"
                checked={tcpa}
                onCheckedChange={(checked) => {
                  setTcpa(checked === true);
                  if (errors.tcpa) setErrors((p) => ({ ...p, tcpa: undefined }));
                }}
              />
              <Label
                htmlFor="tcpa"
                className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                By submitting this form, I agree to be contacted by Mykoal DeShazo / Adaxa Home LLC
                via phone, email, or text (including automated means) regarding mortgage products.
                Checking the box above is optional and confirms my consent. Consent is not required
                to obtain services. Message and data rates may apply.
              </Label>
            </div>
            {errors.tcpa && (
              <p className="text-destructive text-xs pl-6">{errors.tcpa}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              "View My Worksheet →"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA · NMLS #1912347
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

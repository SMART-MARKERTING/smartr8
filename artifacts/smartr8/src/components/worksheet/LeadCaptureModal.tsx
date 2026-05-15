import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2 } from "lucide-react";

const LICENSED_STATES = ["AZ", "CO", "FL", "MI", "MN", "OR", "PA", "TX", "WA"] as const;

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(10, "Enter a valid phone number"),
  state: z.string().min(2, "State is required"),
  tcpa: z.literal(true, {
    errorMap: () => ({ message: "You must agree to be contacted" }),
  }),
});

type FormValues = z.infer<typeof schema>;

interface LeadCaptureModalProps {
  open: boolean;
  onSuccess: (lead: { firstName: string; lastName: string; email: string }) => void;
  onOpenChange: (open: boolean) => void;
  worksheetSummary?: string;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageLoadTime = useState(() => Date.now())[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { state: "AZ" },
  });

  const phoneValue = watch("phone") ?? "";

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    setError(null);

    const body = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone.replace(/\D/g, ""),
      state: data.state,
      funnelType: "worksheet",
      additionalFields: { worksheetSummary },
      honeypot: "",
      pageLoadTime,
      submittedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      trackingId: getOrCreateTrackingId(),
    };

    const lmPayload = {
      FirstName: data.firstName,
      LastName: data.lastName,
      Email: data.email,
      MobilePhone: data.phone.replace(/\D/g, ""),
      Phys_State: data.state,
      Loan_Request: "Worksheet Lead",
      Notes: `Funnel: worksheet\nWorksheet summary: ${worksheetSummary}`,
    };

    try {
      const res = await fetch("/api/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as {
        success: boolean;
        lmPayload?: Record<string, string> | null;
        error?: string;
      };

      if (result.lmPayload) {
        fetch(LM_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(result.lmPayload),
        }).catch(() => {});
      }
    } catch {
      fetch(LM_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(lmPayload),
      }).catch(() => {});
    }

    setSubmitting(false);
    onSuccess({ firstName: data.firstName, lastName: data.lastName, email: data.email });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl">Unlock Your Full Worksheet</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enter your info to view, print, and receive your personalized Loan Benefits Worksheet.
            No credit check — no commitment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input id="firstName" placeholder="Jane" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-destructive text-xs">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input id="lastName" placeholder="Smith" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-destructive text-xs">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-sm font-medium">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="email" placeholder="jane@example.com" {...register("email")} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-sm font-medium">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 555-5555"
                value={formatPhone(phoneValue)}
                onChange={(e) => setValue("phone", e.target.value)}
              />
              {errors.phone && (
                <p className="text-destructive text-xs">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                State <span className="text-destructive">*</span>
              </Label>
              <Select
                defaultValue="AZ"
                onValueChange={(v) => setValue("state", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {LICENSED_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && (
                <p className="text-destructive text-xs">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="tcpa"
              onCheckedChange={(checked) => setValue("tcpa", checked === true ? true : (undefined as unknown as true))}
            />
            <Label htmlFor="tcpa" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              By checking this box I agree to be contacted by Mykoal DeShazo / Adaxa Home LLC via
              phone, email, or text (including automated means) regarding mortgage products. I
              understand consent is not required to obtain services. Message and data rates may apply.
            </Label>
          </div>
          {errors.tcpa && (
            <p className="text-destructive text-xs -mt-2">{errors.tcpa.message}</p>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
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
            Licensed in AZ, CO, TX, FL, OR, WA, MN, MI, PA · NMLS #1912347
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

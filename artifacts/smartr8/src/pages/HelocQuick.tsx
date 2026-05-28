import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { submitLead } from "@/lib/submitLead";
import { trackFbEvent } from "@/lib/fbq";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, Zap } from "lucide-react";

// Adaxa Home is licensed in 11 states. Keep this list in sync with compliance.
const LICENSED_STATES = [
  { value: "AZ", label: "Arizona" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "FL", label: "Florida" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "TX", label: "Texas" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
];

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const SUBMIT_ERR =
  "Something went wrong with your submission. Please text or call Myke directly at (949) 418-5486 and he will get back to you within minutes.";

/**
 * /heloc/quick — Variant B of the HELOC split test.
 *
 * A single-step lead capture form for borrowers who already know they want a
 * HELOC and do not need the full /heloc funnel. On submit it records the lead
 * (LeadMailbox + Formspree, the same pipeline as every other form) tagged
 * variant "B", then routes straight to /heloc/instant-options.
 *
 * Variant A is the existing /heloc funnel. Bucket assignment lives in
 * src/lib/abTest.ts and routing happens from the home page HELOC card.
 */
export default function HelocQuick() {
  const [, setLocation] = useLocation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("");
  const [consentState, setConsentState] = useState({
    ready: false, consent: false, consent_version: "",
    consent_text: "", turnstile_token: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_name: "HELOC",
      content_category: "Mortgage",
      variant: "B",
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim()) { setError("Please enter your first name."); return; }
    if (!lastName.trim()) { setError("Please enter your last name."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
    // Phone is optional — only validate the format if the user actually typed something.
    const phoneDigits = phone.replace(/\D/g, "").length;
    if (phoneDigits > 0 && phoneDigits < 10) {
      setError("Please enter a valid 10-digit phone number or leave it blank.");
      return;
    }
    if (!state) { setError("Please select your property state."); return; }

    setIsSubmitting(true);
    try {
      const result = await submitLead({
        funnel: "heloc",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone,
        state,
        // 1-step form: pass pageLoadTime 0 so the Worker skips its "<8s = bot"
        // check. A genuinely fast submission here is expected, not a bot.
        pageLoadTime: 0,
        turnstile_token: consentState.turnstile_token,
        consent: consentState.consent,
        consent_version: consentState.consent_version,
        consent_text: consentState.consent_text,
        additionalFields: {
          variant: "B",
          "Funnel-Source": "heloc-quick",
        },
      });
      if (result.success) {
        // Variant B fires its Lead event here. Variant A fires on /heloc/whats-next.
        trackFbEvent("Lead", {
          content_name: "HELOC",
          content_category: "Mortgage",
          variant: "B",
        });
        setLocation(
          `/heloc/instant-options?name=${encodeURIComponent(firstName.trim())}&v=B`,
        );
      } else {
        setError(result.error || SUBMIT_ERR);
      }
    } catch {
      setError(SUBMIT_ERR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="See Your Instant HELOC Options | Adaxa Home"
        description="Already know you want a HELOC? Share a few details and go straight to your options with Mykoal DeShazo at Adaxa Home."
        canonical="/heloc/quick"
        noIndex
      />
      <Header />

      <main className="flex-1 py-12 md:py-20 px-4">
        <div className="container mx-auto max-w-xl">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
            >
              <Zap className="h-3.5 w-3.5" />
              Fast Path
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3 leading-tight">
              See your instant HELOC options
            </h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Already know you want a HELOC? Skip the long form. Share a few
              details and go straight to your options.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hq-first">First Name</Label>
                  <Input
                    id="hq-first"
                    type="text"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-12 text-base"
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hq-last">Last Name</Label>
                  <Input
                    id="hq-last"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-12 text-base"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hq-email">Email Address</Label>
                <Input
                  id="hq-email"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hq-phone">
                  Mobile Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  id="hq-phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="h-12 text-base"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hq-state">Property State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger id="hq-state" className="h-12 text-base">
                    <SelectValue placeholder="Select your state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSED_STATES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TcpaConsent onChange={setConsentState} />

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base bg-accent hover:bg-accent/90 text-white shadow-lg"
                disabled={isSubmitting || !consentState.ready}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    See My HELOC Options
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                No credit pull. No commitment.
              </p>
              <TcpaSubmitNotice />
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

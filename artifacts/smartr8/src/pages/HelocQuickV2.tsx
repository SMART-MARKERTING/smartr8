import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { submitLead } from "@/lib/submitLead";
import { trackFbEvent } from "@/lib/fbq";
import { useGA4 } from "@/hooks/useGA4";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, Zap, Shield, Clock, TrendingUp } from "lucide-react";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";

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

const TRUST_PILLS = [
  { icon: Shield, label: "Soft credit only" },
  { icon: Clock, label: "Results in minutes" },
  { icon: TrendingUp, label: "99+ lender network" },
];

const FUNNEL_VERSION = "v2";

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
  "Something went wrong with your submission. Please text or call Myke directly at (480) 206-9290 and he will get back to you within minutes.";

export default function HelocQuickV2() {
  const [, setLocation] = useLocation();
  const ga4 = useGA4("heloc");
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
      funnel_version: FUNNEL_VERSION,
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim()) { setError("Please enter your first name."); return; }
    if (!lastName.trim()) { setError("Please enter your last name."); return; }
    if (!isValidEmail(email)) { setError("Please enter a valid email address."); return; }
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
        pageLoadTime: 0,
        turnstile_token: consentState.turnstile_token,
        consent: consentState.consent,
        consent_version: consentState.consent_version,
        consent_text: consentState.consent_text,
        additionalFields: {
          variant: "B",
          "Funnel-Source": "heloc-quick-v2",
          funnel_version: FUNNEL_VERSION,
        },
      });
      if (result.success) {
        trackFbEvent("Lead", {
          content_name: "HELOC",
          content_category: "Mortgage",
          variant: "B",
          funnel_version: FUNNEL_VERSION,
          funnel_length: "short",
        });
        ga4.trackLead({ variant: "B", funnel_version: FUNNEL_VERSION, funnel_length: "short" });
        setLocation(
          `/heloc/next-step-v2?name=${encodeURIComponent(firstName.trim())}&v=B`,
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
        canonical="/heloc/quick-v2"
        noIndex
      />
      <Header />

      <main className="flex-1 pt-6 pb-8 sm:pt-10 sm:pb-14 px-4">
        <div className="container mx-auto max-w-xl">
          {/* COMPACT HERO */}
          <div className="text-center mb-5 sm:mb-6">
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3"
              style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
            >
              <Zap className="h-3.5 w-3.5" />
              Fast Path
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-2 leading-tight">
              See your instant HELOC options
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Already know you want a HELOC? Skip the long form. Share a few
              details and go straight to your options.
            </p>
          </div>

          {/* TRUST PILLS (above the form) */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {TRUST_PILLS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center text-center gap-1.5 py-3 px-2 rounded-xl border border-border"
                style={{ backgroundColor: "#F8F5F0" }}
              >
                <Icon className="h-4 w-4" style={{ color: "#1F8A5F" }} />
                <span className="text-[11px] sm:text-xs font-semibold text-foreground leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* FORM CARD */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-7">
            <form
              id="hq-v2-form"
              onSubmit={handleSubmit}
              noValidate
              className="space-y-4 pb-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hqv2-first" className="text-sm">First Name</Label>
                  <Input
                    id="hqv2-first"
                    type="text"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-12 text-base"
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hqv2-last" className="text-sm">Last Name</Label>
                  <Input
                    id="hqv2-last"
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

              <div className="space-y-1.5">
                <Label htmlFor="hqv2-email" className="text-sm">Email Address</Label>
                <Input
                  id="hqv2-email"
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hqv2-phone" className="text-sm">
                  Mobile Phone
                </Label>
                <Input
                  id="hqv2-phone"
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="h-12 text-base"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hqv2-state" className="text-sm">Property State</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger id="hqv2-state" className="h-12 text-base">
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
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Desktop submit (in-flow) */}
              <div className="hidden sm:block pt-1">
                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-accent hover:bg-accent/90 text-white shadow-lg rounded-xl"
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
                <p className="text-center text-xs text-muted-foreground mt-3">
                  No credit pull. No commitment.
                </p>
                <TcpaSubmitNotice />
              </div>
            </form>
          </div>

          {/* Spacer so mobile sticky CTA doesn't cover the consent box */}
          <div aria-hidden="true" className="h-24 sm:hidden" />
        </div>
      </main>

      {/* Mobile sticky bottom CTA */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="px-4 pt-3">
          <Button
            type="submit"
            form="hq-v2-form"
            className="w-full h-12 text-base bg-accent hover:bg-accent/90 text-white shadow-lg rounded-xl"
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
          <p className="text-center text-xs text-muted-foreground mt-1.5">
            No credit pull. No commitment.
          </p>
          <TcpaSubmitNotice />
        </div>
      </div>

      <Footer />
    </div>
  );
}

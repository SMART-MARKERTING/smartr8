import { useState, useRef } from "react";
import { submitLead } from "@/lib/submitLead";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

const VALUE_OPTIONS = [
  "Under $300K",
  "$300K to $500K",
  "$500K to $750K",
  "$750K to $1M",
  "$1M+",
];

const PURPOSE_OPTIONS = [
  "Home renovation or addition",
  "Debt consolidation",
  "Investment property purchase",
  "Business or self-employment capital",
  "Emergency reserve / access to funds",
  "Something else",
];

const TIMELINE_OPTIONS = [
  "As soon as possible",
  "Within 1 to 3 months",
  "Just exploring options",
];

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
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

interface FormData {
  home_value: string;
  mortgage_balance: string;
  heloc_purposes: string[];
  timeline: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  consent: boolean;
}

const INITIAL_FORM: FormData = {
  home_value: "",
  mortgage_balance: "",
  heloc_purposes: [],
  timeline: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  state: "",
  consent: false,
};

export function HelocForm() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePurpose = (option: string) => {
    setForm((prev) => ({
      ...prev,
      heloc_purposes: prev.heloc_purposes.includes(option)
        ? prev.heloc_purposes.filter((p) => p !== option)
        : [...prev.heloc_purposes, option],
    }));
  };

  const canAdvance = (): boolean => {
    if (step === 1) return !!(form.home_value && form.mortgage_balance);
    if (step === 2) return form.heloc_purposes.length > 0;
    if (step === 3) return !!form.timeline;
    return false;
  };

  const handleNext = () => {
    if (canAdvance()) {
      setError("");
      setStep((s) => s + 1);
    } else {
      if (step === 1) setError("Please select both your home value and mortgage balance.");
      if (step === 2) setError("Please select at least one option.");
      if (step === 3) setError("Please select your timeline.");
    }
  };

  const handleBack = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const pageLoadTimeRef = useRef(Date.now());
  const SUBMIT_ERR = "Something went wrong with your submission. Please text or call Myke directly at (949) 418-5486 and he will get back to you within minutes.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.first_name.trim()) { setError("Please enter your first name."); return; }
    if (!form.last_name.trim()) { setError("Please enter your last name."); return; }
    if (!isValidEmail(form.email)) { setError("Please enter a valid email address."); return; }
    if (form.phone.replace(/\D/g, "").length < 10) { setError("Please enter a valid 10-digit phone number."); return; }
    if (!form.state) { setError("Please select your property state."); return; }

    setIsSubmitting(true);
    try {
      const result = await submitLead({
        funnel: "heloc",
        firstName: form.first_name,
        lastName: form.last_name,
        email: form.email,
        phone: form.phone,
        state: form.state,
        homeValue: form.home_value,
        mortgageBalance: form.mortgage_balance,
        pageLoadTime: pageLoadTimeRef.current,
        additionalFields: {
          helocPurposes: form.heloc_purposes,
          timeline: form.timeline,
          variant: "A",
          consent_box_checked: form.consent ? "yes" : "no",
        },
      });
      if (result.success) {
        setLocation(`/heloc/whats-next?name=${encodeURIComponent(form.first_name)}`);
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
    <div className="w-full max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Step {step} of {totalSteps}</span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <form onSubmit={handleSubmit} noValidate>

        {/* STEP 1 — YOUR HOME */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-5">
            <h3 className="text-xl font-bold text-primary">Your Home</h3>

            <div className="space-y-2">
              <Label htmlFor="home_value">What's your estimated home value?</Label>
              <Select
                value={form.home_value}
                onValueChange={(v) => updateField("home_value", v)}
              >
                <SelectTrigger id="home_value" className="h-12 text-base">
                  <SelectValue placeholder="Select a range..." />
                </SelectTrigger>
                <SelectContent>
                  {VALUE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mortgage_balance">What do you owe on your current mortgage?</Label>
              <Select
                value={form.mortgage_balance}
                onValueChange={(v) => updateField("mortgage_balance", v)}
              >
                <SelectTrigger id="mortgage_balance" className="h-12 text-base">
                  <SelectValue placeholder="Select a range..." />
                </SelectTrigger>
                <SelectContent>
                  {VALUE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP 2 — YOUR GOAL */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-4">
            <h3 className="text-xl font-bold text-primary">Your Goal</h3>
            <p className="text-muted-foreground text-sm">What are you looking to use the HELOC for? Select all that apply.</p>
            <div className="space-y-3">
              {PURPOSE_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  htmlFor={`purpose-${opt}`}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border cursor-pointer hover:border-primary/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <Checkbox
                    id={`purpose-${opt}`}
                    checked={form.heloc_purposes.includes(opt)}
                    onCheckedChange={() => togglePurpose(opt)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-sm font-medium leading-snug">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — YOUR TIMELINE */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-4">
            <h3 className="text-xl font-bold text-primary">Your Timeline</h3>
            <p className="text-muted-foreground text-sm">When are you looking to access the funds?</p>
            <RadioGroup
              value={form.timeline}
              onValueChange={(v) => updateField("timeline", v)}
              className="space-y-3"
            >
              {TIMELINE_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  htmlFor={`timeline-${opt}`}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border cursor-pointer hover:border-primary/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem id={`timeline-${opt}`} value={opt} className="shrink-0" />
                  <span className="text-sm font-medium">{opt}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* STEP 4 — YOUR INFO */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-4">
            <h3 className="text-xl font-bold text-primary">Your Info</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  type="text"
                  placeholder="Jane"
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  className="h-12 text-base"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  className="h-12 text-base"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="h-12 text-base"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 555-5555"
                value={form.phone}
                onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                className="h-12 text-base"
                autoComplete="tel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Property State</Label>
              <Select
                value={form.state}
                onValueChange={(v) => updateField("state", v)}
              >
                <SelectTrigger id="state" className="h-12 text-base">
                  <SelectValue placeholder="Select your state..." />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 mt-2 bg-secondary/50 p-4 rounded-lg">
              <Checkbox
                id="heloc_consent"
                checked={form.consent}
                onCheckedChange={(checked) => updateField("consent", !!checked)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="heloc_consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                By submitting this form, you agree to be contacted by Mykoal DeShazo at Adaxa Home regarding your inquiry. Checking the box above is optional and confirms your consent. Consent is not a condition of any service. Standard rates may apply. You can opt out at any time.
              </label>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-6 flex gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="h-12 flex-none"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="h-12 flex-1 text-base bg-accent hover:bg-accent/90 text-white"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              className="h-12 flex-1 text-base bg-accent hover:bg-accent/90 text-white shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Get My HELOC Options
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, ArrowLeft, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface FunnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGoal?: string;
}

export function FunnelModal({ isOpen, onClose, initialGoal }: FunnelModalProps) {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [answers, setAnswers] = useState({
    goal: initialGoal || "",
    home_value: "",
    mortgage_balance: "",
    credit_range: "",
    property_zip: "",
    full_name: "",
    phone: "",
    email: "",
    consent: false,
  });

  useEffect(() => {
    if (isOpen) {
      if (initialGoal) {
        setAnswers(prev => ({ ...prev, goal: initialGoal }));
        setStep(2);
      } else {
        setAnswers(prev => ({ ...prev, goal: "" }));
        setStep(1);
      }
      setError("");
    }
  }, [isOpen, initialGoal]);

  const updateAnswer = (key: keyof typeof answers, value: string | boolean) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleOptionSelect = (key: keyof typeof answers, value: string) => {
    updateAnswer(key, value);
    if (step < 5) setStep(prev => prev + 1);
  };

  const handleNext = () => {
    if (step < 6) setStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.full_name || !answers.phone || !answers.email || !answers.consent) {
      setError("Please fill out all fields and check the consent box.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      Object.entries(answers).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      formData.append("_subject", `New SMARTR8 lead — ${answers.goal || "General"}`);
      formData.append("_next", "https://smartr8.com/thank-you");

      const response = await fetch("https://formspree.io/f/meennekb", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        onClose();
        setLocation("/thank-you");
      } else {
        const data = await response.json();
        setError(data.error || "There was a problem submitting your form. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (step / 6) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="sm:max-w-md w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:rounded-xl p-0 flex flex-col gap-0 border-0 bg-white overflow-hidden">
        <DialogTitle className="sr-only">See your mortgage options</DialogTitle>
        <DialogDescription className="sr-only">Answer a few questions to see your mortgage options from 99+ lenders</DialogDescription>

        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          {step > 1 ? (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 text-muted-foreground" data-testid="funnel-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="w-8" />
          )}
          <div className="text-sm font-medium text-muted-foreground">Step {step} of 6</div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground" data-testid="funnel-close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Progress value={progress} className="h-1 rounded-none bg-secondary shrink-0" />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <form id="funnel-form" onSubmit={handleSubmit} className="flex flex-col min-h-full">

            {/* STEP 1 — GOAL */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1">
                <h2 className="text-2xl font-bold text-primary mb-6">What are you trying to do?</h2>
                <div className="flex flex-col gap-3">
                  {[
                    "Pull cash out of my home",
                    "Lower my monthly payment",
                    "Buy or refinance a property",
                    "Not sure, show me options",
                  ].map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={`h-auto py-4 justify-start px-4 text-left text-base font-normal whitespace-normal ${answers.goal === option ? "border-primary ring-1 ring-primary bg-primary/5" : ""}`}
                      onClick={() => handleOptionSelect("goal", option)}
                      data-testid={`funnel-goal-${option.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z-]/g, "")}`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2 — HOME VALUE */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1">
                <h2 className="text-2xl font-bold text-primary mb-6">About how much is your home worth?</h2>
                <div className="flex flex-col gap-3">
                  {[
                    "Under $400K",
                    "$400K to $600K",
                    "$600K to $800K",
                    "$800K to $1M",
                    "Over $1M",
                  ].map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={`h-auto py-4 justify-start px-4 text-left text-base font-normal ${answers.home_value === option ? "border-primary ring-1 ring-primary bg-primary/5" : ""}`}
                      onClick={() => handleOptionSelect("home_value", option)}
                      data-testid={`funnel-value-${option.toLowerCase().replace(/[\s$+]/g, "-")}`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — MORTGAGE BALANCE */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1">
                <h2 className="text-2xl font-bold text-primary mb-6">About how much do you still owe?</h2>
                <div className="flex flex-col gap-3">
                  {[
                    "Under $200K",
                    "$200K to $400K",
                    "$400K to $600K",
                    "Over $600K",
                    "I own it free and clear",
                  ].map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={`h-auto py-4 justify-start px-4 text-left text-base font-normal ${answers.mortgage_balance === option ? "border-primary ring-1 ring-primary bg-primary/5" : ""}`}
                      onClick={() => handleOptionSelect("mortgage_balance", option)}
                      data-testid={`funnel-balance-${option.toLowerCase().replace(/[\s$+]/g, "-")}`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4 — CREDIT */}
            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1">
                <h2 className="text-2xl font-bold text-primary mb-6">Your credit is roughly...</h2>
                <div className="flex flex-col gap-3">
                  {[
                    "760 or higher",
                    "720 to 759",
                    "680 to 719",
                    "620 to 679",
                    "Below 620",
                    "Not sure",
                  ].map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={`h-auto py-4 justify-start px-4 text-left text-base font-normal ${answers.credit_range === option ? "border-primary ring-1 ring-primary bg-primary/5" : ""}`}
                      onClick={() => handleOptionSelect("credit_range", option)}
                      data-testid={`funnel-credit-${option.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5 — ZIP */}
            {step === 5 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1 flex flex-col">
                <h2 className="text-2xl font-bold text-primary mb-6">What zip code is the property in?</h2>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  placeholder="e.g. 85260"
                  className="text-lg py-6"
                  value={answers.property_zip}
                  onChange={(e) => updateAnswer("property_zip", e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  data-testid="funnel-zip-input"
                />
                <div className="mt-8 pt-4 border-t">
                  <Button
                    type="button"
                    className="w-full h-12 text-lg bg-primary hover:bg-primary/90"
                    disabled={answers.property_zip.length < 5}
                    onClick={handleNext}
                    data-testid="funnel-zip-continue"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 6 — CONTACT */}
            {step === 6 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1 flex flex-col">
                <h2 className="text-2xl font-bold text-primary mb-2">Last step. Where should I send your options?</h2>
                <p className="text-muted-foreground mb-6">No spam. No credit pull. Real options sent within hours.</p>

                <div className="flex flex-col gap-4 flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="Jane Doe"
                      value={answers.full_name}
                      onChange={(e) => updateAnswer("full_name", e.target.value)}
                      required
                      data-testid="funnel-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 555-5555"
                      value={answers.phone}
                      onChange={(e) => updateAnswer("phone", e.target.value)}
                      required
                      data-testid="funnel-phone-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@example.com"
                      value={answers.email}
                      onChange={(e) => updateAnswer("email", e.target.value)}
                      required
                      data-testid="funnel-email-input"
                    />
                  </div>

                  {/* TCPA Consent */}
                  <div className="flex items-start space-x-3 mt-2 bg-secondary/50 p-4 rounded-lg">
                    <Checkbox
                      id="consent"
                      checked={answers.consent as boolean}
                      onCheckedChange={(checked) => updateAnswer("consent", !!checked)}
                      className="mt-1"
                      data-testid="funnel-consent-checkbox"
                    />
                    <label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                      I agree to be contacted by Mykoal DeShazo at Adaxa Home by phone, text, or email about mortgage options. Consent is not a condition of any service. I can opt out anytime. Standard message and data rates may apply.
                    </label>
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="funnel-error">
                      {error}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t">
                  <Button
                    type="submit"
                    className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-white shadow-lg"
                    disabled={isSubmitting || !answers.full_name || !answers.phone || !answers.email || !answers.consent}
                    data-testid="funnel-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Get My Options
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* EHO footer */}
        <div className="shrink-0 border-t px-6 py-3 flex items-center justify-center gap-2 bg-secondary/20">
          <img src="/eho-logo.png" alt="Equal Housing Opportunity" className="h-4 w-auto object-contain opacity-70" />
          <span className="text-[10px] text-muted-foreground">Equal Housing Opportunity · NMLS #1912347 · Adaxa Home, LLC NMLS #2380533</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

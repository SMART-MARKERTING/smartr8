import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, ArrowLeft, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { submitLead, type FunnelId } from "@/lib/submitLead";

const HOME_VALUE_RANGES = [
  "Under $300,000",
  "$300,000 - $500,000",
  "$500,000 - $750,000",
  "$750,000 - $1,000,000",
  "$1,000,000 - $1,500,000",
  "Over $1,500,000",
  "Other",
];

const MORTGAGE_RANGES = [
  "Under $200,000",
  "$200,000 - $400,000",
  "$400,000 - $600,000",
  "$600,000 - $800,000",
  "$800,000 - $1,000,000",
  "Over $1,000,000",
  "No mortgage",
  "Other",
];

const CREDIT_RANGES = [
  "580 - 619",
  "620 - 659",
  "660 - 699",
  "700 - 739",
  "740 - 779",
  "780+",
  "Not sure",
];

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

  const [pageLoadTime] = useState(() => Date.now());
  const [answers, setAnswers] = useState({
    goal: initialGoal || "",
    home_value: "",
    home_value_draft: "",
    mortgage_balance: "",
    mortgage_balance_draft: "",
    credit_range: "",
    property_zip: "",
    full_name: "",
    phone: "",
    email: "",
    consent: false,
    honeypot: "",
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

  const autoAdvance = (key: keyof typeof answers, value: string) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    setTimeout(() => setStep(prev => prev + 1), 380);
  };

  const handleOptionSelect = (key: keyof typeof answers, value: string) => {
    updateAnswer(key, value);
    if (value === "Other") return;
    if (step < 5) {
      setTimeout(() => setStep(prev => prev + 1), 380);
    }
  };

  const handleNext = () => {
    if (step < 6) setStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
  };

  const SUBMIT_ERR = "Something went wrong with your submission. Please text or call Myke directly at (949) 418-5486 and he will get back to you within minutes.";
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.full_name || !answers.phone || !answers.email || !answers.consent) {
      setError("Please fill out all fields and check the consent box.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const [firstName, ...lastParts] = answers.full_name.trim().split(" ");
      const lastName = lastParts.join(" ") || "—";
      const funnelType: FunnelId =
        answers.goal.toLowerCase().includes("cash out") || answers.goal.toLowerCase().includes("pull") ? "cashout" :
        answers.goal.toLowerCase().includes("lower") ? "rate-reduction" :
        answers.goal.toLowerCase().includes("buy") ? "purchase" : "heloc";
      const result = await submitLead({
        funnel: funnelType,
        firstName,
        lastName,
        email: answers.email,
        phone: answers.phone,
        homeValue: answers.home_value,
        mortgageBalance: answers.mortgage_balance,
        creditScore: answers.credit_range,
        zip: answers.property_zip,
        honeypot: answers.honeypot,
        pageLoadTime,
        additionalFields: { goal: answers.goal },
      });
      if (result.success) {
        onClose();
        setLocation(`/apply/cash-out/whats-next?name=${encodeURIComponent(firstName)}`);
      } else {
        setError(result.error || SUBMIT_ERR);
        setIsSubmitting(false);
      }
    } catch {
      setError(SUBMIT_ERR);
      setIsSubmitting(false);
    }
  };

  const progress = (step / 6) * 100;

  const optionClass = (selected: boolean) =>
    `h-auto py-3.5 justify-start px-4 text-left text-base font-normal whitespace-normal transition-colors ${
      selected ? "border-primary ring-1 ring-primary bg-primary/5" : ""
    }`;

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
                      className={optionClass(answers.goal === option)}
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
                <div className="flex flex-col gap-2.5">
                  {HOME_VALUE_RANGES.map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={optionClass(answers.home_value === option)}
                      onClick={() => handleOptionSelect("home_value", option)}
                      data-testid={`funnel-value-${option.toLowerCase().replace(/[\s$+,]/g, "-")}`}
                    >
                      {option}
                    </Button>
                  ))}
                  {answers.home_value === "Other" && (
                    <div className="mt-2 flex flex-col gap-3">
                      <Input
                        placeholder="e.g. $425,000"
                        value={answers.home_value_draft}
                        onChange={(e) => updateAnswer("home_value_draft", e.target.value)}
                        className="text-lg py-6"
                        autoFocus
                        data-testid="funnel-value-other-input"
                      />
                      <Button
                        type="button"
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold"
                        disabled={!answers.home_value_draft.trim()}
                        onClick={() => {
                          autoAdvance("home_value", answers.home_value_draft);
                        }}
                        data-testid="funnel-value-other-continue"
                      >
                        Continue
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3 — MORTGAGE BALANCE */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1">
                <h2 className="text-2xl font-bold text-primary mb-6">How much do you owe on your mortgage?</h2>
                <div className="flex flex-col gap-2.5">
                  {MORTGAGE_RANGES.map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={optionClass(answers.mortgage_balance === option)}
                      onClick={() => handleOptionSelect("mortgage_balance", option)}
                      data-testid={`funnel-balance-${option.toLowerCase().replace(/[\s$+,]/g, "-")}`}
                    >
                      {option}
                    </Button>
                  ))}
                  {answers.mortgage_balance === "Other" && (
                    <div className="mt-2 flex flex-col gap-3">
                      <Input
                        placeholder="e.g. $325,000"
                        value={answers.mortgage_balance_draft}
                        onChange={(e) => updateAnswer("mortgage_balance_draft", e.target.value)}
                        className="text-lg py-6"
                        autoFocus
                        data-testid="funnel-balance-other-input"
                      />
                      <Button
                        type="button"
                        className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold"
                        disabled={!answers.mortgage_balance_draft.trim()}
                        onClick={() => {
                          autoAdvance("mortgage_balance", answers.mortgage_balance_draft);
                        }}
                        data-testid="funnel-balance-other-continue"
                      >
                        Continue
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4 — CREDIT */}
            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex-1">
                <h2 className="text-2xl font-bold text-primary mb-6">Your estimated credit score is...</h2>
                <div className="flex flex-col gap-2.5">
                  {CREDIT_RANGES.map(option => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      className={optionClass(answers.credit_range === option)}
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
                    className="w-full h-12 text-lg bg-primary hover:bg-primary/90 text-white"
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
                  <input type="text" name="website" value={answers.honeypot} onChange={(e) => updateAnswer("honeypot", e.target.value)} tabIndex={-1} aria-hidden="true" autoComplete="off" style={{ position:"absolute", left:"-9999px", opacity:0, height:0, width:0 }} />
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

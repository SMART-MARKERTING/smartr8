import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { FunnelLayout, ChoiceCard } from "@/components/FunnelLayout";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { submitLead } from "@/lib/submitLead";
import { useGA4 } from "@/hooks/useGA4";

const SESSION_KEY = "funnel_ratereduction";
const TOTAL = 9;
const STEP_NAMES = ["name","address","home_value","mortgage_balance","current_rate","primary_goal","credit_score","dob","contact"];

const HOME_VALUE_RANGES = ["Under $300,000","$300,000 - $500,000","$500,000 - $750,000","$750,000 - $1,000,000","$1,000,000 - $1,500,000","Over $1,500,000","Other"];
const MORTGAGE_RANGES = ["Under $200,000","$200,000 - $400,000","$400,000 - $600,000","$600,000 - $800,000","$800,000 - $1,000,000","Over $1,000,000","No mortgage","Other"];
const RATE_RANGES = ["Under 4%","4% - 5%","5% - 6%","6% - 7%","7% - 8%","Over 8%","Not sure","Other"];
const GOALS = ["Lower my monthly payment","Shorten my loan term","Switch from adjustable to fixed","Both lower payment and shorter term"];
const CREDIT_RANGES = ["580 - 619","620 - 659","660 - 699","700 - 739","740 - 779","780+","Not sure"];

type FS = {
  step: number; firstName: string; lastName: string;
  address: string; city: string; stateCode: string; zip: string;
  homeValue: string; homeValueDraft: string;
  mortgageBalance: string; mortgageBalanceDraft: string;
  currentRate: string; currentRateDraft: string;
  primaryGoal: string; creditScore: string;
  dob: string; email: string; phone: string; consent: boolean;
  honeypot: string; pageLoadTime: number;
};
const DEFAULT: FS = { step:1,firstName:"",lastName:"",address:"",city:"",stateCode:"",zip:"",homeValue:"",homeValueDraft:"",mortgageBalance:"",mortgageBalanceDraft:"",currentRate:"",currentRateDraft:"",primaryGoal:"",creditScore:"",dob:"",email:"",phone:"",consent:false,honeypot:"",pageLoadTime:0 };

export default function RateReductionFunnel() {
  const [, setLocation] = useLocation();
  const ga4 = useGA4("rate-reduction");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [st, setSt] = useState<FS>(() => {
    try { const s = sessionStorage.getItem(SESSION_KEY); return s ? (JSON.parse(s) as FS) : { ...DEFAULT, pageLoadTime: Date.now() }; }
    catch { return { ...DEFAULT, pageLoadTime: Date.now() }; }
  });

  useEffect(() => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(st)); }, [st]);
  useEffect(() => { ga4.trackFunnelStart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const p = (patch: Partial<FS>) => setSt((prev) => ({ ...prev, ...patch }));
  const advance = () => setSt((prev) => { ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step-1]); return { ...prev, step: prev.step+1 }; });
  const back = () => setSt((prev) => ({ ...prev, step: prev.step-1 }));
  const autoAdvance = (patch: Partial<FS>) => {
    setSt((prev) => ({ ...prev, ...patch }));
    setTimeout(() => setSt((prev) => { ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step-1]); return { ...prev, step: prev.step+1 }; }), 380);
  };
  const advanceWithPatch = (patch: Partial<FS>) => setSt((prev) => { ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step-1]); return { ...prev, ...patch, step: prev.step+1 }; });

  const SUBMIT_ERR = "Something went wrong with your submission. Please text or call Myke directly at (949) 418-5486 and he will get back to you within minutes.";
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!st.email || !st.phone || !st.consent) { setSubmitError("Please fill out all fields and accept the consent."); return; }
    setIsSubmitting(true); setSubmitError("");
    try {
      const result = await submitLead({ funnel:"rate-reduction", firstName:st.firstName, lastName:st.lastName, email:st.email, phone:st.phone, address:st.address, city:st.city, state:st.stateCode, zip:st.zip, homeValue:st.homeValue, mortgageBalance:st.mortgageBalance, creditScore:st.creditScore, dob:st.dob, honeypot:st.honeypot, pageLoadTime:st.pageLoadTime, additionalFields:{ currentRate:st.currentRate, primaryGoal:st.primaryGoal } });
      if (result.success) { ga4.trackLead(); sessionStorage.removeItem(SESSION_KEY); setLocation(`/apply/rate-reduction/whats-next?name=${encodeURIComponent(st.firstName)}`); }
      else { setSubmitError(result.error || SUBMIT_ERR); setIsSubmitting(false); }
    } catch { setSubmitError(SUBMIT_ERR); setIsSubmitting(false); }
  };

  return (
    <FunnelLayout step={st.step} totalSteps={TOTAL} onBack={st.step > 1 ? back : undefined}>

      {st.step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your name?</h2>
          <p className="text-muted-foreground mb-8">We'll use this to personalize your options.</p>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5"><Label htmlFor="fn">First Name</Label><Input id="fn" placeholder="Jane" value={st.firstName} onChange={(e) => p({ firstName:e.target.value })} className="text-base py-5" autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="ln">Last Name</Label><Input id="ln" placeholder="Doe" value={st.lastName} onChange={(e) => p({ lastName:e.target.value })} className="text-base py-5" /></div>
            <Button type="button" className="w-full h-14 mt-4 bg-primary hover:bg-primary/90 text-white text-base font-semibold" disabled={!st.firstName.trim() || !st.lastName.trim()} onClick={advance}>Continue</Button>
          </div>
        </div>
      )}

      {st.step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your property address?</h2>
          <p className="text-muted-foreground mb-8">We use this to find local lending options.</p>
          <div className="flex flex-col gap-4">
            <AddressAutocomplete value={st.address} onChange={(r) => p({ address:r.formatted, city:r.city, stateCode:r.state, zip:r.zip })} />
            <Button type="button" className="w-full h-14 mt-2 bg-primary hover:bg-primary/90 text-white text-base font-semibold" disabled={!st.address.trim()} onClick={advance}>Continue</Button>
          </div>
        </div>
      )}

      {st.step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your home's estimated value?</h2>
          <p className="text-muted-foreground mb-8">A rough estimate is fine.</p>
          <div className="flex flex-col gap-2.5">
            {HOME_VALUE_RANGES.map((opt) => (
              <ChoiceCard key={opt} label={opt} selected={st.homeValue === opt}
                onClick={() => opt === "Other" ? p({ homeValue:"Other", homeValueDraft:"" }) : autoAdvance({ homeValue:opt })} />
            ))}
            {st.homeValue === "Other" && (
              <div className="mt-2 flex flex-col gap-3">
                <Input placeholder="e.g. $425,000" value={st.homeValueDraft} onChange={(e) => p({ homeValueDraft:e.target.value })} className="text-base py-5" autoFocus />
                <Button type="button" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold" disabled={!st.homeValueDraft.trim()} onClick={() => advanceWithPatch({ homeValue:st.homeValueDraft })}>Continue</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {st.step === 4 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">How much do you owe on your current mortgage?</h2>
          <p className="text-muted-foreground mb-8">An estimate is fine.</p>
          <div className="flex flex-col gap-2.5">
            {MORTGAGE_RANGES.map((opt) => (
              <ChoiceCard key={opt} label={opt} selected={st.mortgageBalance === opt}
                onClick={() => opt === "Other" ? p({ mortgageBalance:"Other", mortgageBalanceDraft:"" }) : autoAdvance({ mortgageBalance:opt })} />
            ))}
            {st.mortgageBalance === "Other" && (
              <div className="mt-2 flex flex-col gap-3">
                <Input placeholder="e.g. $325,000" value={st.mortgageBalanceDraft} onChange={(e) => p({ mortgageBalanceDraft:e.target.value })} className="text-base py-5" autoFocus />
                <Button type="button" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold" disabled={!st.mortgageBalanceDraft.trim()} onClick={() => advanceWithPatch({ mortgageBalance:st.mortgageBalanceDraft })}>Continue</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {st.step === 5 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your current interest rate?</h2>
          <p className="text-muted-foreground mb-8">An estimate is fine if you're not sure.</p>
          <div className="flex flex-col gap-2.5">
            {RATE_RANGES.map((opt) => (
              <ChoiceCard key={opt} label={opt} selected={st.currentRate === opt}
                onClick={() => opt === "Other" ? p({ currentRate:"Other", currentRateDraft:"" }) : autoAdvance({ currentRate:opt })} />
            ))}
            {st.currentRate === "Other" && (
              <div className="mt-2 flex flex-col gap-3">
                <Input placeholder="e.g. 6.75%" value={st.currentRateDraft} onChange={(e) => p({ currentRateDraft:e.target.value })} className="text-base py-5" autoFocus />
                <Button type="button" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold" disabled={!st.currentRateDraft.trim()} onClick={() => advanceWithPatch({ currentRate:st.currentRateDraft })}>Continue</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {st.step === 6 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your primary goal?</h2>
          <p className="text-muted-foreground mb-8">Pick the one that matters most to you.</p>
          <div className="flex flex-col gap-2.5">{GOALS.map((opt) => <ChoiceCard key={opt} label={opt} selected={st.primaryGoal === opt} onClick={() => autoAdvance({ primaryGoal:opt })} />)}</div>
        </div>
      )}

      {st.step === 7 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your estimated credit score?</h2>
          <p className="text-muted-foreground mb-8">No credit pull required to see your options.</p>
          <div className="flex flex-col gap-2.5">{CREDIT_RANGES.map((opt) => <ChoiceCard key={opt} label={opt} selected={st.creditScore === opt} onClick={() => autoAdvance({ creditScore:opt })} />)}</div>
        </div>
      )}

      {st.step === 8 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your date of birth?</h2>
          <p className="text-muted-foreground mb-8">Required for loan program eligibility.</p>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5"><Label htmlFor="dob">Date of Birth</Label><Input id="dob" type="date" value={st.dob} onChange={(e) => p({ dob:e.target.value })} className="text-base py-5" max={new Date().toISOString().split("T")[0]} /></div>
            <Button type="button" className="w-full h-14 mt-2 bg-primary hover:bg-primary/90 text-white text-base font-semibold" disabled={!st.dob} onClick={advance}>Continue</Button>
          </div>
        </div>
      )}

      {st.step === 9 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">How can we reach you?</h2>
          <p className="text-muted-foreground mb-8">No spam. No credit pull. Real options within hours.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input type="text" name="website" value={st.honeypot} onChange={(e) => p({ honeypot:e.target.value })} tabIndex={-1} aria-hidden="true" autoComplete="off" style={{ position:"absolute", left:"-9999px", opacity:0, height:0, width:0 }} />
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="jane@example.com" value={st.email} onChange={(e) => p({ email:e.target.value })} className="text-base py-5" required /></div>
            <div className="space-y-1.5"><Label htmlFor="phone">Mobile Phone</Label><Input id="phone" type="tel" placeholder="(555) 555-5555" value={st.phone} onChange={(e) => p({ phone:e.target.value })} className="text-base py-5" required /></div>
            <div className="flex items-start gap-3 bg-secondary/50 p-4 rounded-xl mt-1">
              <Checkbox id="consent" checked={st.consent} onCheckedChange={(c) => p({ consent:!!c })} className="mt-0.5" />
              <label htmlFor="consent" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">By submitting, you agree to be contacted by Mykoal DeShazo at Adaxa Home regarding your inquiry. Consent is not a condition of any service. Standard rates may apply. You can opt out at any time.</label>
            </div>
            {submitError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{submitError}</p>}
            <Button type="submit" className="w-full h-14 mt-2 bg-accent hover:bg-accent/90 text-white text-base font-semibold shadow-lg" disabled={isSubmitting || !st.email || !st.phone || !st.consent}>
              {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : "See My Refinance Options"}
            </Button>
          </form>
        </div>
      )}
    </FunnelLayout>
  );
}

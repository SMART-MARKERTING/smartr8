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
import { saveRateContext } from "@/lib/rateEstimate";
import { useGA4 } from "@/hooks/useGA4";

const SESSION_KEY = "funnel_purchase";
const TOTAL = 9;
const STEP_NAMES = ["name","location","purchase_price","down_payment","property_type","loan_type","credit_score","dob","contact"];

const PURCHASE_PRICE_RANGES = ["Under $300,000","$300,000 - $500,000","$500,000 - $750,000","$750,000 - $1,000,000","$1,000,000 - $1,500,000","Over $1,500,000","Other"];
const DOWN_PAYMENT_OPTIONS = ["Less than 5%","5% - 10%","10% - 20%","20%+","Not sure yet","Other"];
const PROPERTY_TYPES = ["Primary residence","Second home / vacation","Investment property"];
const LOAN_TYPES = ["VA loan","FHA loan","Conventional","Jumbo","Not sure / show me options"];
const CREDIT_RANGES = ["580 - 619","620 - 659","660 - 699","700 - 739","740 - 779","780+","Not sure"];

type FS = {
  step: number; firstName: string; lastName: string;
  address: string; city: string; stateCode: string; zip: string;
  purchasePrice: string; purchasePriceDraft: string;
  downPayment: string; downPaymentDraft: string;
  propertyType: string; loanType: string; creditScore: string;
  dob: string; email: string; phone: string; consent: boolean;
  honeypot: string; pageLoadTime: number;
};
const DEFAULT: FS = { step:1,firstName:"",lastName:"",address:"",city:"",stateCode:"",zip:"",purchasePrice:"",purchasePriceDraft:"",downPayment:"",downPaymentDraft:"",propertyType:"",loanType:"",creditScore:"",dob:"",email:"",phone:"",consent:false,honeypot:"",pageLoadTime:0 };

export default function PurchaseFunnel() {
  const [, setLocation] = useLocation();
  const ga4 = useGA4("purchase");
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
      const result = await submitLead({ funnel:"purchase", firstName:st.firstName, lastName:st.lastName, email:st.email, phone:st.phone, address:st.address, city:st.city, state:st.stateCode, zip:st.zip, creditScore:st.creditScore, dob:st.dob, honeypot:st.honeypot, pageLoadTime:st.pageLoadTime, additionalFields:{ purchasePrice:st.purchasePrice, downPayment:st.downPayment, propertyType:st.propertyType, loanType:st.loanType } });
      if (result.success) { ga4.trackLead(); saveRateContext({ creditScore: st.creditScore, funnel: "purchase" }); sessionStorage.removeItem(SESSION_KEY); setLocation(`/apply/purchase/whats-next?name=${encodeURIComponent(st.firstName)}&credit=${encodeURIComponent(st.creditScore)}&funnel=purchase`); }
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
          <h2 className="text-3xl font-bold text-primary mb-2">What's your target property's location?</h2>
          <p className="text-muted-foreground mb-8">City and state is fine if you haven't found a property yet.</p>
          <div className="flex flex-col gap-4">
            <AddressAutocomplete value={st.address} placeholder="City, state or full address..." onChange={(r) => p({ address:r.formatted, city:r.city, stateCode:r.state, zip:r.zip })} forPurchase />
            <Button type="button" className="w-full h-14 mt-2 bg-primary hover:bg-primary/90 text-white text-base font-semibold" disabled={!st.address.trim()} onClick={advance}>Continue</Button>
          </div>
        </div>
      )}

      {st.step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What's your target purchase price range?</h2>
          <p className="text-muted-foreground mb-8">A rough estimate is fine.</p>
          <div className="flex flex-col gap-2.5">
            {PURCHASE_PRICE_RANGES.map((opt) => (
              <ChoiceCard key={opt} label={opt} selected={st.purchasePrice === opt}
                onClick={() => opt === "Other" ? p({ purchasePrice:"Other", purchasePriceDraft:"" }) : autoAdvance({ purchasePrice:opt })} />
            ))}
            {st.purchasePrice === "Other" && (
              <div className="mt-2 flex flex-col gap-3">
                <Input placeholder="e.g. $625,000" value={st.purchasePriceDraft} onChange={(e) => p({ purchasePriceDraft:e.target.value })} className="text-base py-5" autoFocus />
                <Button type="button" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold" disabled={!st.purchasePriceDraft.trim()} onClick={() => advanceWithPatch({ purchasePrice:st.purchasePriceDraft })}>Continue</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {st.step === 4 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">How much do you plan to put down?</h2>
          <p className="text-muted-foreground mb-8">We'll match you to programs that fit your down payment.</p>
          <div className="flex flex-col gap-2.5">
            {DOWN_PAYMENT_OPTIONS.map((opt) => (
              <ChoiceCard key={opt} label={opt} selected={st.downPayment === opt}
                onClick={() => opt === "Other" ? p({ downPayment:"Other", downPaymentDraft:"" }) : autoAdvance({ downPayment:opt })} />
            ))}
            {st.downPayment === "Other" && (
              <div className="mt-2 flex flex-col gap-3">
                <Input placeholder="e.g. 15%" value={st.downPaymentDraft} onChange={(e) => p({ downPaymentDraft:e.target.value })} className="text-base py-5" autoFocus />
                <Button type="button" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold" disabled={!st.downPaymentDraft.trim()} onClick={() => advanceWithPatch({ downPayment:st.downPaymentDraft })}>Continue</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {st.step === 5 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What type of property?</h2>
          <p className="text-muted-foreground mb-8">This affects available loan programs.</p>
          <div className="flex flex-col gap-2.5">{PROPERTY_TYPES.map((opt) => <ChoiceCard key={opt} label={opt} selected={st.propertyType === opt} onClick={() => autoAdvance({ propertyType:opt })} />)}</div>
        </div>
      )}

      {st.step === 6 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-3xl font-bold text-primary mb-2">What loan type interests you most?</h2>
          <p className="text-muted-foreground mb-8">Not sure? Pick the last option and we'll figure it out together.</p>
          <div className="flex flex-col gap-2.5">{LOAN_TYPES.map((opt) => <ChoiceCard key={opt} label={opt} selected={st.loanType === opt} onClick={() => autoAdvance({ loanType:opt })} />)}</div>
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
              {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : "Get My Pre-Approval Options"}
            </Button>
          </form>
        </div>
      )}
    </FunnelLayout>
  );
}

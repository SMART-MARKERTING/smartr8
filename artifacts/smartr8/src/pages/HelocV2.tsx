import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Loader2, Shield, Clock, TrendingUp } from "lucide-react";
import { submitLead } from "@/lib/submitLead";
import { TcpaConsent } from "@/components/TcpaConsent";
import { saveRateContext } from "@/lib/rateEstimate";
import { useGA4 } from "@/hooks/useGA4";
import { trackFbEvent } from "@/lib/fbq";

// v2 treatment of the /heloc full funnel. Same 9 steps, same fields, same
// routing as /heloc. Only design + copy + tracking tag differ. The control
// (/heloc) is untouched.

const SESSION_KEY = "funnel_heloc_v2";
const TOTAL = 9;
const STEP_NAMES = ["name","address","home_value","mortgage_balance","heloc_purpose","timeline","credit_score","dob","contact"];
const FUNNEL_VERSION = "v2";

const HOME_VALUE_RANGES = ["Under $300,000","$300,000 to $500,000","$500,000 to $750,000","$750,000 to $1,000,000","$1,000,000 to $1,500,000","Over $1,500,000","Other"];
const MORTGAGE_RANGES = ["Under $200,000","$200,000 to $400,000","$400,000 to $600,000","$600,000 to $800,000","$800,000 to $1,000,000","Over $1,000,000","No mortgage","Other"];
const HELOC_PURPOSES = ["Home renovation or addition","Pay off higher-interest debt","Buy an investment property","Business or self-employment cash","Money set aside for emergencies","Something else"];
const TIMELINE_OPTIONS = ["As soon as possible","Within 1 to 3 months","Just exploring options"];
const CREDIT_RANGES = ["580 to 619","620 to 659","660 to 699","700 to 739","740 to 779","780+","Not sure"];

const TRUST_PILLS = [
  { icon: Shield, label: "Soft credit only" },
  { icon: Clock, label: "Results in minutes" },
  { icon: TrendingUp, label: "99+ lender network" },
];

type FS = {
  step: number; firstName: string; lastName: string;
  address: string; city: string; stateCode: string; zip: string;
  homeValue: string; homeValueDraft: string;
  mortgageBalance: string; mortgageBalanceDraft: string;
  helocPurposes: string[]; timeline: string; creditScore: string;
  dob: string; email: string; phone: string;
  honeypot: string; pageLoadTime: number;
};
const DEFAULT: FS = { step:1,firstName:"",lastName:"",address:"",city:"",stateCode:"",zip:"",homeValue:"",homeValueDraft:"",mortgageBalance:"",mortgageBalanceDraft:"",helocPurposes:[],timeline:"",creditScore:"",dob:"",email:"",phone:"",honeypot:"",pageLoadTime:0 };

type ConsentState = {
  ready: boolean; consent: boolean; consent_version: string;
  consent_text: string; turnstile_token: string;
};
const EMPTY_CONSENT: ConsentState = { ready: false, consent: false, consent_version: "", consent_text: "", turnstile_token: "" };

function ChoiceCardV2({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center justify-between gap-3 min-h-[56px] cursor-pointer active:scale-[0.99]",
        selected ? "border-primary text-primary" : "border-border hover:border-primary/40 text-foreground",
      ].join(" ")}
      style={{ backgroundColor: selected ? "rgba(19,72,90,0.06)" : "#F8F5F0" }}
    >
      <span>{label}</span>
      {selected && <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#1F8A5F" }} />}
    </button>
  );
}

function MultiChoiceCardV2({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center justify-between gap-3 min-h-[56px] cursor-pointer active:scale-[0.99]",
        selected ? "border-primary text-primary" : "border-border hover:border-primary/40 text-foreground",
      ].join(" ")}
      style={{ backgroundColor: selected ? "rgba(19,72,90,0.06)" : "#F8F5F0" }}
    >
      <span>{label}</span>
      <div
        className="h-5 w-5 rounded border-2 flex items-center justify-center shrink-0"
        style={{ borderColor: selected ? "#1F8A5F" : "rgba(0,0,0,0.25)", backgroundColor: selected ? "#1F8A5F" : "transparent" }}
      >
        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
      </div>
    </button>
  );
}

export default function HelocV2() {
  const [, setLocation] = useLocation();
  const ga4 = useGA4("heloc");

  useEffect(() => {
    trackFbEvent("ViewContent", { content_name: "HELOC", content_category: "Mortgage", variant: "A", funnel_version: FUNNEL_VERSION });
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [consentState, setConsentState] = useState<ConsentState>(EMPTY_CONSENT);
  const [st, setSt] = useState<FS>(() => {
    try { const s = sessionStorage.getItem(SESSION_KEY); return s ? (JSON.parse(s) as FS) : { ...DEFAULT, pageLoadTime: Date.now() }; }
    catch { return { ...DEFAULT, pageLoadTime: Date.now() }; }
  });

  useEffect(() => { sessionStorage.setItem(SESSION_KEY, JSON.stringify(st)); }, [st]);
  useEffect(() => { ga4.trackFunnelStart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Reset scroll to the top on each step change so the header/progress/question
  // are in view (steps render in one component, so there's no remount to do it).
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [st.step]);

  const p = (patch: Partial<FS>) => setSt((prev) => ({ ...prev, ...patch }));
  const advance = () => setSt((prev) => { ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step-1]); return { ...prev, step: prev.step+1 }; });
  const back = () => setSt((prev) => ({ ...prev, step: Math.max(1, prev.step-1) }));
  const autoAdvance = (patch: Partial<FS>) => {
    setSt((prev) => ({ ...prev, ...patch }));
    setTimeout(() => setSt((prev) => { ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step-1]); return { ...prev, step: prev.step+1 }; }), 380);
  };
  const advanceWithPatch = (patch: Partial<FS>) => setSt((prev) => { ga4.trackStepCompleted(prev.step, STEP_NAMES[prev.step-1]); return { ...prev, ...patch, step: prev.step+1 }; });
  const togglePurpose = (val: string) => p({ helocPurposes: st.helocPurposes.includes(val) ? st.helocPurposes.filter((x) => x !== val) : [...st.helocPurposes, val] });

  const SUBMIT_ERR = "Something went wrong with your submission. Please text or call Myke directly at (949) 418-5486 and he will get back to you within minutes.";
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!st.email) { setSubmitError("Please enter your email."); return; }
    setIsSubmitting(true); setSubmitError("");
    try {
      const result = await submitLead({ funnel:"heloc", firstName:st.firstName, lastName:st.lastName, email:st.email, phone:st.phone, address:st.address, city:st.city, state:st.stateCode, zip:st.zip, homeValue:st.homeValue, mortgageBalance:st.mortgageBalance, creditScore:st.creditScore, dob:st.dob, honeypot:st.honeypot, pageLoadTime:st.pageLoadTime, turnstile_token: consentState.turnstile_token, consent: consentState.consent, consent_version: consentState.consent_version, consent_text: consentState.consent_text, additionalFields:{ helocPurposes:st.helocPurposes, timeline:st.timeline, variant:"A", funnel_version: FUNNEL_VERSION } });
      if (result.success) {
        // Lead fires here on submit (v2 routes straight to instant-options-v2
        // and skips /heloc/whats-next, where the control funnel fires it).
        trackFbEvent("Lead", { content_name: "HELOC", content_category: "Mortgage", variant: "A", funnel_version: FUNNEL_VERSION, funnel_length: "long" });
        ga4.trackLead({ variant: "A", funnel_version: FUNNEL_VERSION, funnel_length: "long" });
        saveRateContext({ creditScore: st.creditScore, funnel: "heloc" });
        sessionStorage.removeItem(SESSION_KEY);
        const params = new URLSearchParams({
          name: st.firstName,
          credit: st.creditScore,
          use: st.helocPurposes.join("|"),
          timeline: st.timeline,
          v: "A",
        });
        setLocation(`/heloc/next-step-v2?${params.toString()}`);
      }
      else { setSubmitError(result.error || SUBMIT_ERR); setIsSubmitting(false); }
    } catch { setSubmitError(SUBMIT_ERR); setIsSubmitting(false); }
  };

  // Primary CTA for the current step (drives both the inline desktop button and
  // the mobile sticky bar). Auto-advance steps return null (the cards advance).
  type Cta = { label: string; disabled: boolean; submit?: boolean; onClick?: () => void };
  const cta: Cta | null = (() => {
    switch (st.step) {
      case 1: return { label: "Continue", disabled: !st.firstName.trim() || !st.lastName.trim(), onClick: advance };
      case 2: return { label: "Continue", disabled: !st.address.trim(), onClick: advance };
      case 3: return st.homeValue === "Other" ? { label: "Continue", disabled: !st.homeValueDraft.trim(), onClick: () => advanceWithPatch({ homeValue: st.homeValueDraft }) } : null;
      case 4: return st.mortgageBalance === "Other" ? { label: "Continue", disabled: !st.mortgageBalanceDraft.trim(), onClick: () => advanceWithPatch({ mortgageBalance: st.mortgageBalanceDraft }) } : null;
      case 5: return { label: "Continue", disabled: st.helocPurposes.length === 0, onClick: advance };
      case 8: return { label: "Continue", disabled: !st.dob, onClick: advance };
      case 9: return { label: isSubmitting ? "Submitting..." : "Get My HELOC Options", disabled: isSubmitting || !st.email || !consentState.ready, submit: true };
      default: return null;
    }
  })();

  const progress = Math.round((st.step / TOTAL) * 100);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="HELOC Options | Mykoal DeShazo at Adaxa Home"
        description="Tap your home equity with a HELOC from Mykoal DeShazo, Senior Loan Officer at Adaxa Home. No credit pull to see your options. NMLS #1912347."
        canonical="/heloc-v2"
        noIndex
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "HELOC (Home Equity Line of Credit)",
        "serviceType": "Home Equity Line of Credit",
        "provider": { "@type": "FinancialService", "name": "Adaxa Home LLC", "url": "https://smartr8.com/" },
        "description": "Tap your home equity with a HELOC from Mykoal DeShazo at Adaxa Home. No credit pull required to see your options. NMLS #1912347.",
        "areaServed": ["Arizona","Colorado","Connecticut","Florida","Michigan","Minnesota","Oregon","Pennsylvania","Texas","Virginia","Washington"].map((name) => ({ "@type": "State", name })),
        "url": "https://smartr8.com/heloc-v2"
      }} />

      <Header />

      {/* Progress + back */}
      <div className="sticky top-12 z-30 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-2.5 max-w-xl mx-auto w-full">
          <div className="w-14 flex items-start">
            {st.step > 1 && (
              <button type="button" onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1" aria-label="Go back to the previous step">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
          </div>
          <div className="flex-1" role="progressbar" aria-valuenow={st.step} aria-valuemin={1} aria-valuemax={TOTAL} aria-label={`Step ${st.step} of ${TOTAL}`}>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Step {st.step} of {TOTAL}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 rounded-full" />
          </div>
          <div className="w-14" />
        </div>
      </div>

      <main className="flex-1 px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-xl pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-0">

          {/* STEP 1: compact hero + name */}
          {st.step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-4">
              <div className="space-y-2 text-center">
                <span className="inline-flex items-center text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full" style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}>
                  HELOC Options
                </span>
                <h1 className="text-xl sm:text-3xl font-bold text-primary leading-tight">
                  Tap your equity without touching your mortgage rate
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-snug">
                  Use your home equity for debt, home improvement, or big expenses, without refinancing your first mortgage. See what you qualify for in minutes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TRUST_PILLS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center justify-center text-center gap-1 py-2 px-2 rounded-xl border border-border" style={{ backgroundColor: "#F8F5F0" }}>
                    <Icon className="h-4 w-4" style={{ color: "#1F8A5F" }} />
                    <span className="text-[10px] sm:text-xs font-semibold text-foreground leading-tight">{label}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="space-y-1"><Label htmlFor="fn" className="text-sm">First Name</Label><Input id="fn" placeholder="Jane" value={st.firstName} onChange={(e) => p({ firstName: e.target.value })} className="h-12 text-base" autoComplete="given-name" /></div>
                <div className="space-y-1"><Label htmlFor="ln" className="text-sm">Last Name</Label><Input id="ln" placeholder="Doe" value={st.lastName} onChange={(e) => p({ lastName: e.target.value })} className="h-12 text-base" autoComplete="family-name" /></div>
              </div>
            </div>
          )}

          {/* STEP 2: address */}
          {st.step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What's the property address?</h1>
              <p className="text-base text-muted-foreground mb-6">I use this to match you with lenders in your area.</p>
              <AddressAutocomplete value={st.address} onChange={(r) => p({ address:r.formatted, city:r.city, stateCode:r.state, zip:r.zip })} />
            </div>
          )}

          {/* STEP 3: home value */}
          {st.step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Roughly what's your home worth?</h1>
              <p className="text-base text-muted-foreground mb-6">A ballpark is fine.</p>
              <div className="flex flex-col gap-2.5">
                {HOME_VALUE_RANGES.map((opt) => (
                  <ChoiceCardV2 key={opt} label={opt} selected={st.homeValue === opt}
                    onClick={() => opt === "Other" ? p({ homeValue:"Other", homeValueDraft:"" }) : autoAdvance({ homeValue:opt })} />
                ))}
                {st.homeValue === "Other" && (
                  <Input placeholder="e.g. $425,000" value={st.homeValueDraft} onChange={(e) => p({ homeValueDraft:e.target.value })} className="h-12 text-base mt-1" autoFocus />
                )}
              </div>
            </div>
          )}

          {/* STEP 4: mortgage balance */}
          {st.step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">How much is left on your mortgage?</h1>
              <p className="text-base text-muted-foreground mb-6">An estimate works.</p>
              <div className="flex flex-col gap-2.5">
                {MORTGAGE_RANGES.map((opt) => (
                  <ChoiceCardV2 key={opt} label={opt} selected={st.mortgageBalance === opt}
                    onClick={() => opt === "Other" ? p({ mortgageBalance:"Other", mortgageBalanceDraft:"" }) : autoAdvance({ mortgageBalance:opt })} />
                ))}
                {st.mortgageBalance === "Other" && (
                  <Input placeholder="e.g. $325,000" value={st.mortgageBalanceDraft} onChange={(e) => p({ mortgageBalanceDraft:e.target.value })} className="h-12 text-base mt-1" autoFocus />
                )}
              </div>
            </div>
          )}

          {/* STEP 5: purpose */}
          {st.step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What would you use the funds for?</h1>
              <p className="text-base text-muted-foreground mb-6">Pick all that apply.</p>
              <div className="flex flex-col gap-2.5">{HELOC_PURPOSES.map((opt) => <MultiChoiceCardV2 key={opt} label={opt} selected={st.helocPurposes.includes(opt)} onClick={() => togglePurpose(opt)} />)}</div>
            </div>
          )}

          {/* STEP 6: timeline */}
          {st.step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">When do you want the funds?</h1>
              <p className="text-base text-muted-foreground mb-6">This helps me line up the right lenders.</p>
              <div className="flex flex-col gap-2.5">{TIMELINE_OPTIONS.map((opt) => <ChoiceCardV2 key={opt} label={opt} selected={st.timeline === opt} onClick={() => autoAdvance({ timeline:opt })} />)}</div>
            </div>
          )}

          {/* STEP 7: credit */}
          {st.step === 7 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Roughly where's your credit?</h1>
              <p className="text-base text-muted-foreground mb-6">Checking your options won't affect your credit. A full review only happens if you decide to move forward.</p>
              <div className="flex flex-col gap-2.5">{CREDIT_RANGES.map((opt) => <ChoiceCardV2 key={opt} label={opt} selected={st.creditScore === opt} onClick={() => autoAdvance({ creditScore:opt })} />)}</div>
            </div>
          )}

          {/* STEP 8: dob */}
          {st.step === 8 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What's your date of birth?</h1>
              <p className="text-base text-muted-foreground mb-6">Lenders need this to check what you qualify for.</p>
              <div className="space-y-1.5"><Label htmlFor="dob" className="text-sm">Date of Birth</Label><Input id="dob" type="date" value={st.dob} onChange={(e) => p({ dob:e.target.value })} className="h-12 text-base" max={new Date().toISOString().split("T")[0]} /></div>
            </div>
          )}

          {/* STEP 9: contact */}
          {st.step === 9 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Where should I send your options?</h1>
              <p className="text-base text-muted-foreground mb-6">No spam. No credit pull. Real options within hours.</p>
              <form id="heloc-v2-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input type="text" name="website" value={st.honeypot} onChange={(e) => p({ honeypot:e.target.value })} tabIndex={-1} aria-hidden="true" autoComplete="off" style={{ position:"absolute", left:"-9999px", opacity:0, height:0, width:0 }} />
                <div className="space-y-1.5"><Label htmlFor="email" className="text-sm">Email</Label><Input id="email" type="email" placeholder="jane@example.com" value={st.email} onChange={(e) => p({ email:e.target.value })} className="h-12 text-base" autoComplete="email" required /></div>
                <div className="space-y-1.5"><Label htmlFor="phone" className="text-sm">Mobile Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label><Input id="phone" type="tel" placeholder="(555) 555-5555" value={st.phone} onChange={(e) => p({ phone:e.target.value })} className="h-12 text-base" autoComplete="tel" /></div>
                <TcpaConsent onChange={setConsentState} />
                {submitError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{submitError}</p>}
              </form>
            </div>
          )}

          {/* Desktop inline CTA */}
          {cta && (
            <div className="hidden sm:block pt-6">
              <Button
                type={cta.submit ? "submit" : "button"}
                form={cta.submit ? "heloc-v2-form" : undefined}
                onClick={cta.onClick}
                disabled={cta.disabled}
                className="w-full h-12 text-base shadow-lg rounded-xl border-0 disabled:opacity-100 hover:opacity-90" style={cta.disabled ? { backgroundColor: "#94A3B8", color: "#FFFFFF" } : { backgroundColor: "#E31B23", color: "#FFFFFF" }}
              >
                {isSubmitting && st.step === 9 ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : cta.label}
              </Button>
              {st.step === 9 && <p className="text-center text-xs text-muted-foreground mt-3">No credit pull. No commitment.</p>}
            </div>
          )}
        </div>
      </main>

      {/* Mobile sticky CTA */}
      {cta && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <div className="px-4 pt-3">
            <Button
              type={cta.submit ? "submit" : "button"}
              form={cta.submit ? "heloc-v2-form" : undefined}
              onClick={cta.onClick}
              disabled={cta.disabled}
              className="w-full h-12 text-base shadow-lg rounded-xl border-0 disabled:opacity-100 hover:opacity-90" style={cta.disabled ? { backgroundColor: "#94A3B8", color: "#FFFFFF" } : { backgroundColor: "#E31B23", color: "#FFFFFF" }}
            >
              {isSubmitting && st.step === 9 ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : cta.label}
            </Button>
            {st.step === 9 && <p className="text-center text-xs text-muted-foreground mt-1.5">No credit pull. No commitment.</p>}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

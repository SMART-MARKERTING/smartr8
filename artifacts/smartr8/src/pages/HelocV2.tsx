import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Check, Loader2, Shield, Clock, TrendingUp } from "lucide-react";
import { submitLead } from "@/lib/submitLead";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import { saveRateContext } from "@/lib/rateEstimate";
import { useGA4 } from "@/hooks/useGA4";
import { trackFbEvent } from "@/lib/fbq";

// v2 treatment of the /heloc full funnel. Trimmed from 9 to 7 steps: the
// address autocomplete and home-value picker steps were removed to lower
// mid-funnel drop-off. Only design + copy + tracking tag differ from the v1
// control (/heloc), which is untouched.

const SESSION_KEY = "funnel_heloc_v2";
const TOTAL = 7;
const STEP_NAMES = ["name","mortgage_balance","heloc_purpose","timeline","credit_score","dob","contact"];
const FUNNEL_VERSION = "v2";

const MORTGAGE_RANGES = ["Under $200,000","$200,000 to $400,000","$400,000 to $600,000","$600,000 to $800,000","$800,000 to $1,000,000","Over $1,000,000","No mortgage","Other"];
const HELOC_PURPOSES = ["Home renovation or addition","Pay off higher-interest debt","Buy an investment property","Business or self-employment cash","Money set aside for emergencies","Something else"];
const TIMELINE_OPTIONS = ["As soon as possible","Within 1 to 3 months","Just exploring options"];
const CREDIT_RANGES = ["580 to 619","620 to 659","660 to 699","700 to 739","740 to 779","780+","Not sure"];

const TRUST_PILLS = [
  { icon: Shield, label: "Soft credit only" },
  { icon: Clock, label: "Results in minutes" },
  { icon: TrendingUp, label: "99+ lender network" },
];

// Brand red used for selected option cards on every step (single-select AND
// multi-select). Matches the Continue CTA so the selection state and the
// "next-action" affordance share one visual language.
const SELECTED_RED = "#E31B23";
const SELECTED_BG = "rgba(227,27,35,0.06)";

type FS = {
  step: number; firstName: string; lastName: string;
  mortgageBalance: string; mortgageBalanceDraft: string;
  helocPurposes: string[]; timeline: string; creditScore: string;
  dob: string; email: string; phone: string;
  honeypot: string; pageLoadTime: number;
};
const DEFAULT: FS = { step:1,firstName:"",lastName:"",mortgageBalance:"",mortgageBalanceDraft:"",helocPurposes:[],timeline:"",creditScore:"",dob:"",email:"",phone:"",honeypot:"",pageLoadTime:0 };

type ConsentState = {
  ready: boolean; consent: boolean; consent_version: string;
  consent_text: string; turnstile_token: string;
};
const EMPTY_CONSENT: ConsentState = { ready: false, consent: false, consent_version: "", consent_text: "", turnstile_token: "" };

// Filled red circle with white check when selected; empty bordered circle
// when not. Shared by single-select and multi-select cards so the funnel
// reads as one consistent selection language.
function SelectionIndicator({ selected }: { selected: boolean }) {
  return (
    <div
      className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0"
      style={{
        backgroundColor: selected ? SELECTED_RED : "transparent",
        borderColor: selected ? SELECTED_RED : "rgba(0,0,0,0.25)",
      }}
    >
      {selected && <Check className="h-3 w-3 text-white" />}
    </div>
  );
}

function ChoiceCardV2({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center gap-3 min-h-[56px] cursor-pointer active:scale-[0.99]",
        selected ? "text-primary" : "border-border hover:border-primary/40 text-foreground",
      ].join(" ")}
      style={{
        backgroundColor: selected ? SELECTED_BG : "#F8F5F0",
        borderColor: selected ? SELECTED_RED : undefined,
      }}
    >
      <SelectionIndicator selected={selected} />
      <span className="flex-1">{label}</span>
    </button>
  );
}

function MultiChoiceCardV2({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  // Visually identical to ChoiceCardV2 by design. Behavioral difference
  // (toggle vs single-select) lives at the caller via togglePurpose().
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center gap-3 min-h-[56px] cursor-pointer active:scale-[0.99]",
        selected ? "text-primary" : "border-border hover:border-primary/40 text-foreground",
      ].join(" ")}
      style={{
        backgroundColor: selected ? SELECTED_BG : "#F8F5F0",
        borderColor: selected ? SELECTED_RED : undefined,
      }}
    >
      <SelectionIndicator selected={selected} />
      <span className="flex-1">{label}</span>
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
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (!s) return { ...DEFAULT, pageLoadTime: Date.now() };
      const saved = JSON.parse(s) as FS;
      // Clamp saved step into the new 7-step range so users returning from
      // the earlier 9-step layout (where 2/3 were address/home value) don't
      // land on a now-deleted step.
      const step = saved.step >= 1 && saved.step <= TOTAL ? saved.step : 1;
      return { ...saved, step };
    } catch {
      return { ...DEFAULT, pageLoadTime: Date.now() };
    }
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
      const result = await submitLead({ funnel:"heloc", firstName:st.firstName, lastName:st.lastName, email:st.email, phone:st.phone, mortgageBalance:st.mortgageBalance, creditScore:st.creditScore, dob:st.dob, honeypot:st.honeypot, pageLoadTime:st.pageLoadTime, turnstile_token: consentState.turnstile_token, consent: consentState.consent, consent_version: consentState.consent_version, consent_text: consentState.consent_text, additionalFields:{ helocPurposes:st.helocPurposes, timeline:st.timeline, variant:"A", funnel_version: FUNNEL_VERSION } });
      if (result.success) {
        // Lead fires here on submit (v2 routes straight to next-step-v2 and
        // skips /heloc/whats-next, where the control funnel fires it).
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
  // Step map after the 9->7 trim:
  //   1 name  ·  2 mortgage  ·  3 purpose  ·  4 timeline  ·  5 credit
  //   6 dob   ·  7 contact
  type Cta = { label: string; disabled: boolean; submit?: boolean; onClick?: () => void };
  const cta: Cta | null = (() => {
    switch (st.step) {
      case 1: return { label: "Continue", disabled: !st.firstName.trim() || !st.lastName.trim(), onClick: advance };
      case 2: return st.mortgageBalance === "Other" ? { label: "Continue", disabled: !st.mortgageBalanceDraft.trim(), onClick: () => advanceWithPatch({ mortgageBalance: st.mortgageBalanceDraft }) } : null;
      case 3: return { label: "Continue", disabled: st.helocPurposes.length === 0, onClick: advance };
      case 6: return { label: "Continue", disabled: !st.dob, onClick: advance };
      case 7: return { label: isSubmitting ? "Submitting..." : "Get My HELOC Options", disabled: isSubmitting || !st.email || !consentState.ready, submit: true };
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

          {/* STEP 2 (was step 4): mortgage balance */}
          {st.step === 2 && (
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

          {/* STEP 3 (was step 5): purpose */}
          {st.step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What would you use the funds for?</h1>
              <p className="text-base text-muted-foreground mb-6">Pick all that apply.</p>
              <div className="flex flex-col gap-2.5">{HELOC_PURPOSES.map((opt) => <MultiChoiceCardV2 key={opt} label={opt} selected={st.helocPurposes.includes(opt)} onClick={() => togglePurpose(opt)} />)}</div>
            </div>
          )}

          {/* STEP 4 (was step 6): timeline */}
          {st.step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">When do you want the funds?</h1>
              <p className="text-base text-muted-foreground mb-6">This helps me line up the right lenders.</p>
              <div className="flex flex-col gap-2.5">{TIMELINE_OPTIONS.map((opt) => <ChoiceCardV2 key={opt} label={opt} selected={st.timeline === opt} onClick={() => autoAdvance({ timeline:opt })} />)}</div>
            </div>
          )}

          {/* STEP 5 (was step 7): credit */}
          {st.step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Roughly where's your credit?</h1>
              <p className="text-base text-muted-foreground mb-6">Checking your options won't affect your credit. A full review only happens if you decide to move forward.</p>
              <div className="flex flex-col gap-2.5">{CREDIT_RANGES.map((opt) => <ChoiceCardV2 key={opt} label={opt} selected={st.creditScore === opt} onClick={() => autoAdvance({ creditScore:opt })} />)}</div>
            </div>
          )}

          {/* STEP 6 (was step 8): dob */}
          {st.step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">What's your date of birth?</h1>
              <p className="text-base text-muted-foreground mb-6">Lenders need this to check what you qualify for.</p>
              <div className="space-y-1.5"><Label htmlFor="dob" className="text-sm">Date of Birth</Label><Input id="dob" type="date" value={st.dob} onChange={(e) => p({ dob:e.target.value })} className="h-12 text-base" max={new Date().toISOString().split("T")[0]} /></div>
            </div>
          )}

          {/* STEP 7 (was step 9): contact */}
          {st.step === 7 && (
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 leading-tight">Where should I send your options?</h1>
              <p className="text-base text-muted-foreground mb-6">No spam. No credit pull. Real options within hours.</p>
              <form id="heloc-v2-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input type="text" name="website" value={st.honeypot} onChange={(e) => p({ honeypot:e.target.value })} tabIndex={-1} aria-hidden="true" autoComplete="off" style={{ position:"absolute", left:"-9999px", opacity:0, height:0, width:0 }} />
                <div className="space-y-1.5"><Label htmlFor="email" className="text-sm">Email</Label><Input id="email" type="email" placeholder="jane@example.com" value={st.email} onChange={(e) => p({ email:e.target.value })} className="h-12 text-base" autoComplete="email" required /></div>
                <div className="space-y-1.5"><Label htmlFor="phone" className="text-sm">Mobile Phone</Label><Input id="phone" type="tel" placeholder="(555) 555-5555" value={st.phone} onChange={(e) => p({ phone:e.target.value })} className="h-12 text-base" autoComplete="tel" /></div>
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
                {isSubmitting && st.step === 7 ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : cta.label}
              </Button>
              {st.step === 7 && <p className="text-center text-xs text-muted-foreground mt-3">No credit pull. No commitment.</p>}
              {st.step === 7 && <TcpaSubmitNotice />}
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
              {isSubmitting && st.step === 7 ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Submitting...</> : cta.label}
            </Button>
            {st.step === 7 && <p className="text-center text-xs text-muted-foreground mt-1.5">No credit pull. No commitment.</p>}
            {st.step === 7 && <TcpaSubmitNotice />}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

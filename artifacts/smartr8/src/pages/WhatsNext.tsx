import { useEffect, useMemo } from "react";
import { useSearch, Link } from "wouter";
import { PageMeta } from "@/components/PageMeta";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CalendarDays, FileText, Zap } from "lucide-react";
import { trackFbEvent } from "@/lib/fbq";
import { appendNextStepAction, type FunnelEntryButton } from "@/lib/submitLead";

const CAL_URL = "https://cal.com/mykoal-deshazo/consult";
const LENDINGPAD_URL =
  "https://prod.lendingpad.com/adaxa-home/pos#/?loid=dabbfd28-9b5f-46b8-9029-aa478433a995";

function readContactName(): string {
  try {
    const raw = sessionStorage.getItem("smartr8_funnel_contact_v1");
    if (!raw) return "";
    const c = JSON.parse(raw) as { firstName?: string };
    return c.firstName ?? "";
  } catch {
    return "";
  }
}

function readEntryButton(): FunnelEntryButton | undefined {
  try {
    const raw = sessionStorage.getItem("smartr8_funnel_entry_v1");
    if (!raw) return undefined;
    return raw as FunnelEntryButton;
  } catch {
    return undefined;
  }
}

export default function WhatsNext() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const source = params.get("source") || "worksheet";
  const isProfessional = source === "funnel-professional";
  // URL ?name= takes precedence; fall back to sessionStorage so the personal
  // banner survives a direct navigation that omits the query string.
  const firstName = params.get("name") || readContactName();
  const entryButton = readEntryButton();

  useEffect(() => {
    // Single source of truth for Lead conversion event for the worksheet funnel.
    // No PII (name/credit/email) is passed — only static content metadata.
    trackFbEvent("Lead", {
      content_name: "Worksheet Funnel",
      content_category: "Mortgage",
    });
    trackFbEvent("CompleteRegistration", {
      content_name: "Whats Next",
      content_category: "Mortgage",
      status: true,
    });
  }, []);

  // Headline differs by entry source. Professional-path leads get a personal
  // handoff confirmation; worksheet leads see "your worksheet is on its way".
  const headline = isProfessional
    ? firstName
      ? `Thanks ${firstName} — your info is on its way to Mykoal.`
      : "Thanks — your info is on its way to Mykoal."
    : source === "worksheet"
    ? firstName
      ? `Your worksheet is on its way, ${firstName}.`
      : "Your worksheet is on its way."
    : firstName
    ? `You're all set, ${firstName}.`
    : "You're all set.";

  const subhead = isProfessional
    ? "In the meantime, you can get a head start below — pick whichever next step fits you best."
    : source === "worksheet"
    ? "Check your inbox for the PDF. While I review your numbers, here's how I can help you move forward right now."
    : "While I review your information, here's how I can help you move forward right now.";

  // Each next-step click fires a Meta Pixel event AND appends a slim
  // "Next-Step-Action" record to LeadMailbox so Mykoal can see what the lead
  // did after the handoff (correlated by email).
  function handleScheduleCall() {
    trackFbEvent("Schedule", {
      content_name: "Whats Next — Schedule a Call",
      content_category: "Mortgage",
    });
    appendNextStepAction("scheduled-call", { source, entryButton });
  }
  function handleHelocOptions() {
    trackFbEvent("ViewContent", {
      content_name: "Whats Next — Instant HELOC Options",
      content_category: "Mortgage",
    });
    appendNextStepAction("instant-heloc-options", { source, entryButton });
  }
  function handleFullApplication() {
    trackFbEvent("SubmitApplication", {
      content_name: "Whats Next — Full Application",
      content_category: "Mortgage",
    });
    appendNextStepAction("full-application", { source, entryButton });
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="What Happens Next | Adaxa Home"
        description="Your information has been received. Mykoal DeShazo will be in touch shortly."
        canonical="/whats-next"
        noIndex
      />
      <Header />

      <main className="flex-1 py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
            >
              Next Steps
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
              {headline}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subhead}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Schedule a Call — primary hero card (dark, mirrors the funnel screenshot's "Done For You" style) */}
            <a
              href={CAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleScheduleCall}
              data-testid="whatsnext-cta-schedule"
              className="group rounded-xl border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 transition-all p-6 shadow-md focus:outline-none focus:ring-2 focus:ring-accent flex flex-col lg:col-span-1 md:col-span-2"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-accent text-white">
                  Recommended
                </span>
              </div>
              <h2 className="text-xl font-bold mb-2">Schedule a Call</h2>
              <p className="text-sm text-white/85 leading-relaxed mb-5 flex-1">
                Want help walking through your numbers and picking the right strategy? Book a
                20-minute call with Mykoal directly — a real human looking at your situation, not a
                calculator.
              </p>
              <div className="mt-auto">
                <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-white font-semibold px-4 py-2.5 text-sm group-hover:bg-accent/90 transition-colors">
                  Book a Time <ArrowRight className="h-4 w-4" />
                </span>
                <div className="text-xs text-white/70 font-medium text-center mt-3">
                  No cost · No obligation · No credit pull
                </div>
              </div>
            </a>

            {/* Instant HELOC Options — secondary card */}
            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-accent" />
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                  >
                    Fast Quote
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">See Instant HELOC Options</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Check two digital home-equity programs that may offer fast qualification —
                    typically no appraisal, soft credit pull.
                  </p>
                </div>
                <div className="mt-auto">
                  <Link href="/heloc/instant-options">
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={handleHelocOptions}
                      data-testid="whatsnext-cta-heloc"
                    >
                      See My Options <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <div className="text-xs text-muted-foreground font-medium text-center mt-3">
                    No cost · No obligation · No credit pull
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Full Application — secondary card */}
            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-accent" />
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                  >
                    Ready to Apply
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Start a Full Application</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Skip the back-and-forth and start your application now in our secure portal.
                    Takes about 10–15 minutes.
                  </p>
                </div>
                <div className="mt-auto">
                  <a
                    href={LENDINGPAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleFullApplication}
                    data-testid="whatsnext-cta-application"
                  >
                    <Button variant="outline" className="w-full h-11">
                      Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                  <div className="text-xs text-muted-foreground font-medium text-center mt-3">
                    No cost · No obligation · No credit pull
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-12 text-sm text-muted-foreground">
            Or just sit tight — I'll reach out personally within one business day.
            <br />
            <span className="text-xs">
              Questions? Email{" "}
              <a href="mailto:mykoal@adaxahome.com" className="underline">
                mykoal@adaxahome.com
              </a>{" "}
              or call <a href="tel:+14802069290" className="underline">(480) 206-9290</a>.
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

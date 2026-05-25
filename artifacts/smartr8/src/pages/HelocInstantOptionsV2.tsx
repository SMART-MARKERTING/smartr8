import { useEffect } from "react";
import { useSearch } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { trackFbEvent } from "@/lib/fbq";
import { useGA4 } from "@/hooks/useGA4";
import { ArrowRight, Zap, Layers, CheckCircle2, Shield, Clock, TrendingUp, Phone } from "lucide-react";

const FUNNEL_VERSION = "v2";

const TRUST_PILLS = [
  { icon: Shield, label: "Soft credit only" },
  { icon: Clock, label: "Results in minutes" },
  { icon: TrendingUp, label: "99+ lender network" },
];

const FLEXIBLE_BULLETS = [
  "Self-employed and bank statement income welcome",
  "Investment and second-home properties OK",
  "More room on credit and debt ratios",
  "Wider lender network for tougher files",
];

const FAST_BULLETS = [
  "Fully digital from start to finish",
  "Decision in minutes, funding in as few as 5 days",
  "Soft credit check only to see options",
  "Lowest friction for clean W-2 files",
];

const FLEXIBLE_URL =
  "https://heloc.deephavenmortgage.com/prequal/consent?lo=mykoal-deshazo";
const FAST_URL =
  "https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7";

export default function HelocInstantOptionsV2() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const firstName = (params.get("name") || "").trim();
  const creditRange = params.get("credit") || "";
  const fundUse = (params.get("use") || "").split("|").filter(Boolean);
  // variant: "B" when the visitor came from /heloc/quick-v2 (which passes v=B);
  // "A" for the full /heloc-v2 funnel. Matches the Lead-event variant tag.
  const variant = params.get("v") === "B" ? "B" : "A";
  // long = full /heloc-v2 funnel (variant A); short = /heloc/quick-v2 (variant B).
  const funnelLength = variant === "B" ? "short" : "long";
  const ga4 = useGA4("heloc");

  // Profile-based emphasis: strong credit + not self-employment-funded => Fast.
  // Everything else (including the quick path, which sends no credit/use)
  // defaults to the broader Flexible Path.
  const recommended: "fast" | "flexible" =
    parseInt(creditRange, 10) >= 700 && !fundUse.includes("Business or self-employment cash")
      ? "fast"
      : "flexible";

  // Fires on Continue click for either card, before the same-tab redirect.
  function startPath(path: "fast" | "flexible") {
    try {
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === "function") {
        fbq("trackCustom", "OptionSelected", { option: path, funnel_version: FUNNEL_VERSION });
        fbq("trackCustom", "HelocPathStarted", { path, funnel_version: FUNNEL_VERSION, variant, funnel_length: funnelLength });
      }
    } catch {
      // analytics never blocks navigation
    }
    ga4.trackEvent("heloc_path_started", { path, funnel_version: FUNNEL_VERSION, variant, funnel_length: funnelLength });
  }

  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_name: "HELOC Instant Options",
      content_category: "Mortgage",
      funnel_version: FUNNEL_VERSION,
    });
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="HELOC Instant Options | Mykoal DeShazo at Adaxa Home"
        description="Two HELOC paths from Mykoal DeShazo at Adaxa Home. Pick the one that fits your file. Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA. NMLS #1912347."
        canonical="/heloc/instant-options-v2"
        noIndex
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "HELOC Instant Options",
        "serviceType": "Home Equity Line of Credit",
        "provider": { "@type": "FinancialService", "name": "Adaxa Home LLC", "url": "https://smartr8.com/" },
        "description": "Two HELOC paths from Adaxa Home. Flexible and fast digital options for homeowners in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, and WA. NMLS #1912347.",
        "url": "https://smartr8.com/heloc/instant-options-v2"
      }} />
      <Header />

      <main className="flex-1">
        {/* COMPACT HERO */}
        <div
          className="px-4 py-5 sm:py-10 text-center text-white"
          style={{ background: "linear-gradient(135deg, #0d3140 0%, #13485A 60%, #1a6070 100%)" }}
        >
          <div className="container mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-2 border border-white/20 bg-white/10">
              <Zap className="h-3.5 w-3.5" />
              Instant Options
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-1.5 leading-tight">
              Two ways to get your HELOC
            </h1>
            <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto leading-snug">
              Pick the one that fits your file. I'll be here if questions come
              up.
            </p>

            {/* Trust pills directly under the subhead */}
            <div className="grid grid-cols-3 gap-2 mt-4 max-w-xl mx-auto">
              {TRUST_PILLS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center text-center gap-1 py-2 px-2 rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm"
                >
                  <Icon className="h-4 w-4" style={{ color: "#7DE3B1" }} />
                  <span className="text-[11px] sm:text-xs font-semibold text-white leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* OPTION CARDS */}
        <div className="px-4 py-5 sm:py-10">
          <div className="container mx-auto max-w-4xl">
            {/* Personalized banner (compact) */}
            <div className="rounded-lg border border-border px-3 py-2 mb-4 text-center" style={{ backgroundColor: "#F8F5F0" }}>
              <p className="text-sm font-semibold text-primary">
                {firstName
                  ? `Thanks ${firstName}, here are two paths that fit homeowners like you.`
                  : "Here are two paths that fit homeowners like you."}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-8">

              {/* OPTION 1 (Fast Digital Path) */}
              <div
                className={`relative rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white ${recommended === "fast" ? "border-2" : "border border-border"}`}
                style={{ borderColor: recommended === "fast" ? "#E31B23" : undefined }}
              >
                {/* "Fastest Option" is a factual claim shown always; "Recommended" moves by profile. */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
                  {recommended === "fast" && (
                    <span className="text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: "#E31B23" }}>
                      Recommended
                    </span>
                  )}
                  <span className="text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: "#13485A" }}>
                    Fastest Option
                  </span>
                </div>
                <div className="h-1.5 w-full" style={{ background: "#E31B23" }} />
                <div className="p-6 sm:p-7 flex flex-col gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">
                      Option 1
                    </span>
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(227,27,35,0.08)" }}
                    >
                      <Zap className="h-5 w-5" style={{ color: "#E31B23" }} />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary leading-tight">
                      Fast Digital Path
                    </h2>
                    <p className="text-sm font-medium" style={{ color: "#E31B23" }}>
                      Best for W-2 borrowers with strong credit
                    </p>
                  </div>

                  <p className="text-base text-foreground/80 leading-relaxed">
                    If you're a W-2 employee, your credit is in good shape, and
                    you want a quick decision and funding in days not weeks,
                    this is the route.
                  </p>

                  <ul className="space-y-2.5">
                    {FAST_BULLETS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2
                          className="h-4 w-4 mt-0.5 shrink-0"
                          style={{ color: "#1F8A5F" }}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4">
                    <a
                      href={FAST_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => startPath("fast")}
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-base text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                      style={{ backgroundColor: "#E31B23" }}
                      data-testid="v2-option-fast"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* OPTION 2 (Flexible Path) */}
              <div
                className={`relative rounded-2xl overflow-hidden shadow-sm flex flex-col ${recommended === "flexible" ? "border-2" : "border border-border"}`}
                style={{ backgroundColor: "#F8F5F0", borderColor: recommended === "flexible" ? "#E31B23" : undefined }}
              >
                {recommended === "flexible" && (
                  <div className="absolute top-4 right-4 z-10 text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: "#E31B23" }}>
                    Recommended
                  </div>
                )}
                <div className="h-1.5 w-full" style={{ background: "#13485A" }} />
                <div className="p-6 sm:p-7 flex flex-col gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full bg-white border border-border text-muted-foreground">
                      Option 2
                    </span>
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(19,72,90,0.08)" }}
                    >
                      <Layers className="h-5 w-5" style={{ color: "#13485A" }} />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary leading-tight">
                      Flexible Path
                    </h2>
                    <p className="text-sm font-medium" style={{ color: "#13485A" }}>
                      Best if your file is a little outside the box
                    </p>
                  </div>

                  <p className="text-base text-foreground/80 leading-relaxed">
                    If you're self-employed, have bank statement income, own
                    multiple properties, or your credit is still being built
                    up, this path opens up more lenders willing to work with
                    your situation.
                  </p>

                  <ul className="space-y-2.5">
                    {FLEXIBLE_BULLETS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2
                          className="h-4 w-4 mt-0.5 shrink-0"
                          style={{ color: "#1F8A5F" }}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4">
                    <a
                      href={FLEXIBLE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => startPath("flexible")}
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-base text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                      style={{ backgroundColor: "#13485A" }}
                      data-testid="v2-option-flexible"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* IMPORTANT CALLOUT */}
            <div
              className="rounded-xl p-5 text-sm text-muted-foreground leading-relaxed mb-8 border border-border"
              style={{ backgroundColor: "#F8F5F0" }}
            >
              <strong className="text-foreground">Important:</strong>{" "}
              Qualification and timing vary by lender and borrower profile. Not
              all applicants will qualify. Review each lender's disclosures for
              full terms before proceeding.
            </div>

            {/* HELP SECTION */}
            <div
              className="rounded-2xl px-6 py-8 sm:py-10 text-center text-white"
              style={{ background: "linear-gradient(135deg, #0d3140 0%, #13485A 100%)" }}
            >
              <h2 className="text-xl sm:text-2xl font-bold mb-2">
                Questions before you continue?
              </h2>
              <p className="text-white/80 mb-5 text-base">
                I'm here to help you pick the right path.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <a
                  href="tel:9494185486"
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#E31B23" }}
                >
                  <Phone className="h-4 w-4" />
                  Call (949) 418-5486
                </a>
                <a
                  href="sms:9494185486"
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold text-sm border border-white/30 hover:bg-white/10 text-white"
                >
                  Text Me
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

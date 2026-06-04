import { useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";
import { trackFbEvent } from "@/lib/fbq";
import { useGA4 } from "@/hooks/useGA4";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Phone,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";

const FUNNEL_VERSION = "v2";
// Brief pause so the reassurance screen registers, then hand off to the lender.
const REDIRECT_DELAY_MS = 1500;

// Destination preserved from the prior /heloc/instant-options-v2 Option 1
// "Continue" button. Change here to retarget the Fast Digital Path without
// spelunking the JSX.
const REDIRECT_DESTINATION_URL =
  "https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7";

const TRUST_PILLS = [
  { icon: Shield, label: "Soft credit only" },
  { icon: Clock, label: "Results in minutes" },
  { icon: TrendingUp, label: "90+ lender network" },
];

const FAST_BULLETS = [
  "Fully digital from start to finish",
  "Decision in minutes, funding in as few as 5 days",
  "Soft credit check only to see options",
  "Lowest friction for clean W-2 files",
];

// Merge incoming query params into the destination URL without clobbering the
// referrer (or anything else already baked into REDIRECT_DESTINATION_URL).
function buildRedirectUrl(incoming: URLSearchParams): string {
  try {
    const url = new URL(REDIRECT_DESTINATION_URL);
    incoming.forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    return url.toString();
  } catch {
    return REDIRECT_DESTINATION_URL;
  }
}

export default function HelocNextStepV2() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const rawName = (params.get("name") || "").trim();
  const firstName = rawName ? rawName.split(/\s+/)[0] : "";
  // Variant comes from the source funnel: A = full /heloc-v2, B = /heloc/quick-v2.
  // funnel_length follows from variant the same way as on instant-options-v2.
  const variant: "A" | "B" = params.get("v") === "B" ? "B" : "A";
  const funnelLength: "long" | "short" = variant === "B" ? "short" : "long";
  const ga4 = useGA4("heloc");

  const eventsFiredRef = useRef(false);
  const redirectedRef = useRef(false);

  function fireRedirectEvents() {
    if (eventsFiredRef.current) return;
    eventsFiredRef.current = true;
    try {
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === "function") {
        fbq("trackCustom", "OptionSelected", {
          path: "fast-digital",
          funnel_version: FUNNEL_VERSION,
          variant,
        });
        fbq("trackCustom", "HelocPathStarted", {
          path: "fast-digital",
          funnel_version: FUNNEL_VERSION,
          variant,
          funnel_length: funnelLength,
        });
      }
    } catch {
      // analytics never blocks navigation
    }
    ga4.trackEvent("heloc_path_started", {
      path: "fast-digital",
      funnel_version: FUNNEL_VERSION,
      variant,
      funnel_length: funnelLength,
    });
  }

  function triggerRedirect() {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    fireRedirectEvents();
    window.location.href = buildRedirectUrl(params);
  }

  // PageView equivalent on mount.
  useEffect(() => {
    trackFbEvent("ViewContent", {
      content_name: "HELOC Next Step",
      content_category: "Mortgage",
      funnel_version: FUNNEL_VERSION,
    });
  }, []);

  // Brief pause so the reassurance screen registers, then auto-redirect.
  useEffect(() => {
    const id = window.setTimeout(triggerRedirect, REDIRECT_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroTitle = firstName
    ? `Thanks ${firstName}! Your info looks great.`
    : "Thanks! Your info looks great.";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="Next Step | Mykoal DeShazo at Adaxa Home"
        description="We're getting you started on the Fast Digital Path with Mykoal DeShazo at Adaxa Home. NMLS #1912347."
        canonical="/heloc/next-step-v2"
        noIndex
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "HELOC Fast Digital Path",
          serviceType: "Home Equity Line of Credit",
          provider: {
            "@type": "FinancialService",
            name: "Adaxa Home LLC",
            url: "https://smartr8.com/",
          },
          description:
            "Fast Digital Path for HELOC applications from Adaxa Home. Fully digital, soft credit only, decision in minutes. NMLS #1912347.",
          url: "https://smartr8.com/heloc/next-step-v2",
        }}
      />
      <Header />

      <main className="flex-1">
        {/* HERO */}
        <div
          className="px-4 py-5 sm:py-10 text-center text-white"
          style={{
            background:
              "linear-gradient(135deg, #0d3140 0%, #13485A 60%, #1a6070 100%)",
          }}
        >
          <div className="container mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-2 border border-white/20 bg-white/10">
              <Zap className="h-3.5 w-3.5" />
              Next Step
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 leading-tight">
              {heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto leading-snug">
              Based on what you shared, the Fast Digital Path is the right fit
              for your file. We're getting you started now.
            </p>

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

        {/* SINGLE CARD */}
        <div className="px-4 py-5 sm:py-10">
          <div className="container mx-auto max-w-xl">
            <div
              className="relative rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white border-2"
              style={{ borderColor: "#E31B23" }}
              data-testid="next-step-card"
            >
              <div className="absolute top-4 right-4 z-10">
                <span
                  className="text-[11px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: "#13485A" }}
                >
                  Fastest Option
                </span>
              </div>
              <div className="h-1.5 w-full" style={{ background: "#E31B23" }} />
              <div className="p-6 sm:p-7 flex flex-col gap-4">
                <div className="flex items-center gap-3">
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

                <ul className="space-y-2.5">
                  {FAST_BULLETS.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <CheckCircle2
                        className="h-4 w-4 mt-0.5 shrink-0"
                        style={{ color: "#1F8A5F" }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div
                  className="text-base sm:text-lg font-semibold text-center py-2"
                  style={{ color: "#13485A" }}
                  aria-live="polite"
                  data-testid="next-step-countdown"
                >
                  Taking you to your secure application…
                </div>

                <button
                  type="button"
                  onClick={triggerRedirect}
                  className="flex items-center justify-center gap-2 w-full h-14 sm:h-12 rounded-xl font-bold text-base text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "#E31B23" }}
                  data-testid="next-step-continue"
                >
                  Continue Now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Not seeing the redirect? Click Continue Now above to proceed.
            </p>

            {/* COMPLIANCE FOOTER */}
            <div
              className="rounded-xl p-5 text-sm text-muted-foreground leading-relaxed mt-8 border border-border"
              style={{ backgroundColor: "#F8F5F0" }}
            >
              <strong className="text-foreground">Important:</strong>{" "}
              Qualification and timing vary by lender and borrower profile. Not
              all applicants will qualify. Review each lender's disclosures for
              full terms before proceeding.
            </div>

            {/* QUESTIONS */}
            <div
              className="rounded-2xl px-6 py-8 sm:py-10 text-center text-white mt-8"
              style={{
                background:
                  "linear-gradient(135deg, #0d3140 0%, #13485A 100%)",
              }}
            >
              <h2 className="text-xl sm:text-2xl font-bold mb-2">
                Questions before you continue?
              </h2>
              <p className="text-white/80 mb-5 text-base">
                I'm here to help if anything comes up.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <a
                  href="tel:4802069290"
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#E31B23" }}
                >
                  <Phone className="h-4 w-4" />
                  Call (480) 206-9290
                </a>
                <a
                  href="sms:4802069290"
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

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArrowRight, Zap, Layers, CheckCircle2, Clock, Shield, TrendingUp } from "lucide-react";
import { PageMeta } from "@/components/PageMeta";
import { JsonLd } from "@/components/JsonLd";

export default function HelocInstantOptions() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="HELOC Instant Options | Mykoal DeShazo at Adaxa Home"
        description="Two fast digital HELOC paths from Mykoal DeShazo at Adaxa Home. Flexible HELOC financing for homeowners in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA &amp; WA. NMLS #1912347."
        canonical="/heloc/instant-options"
      />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "HELOC Instant Options",
        "serviceType": "Home Equity Line of Credit",
        "provider": { "@type": "FinancialService", "name": "Adaxa Home LLC", "url": "https://smartr8.com/" },
        "description": "Two fast digital HELOC paths from Adaxa Home. Flexible and fast HELOC options for homeowners in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, and WA. NMLS #1912347.",
        "areaServed": [
          { "@type": "State", "name": "Arizona" },
          { "@type": "State", "name": "Colorado" },
          { "@type": "State", "name": "Connecticut" },
          { "@type": "State", "name": "Florida" },
          { "@type": "State", "name": "Michigan" },
          { "@type": "State", "name": "Minnesota" },
          { "@type": "State", "name": "Oregon" },
          { "@type": "State", "name": "Pennsylvania" },
          { "@type": "State", "name": "Texas" },
          { "@type": "State", "name": "Virginia" },
          { "@type": "State", "name": "Washington" }
        ],
        "url": "https://smartr8.com/heloc/instant-options"
      }} />
      <Header />

      <main className="flex-1">

        {/* Hero band */}
        <div
          className="py-16 md:py-20 px-4 text-center text-white"
          style={{ background: "linear-gradient(135deg, #0d3140 0%, #13485A 60%, #1a6070 100%)" }}
        >
          <div className="container mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-6 border border-white/20 bg-white/10">
              <Zap className="h-3.5 w-3.5" />
              Instant Options
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Two Fast Paths to Your HELOC
            </h1>
            <p className="text-lg text-white/75 max-w-xl mx-auto">
              Both options give you a quick digital experience. Pick the one that fits your situation — I'll be here if you have questions along the way.
            </p>
          </div>
        </div>

        {/* Options grid */}
        <div className="py-14 px-4">
          <div className="container mx-auto max-w-4xl">
            <div className="grid md:grid-cols-2 gap-6 mb-10">

              {/* Option 1 — Flexible Financing */}
              <div className="relative rounded-2xl border border-border bg-white overflow-hidden shadow-md flex flex-col group hover:shadow-xl transition-shadow duration-300">
                {/* Top accent bar */}
                <div className="h-1.5 w-full" style={{ background: "#13485A" }} />
                <div className="p-7 flex flex-col gap-5 flex-1">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-secondary text-muted-foreground">
                      Option 1
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(19,72,90,0.08)" }}
                    >
                      <Layers className="h-7 w-7" style={{ color: "#13485A" }} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-primary leading-tight">Flexible Financing</h2>
                      <p className="text-sm text-muted-foreground">Broad program eligibility</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    A great starting point for borrowers who want to explore their options online. This path offers wide program availability with a streamlined prequalification experience.
                  </p>

                  <ul className="space-y-2.5">
                    {[
                      "Streamlined online prequalification",
                      "Wide range of program eligibility",
                      "Alternative documentation may be available",
                      "Review lender disclosures before proceeding",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-5 border-t border-border">
                    <a
                      href="https://heloc.deephavenmortgage.com/prequal/consent?lo=mykoal-deshazo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-14 rounded-xl font-bold text-base text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                      style={{ backgroundColor: "#13485A" }}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Option 2 — Fastest Option */}
              <div className="relative rounded-2xl border-2 overflow-hidden shadow-md flex flex-col group hover:shadow-xl transition-shadow duration-300" style={{ borderColor: "#CC1818" }}>
                {/* Popular badge */}
                <div
                  className="absolute top-4 right-4 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full text-white"
                  style={{ backgroundColor: "#CC1818" }}
                >
                  Fastest Option
                </div>
                {/* Top accent bar */}
                <div className="h-1.5 w-full" style={{ background: "#CC1818" }} />
                <div className="p-7 flex flex-col gap-5 flex-1">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-secondary text-muted-foreground">
                      Option 2
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(204,24,24,0.08)" }}
                    >
                      <Zap className="h-7 w-7" style={{ color: "#CC1818" }} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-primary leading-tight">Fast Digital Path</h2>
                      <p className="text-sm text-muted-foreground">Fully online, move quickly</p>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Built for borrowers who want a fully digital experience and a fast path to seeing their HELOC terms. Designed to minimize paperwork and get you to a decision quickly.
                  </p>

                  <ul className="space-y-2.5">
                    {[
                      "Fully digital end-to-end process",
                      "Fast rate review and next steps",
                      "Speed and timing vary by profile and property",
                      "Review all lender terms before proceeding",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#CC1818" }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-5 border-t border-border">
                    <a
                      href="https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-14 rounded-xl font-bold text-base text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                      style={{ backgroundColor: "#CC1818" }}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-center">
              {[
                { icon: Shield, label: "Soft credit check only" },
                { icon: Clock, label: "Results in minutes" },
                { icon: TrendingUp, label: "99+ lender network" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-2 py-4 rounded-xl bg-secondary/40 border border-border">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="bg-secondary/40 border border-border rounded-xl p-5 text-sm text-muted-foreground leading-relaxed mb-8">
              <strong className="text-foreground">Important:</strong> Qualification and timing vary by lender and borrower profile. Not all applicants will qualify. Review each lender's disclosures for full terms before proceeding.
            </div>

            {/* Questions CTA */}
            <div
              className="rounded-2xl px-6 py-10 text-center text-white"
              style={{ background: "linear-gradient(135deg, #0d3140 0%, #13485A 100%)" }}
            >
              <h2 className="text-2xl font-bold mb-3">Have questions before you continue?</h2>
              <p className="text-white/75 mb-6">I'm here to help you choose the right path for your situation.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="tel:9494185486"
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#CC1818" }}
                >
                  Call (949) 418-5486
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="sms:9494185486"
                  className="flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold text-sm border border-white/30 hover:bg-white/10 text-white"
                >
                  Text Me
                </a>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Equal Housing Opportunity. NMLS #1912347. This is not a commitment to lend. All terms are subject to lender approval.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

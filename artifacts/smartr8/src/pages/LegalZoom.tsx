import { BadgeCheck, BriefcaseBusiness, CheckCircle2, ExternalLink, FileText, Home, Landmark, Scale, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@/components/ui/button";

const LEGALZOOM_URL =
  (import.meta.env.VITE_LEGALZOOM_AFFILIATE_URL as string | undefined) ||
  "https://impact.legalzoom.com/c/7347784/2110096/26746";

const isLegalSubdomain =
  typeof window !== "undefined" && window.location.hostname === "legal.smartr8.com";

const canonicalUrl = isLegalSubdomain
  ? "https://legal.smartr8.com/"
  : "https://smartr8.com/legal";

const legalServices = [
  {
    icon: BriefcaseBusiness,
    title: "Start or formalize a business",
    body: "Explore LLC, corporation, DBA, and business formation tools for side businesses, real estate ventures, and growing teams.",
  },
  {
    icon: ShieldCheck,
    title: "Stay organized after launch",
    body: "Look into registered agent services, compliance calendars, annual reports, and operating documents that keep the business side cleaner.",
  },
  {
    icon: FileText,
    title: "Plan for family and estate needs",
    body: "Explore wills, living trusts, power of attorney documents, and attorney help for personal planning questions.",
  },
  {
    icon: BadgeCheck,
    title: "Protect names, brands, and ideas",
    body: "Review trademark, copyright, patent, and attorney-guided options when a business name or creative asset is becoming valuable.",
  },
];

const useCases = [
  "Real estate investors setting up an entity before buying property",
  "Self-employed borrowers organizing business documents before financing",
  "Homeowners planning wills, trusts, or power of attorney documents",
  "Business owners who need registered agent, compliance, or IP support",
];

function LegalZoomCta({ location }: { location: "hero" | "midpage" | "footer" }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">
        Paid partner link
      </p>
      <Button
        size="lg"
        className="h-14 bg-accent px-6 text-base text-white shadow-lg hover:bg-accent/90"
        asChild
        data-testid={`legalzoom-${location}-cta`}
      >
        <a href={LEGALZOOM_URL} target="_blank" rel="sponsored noopener noreferrer">
          Visit LegalZoom
          <ExternalLink className="ml-2 h-5 w-5" />
        </a>
      </Button>
      <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
        Smartr8 may receive compensation if you purchase through this link. LegalZoom
        is a separate company and is not a mortgage lender.
      </p>
    </div>
  );
}

export default function LegalZoom() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background selection:bg-primary/10">
      <PageMeta
        title="LegalZoom Partner Resources | Smartr8"
        description="Explore LegalZoom business formation, registered agent, legal document, trademark, and estate planning resources through Smartr8's partner link."
        canonical="/legal"
        canonicalUrl={canonicalUrl}
      />
      <JsonLd
        id="legalzoom-partner-page-schema"
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "LegalZoom Partner Resources | Smartr8",
          url: canonicalUrl,
          description:
            "A Smartr8 partner page connecting visitors with LegalZoom legal and business resources.",
          about: [
            { "@type": "Service", name: "Business formation" },
            { "@type": "Service", name: "Registered agent services" },
            { "@type": "Service", name: "Legal document templates" },
            { "@type": "Service", name: "Trademark services" },
          ],
          publisher: {
            "@type": "Organization",
            name: "Smartr8",
            url: "https://smartr8.com/",
          },
        }}
      />
      <Header />

      <main className="flex-1">
        <section className="border-b border-border bg-[#F7F3EC] px-4 py-16 md:py-24">
          <div className="container mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white px-3 py-1 text-sm font-medium text-primary shadow-sm">
                <Scale className="h-4 w-4" />
                Smartr8 legal partner resource
              </div>
              <div className="space-y-5">
                <h1 className="text-4xl font-bold leading-tight text-primary md:text-6xl">
                  Set up the legal side before the money moves.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  LegalZoom can help with business formation, wills and trusts,
                  intellectual property, attorney support, and legal documents.
                  Use this page when your mortgage, real estate, or business
                  plans need the legal structure cleaned up too.
                </p>
              </div>
              <LegalZoomCta location="hero" />
            </div>

            <div className="rounded-lg border border-border bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Landmark className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Good fit for
                  </div>
                  <div className="text-xl font-semibold text-foreground">
                    Business and property planning
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {useCases.map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg bg-secondary/50 p-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p className="text-sm leading-relaxed text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-10 max-w-3xl">
              <h2 className="text-3xl font-bold text-primary md:text-4xl">
                What LegalZoom can help you explore
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                This is not legal advice from Smartr8 or Adaxa Home. It is a
                partner resource for common legal setup questions that often
                come up around business ownership, property, financing, and
                family planning.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {legalServices.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/30 px-4 py-14">
          <div className="container mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm">
              <Home className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-primary">
                Why this belongs on Smartr8
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                Financing decisions often touch legal questions: who owns the
                business, who signs, whether an entity is ready, and whether
                your family documents match your property plans. Mykoal handles
                the mortgage strategy. LegalZoom can be a separate path for the
                legal setup pieces.
              </p>
              <LegalZoomCta location="midpage" />
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="container mx-auto max-w-5xl">
            <div className="rounded-lg bg-primary p-8 text-primary-foreground md:p-10">
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h2 className="mb-3 text-3xl font-bold">
                    Ready to handle the legal setup?
                  </h2>
                  <p className="max-w-2xl text-primary-foreground/80">
                    Start with LegalZoom, then come back to Smartr8 when you
                    are ready to review financing, equity, or mortgage options.
                  </p>
                </div>
                <div className="[&_.text-primary]:text-primary-foreground [&_.text-muted-foreground]:text-primary-foreground/70">
                  <LegalZoomCta location="footer" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

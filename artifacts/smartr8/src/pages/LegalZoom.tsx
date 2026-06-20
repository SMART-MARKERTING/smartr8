import { useMemo, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, CheckCircle2, ExternalLink, FileText, Home, Landmark, Loader2, Scale, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { PageMeta } from "@/components/PageMeta";
import { TcpaConsent, TcpaSubmitNotice } from "@/components/TcpaConsent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trackFbEvent } from "@/lib/fbq";
import { submitLead } from "@/lib/submitLead";

const LEGALZOOM_URL =
  (import.meta.env.VITE_LEGALZOOM_AFFILIATE_URL as string | undefined) ||
  "https://impact.legalzoom.com/c/7347784/2110096/26746";

const isLegalSubdomain =
  typeof window !== "undefined" && window.location.hostname === "legal.smartr8.com";

const canonicalUrl = isLegalSubdomain
  ? "https://legal.smartr8.com/"
  : "https://smartr8.com/legal";

type LegalOptionId = "business" | "compliance" | "estate" | "intellectual-property";

const legalOptions: Array<{
  id: LegalOptionId;
  icon: typeof BriefcaseBusiness;
  title: string;
  shortLabel: string;
  body: string;
  legalZoomCategory: string;
}> = [
  {
    id: "business",
    icon: BriefcaseBusiness,
    title: "Start or formalize a business",
    shortLabel: "Business formation",
    body: "Explore LLC, corporation, DBA, and business formation tools for side businesses, real estate ventures, and growing teams.",
    legalZoomCategory: "business formation",
  },
  {
    id: "compliance",
    icon: ShieldCheck,
    title: "Stay organized after launch",
    shortLabel: "Compliance support",
    body: "Look into registered agent services, compliance calendars, annual reports, and operating documents that keep the business side cleaner.",
    legalZoomCategory: "registered agent and compliance",
  },
  {
    id: "estate",
    icon: FileText,
    title: "Plan for family and estate needs",
    shortLabel: "Wills and trusts",
    body: "Explore wills, living trusts, power of attorney documents, and attorney help for personal planning questions.",
    legalZoomCategory: "wills and trusts",
  },
  {
    id: "intellectual-property",
    icon: BadgeCheck,
    title: "Protect names, brands, and ideas",
    shortLabel: "Intellectual property",
    body: "Review trademark, copyright, patent, and attorney-guided options when a business name or creative asset is becoming valuable.",
    legalZoomCategory: "intellectual property",
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

function legalZoomUrlFor(option: LegalOptionId, leadId?: string): string {
  const selected = legalOptions.find((item) => item.id === option);
  try {
    const url = new URL(LEGALZOOM_URL);
    url.searchParams.set("subId1", option);
    url.searchParams.set("subId2", selected?.legalZoomCategory ?? "legal");
    if (leadId) url.searchParams.set("subId3", leadId);
    return url.toString();
  } catch {
    return LEGALZOOM_URL;
  }
}

export default function LegalZoom() {
  const [selectedOption, setSelectedOption] = useState<LegalOptionId>("business");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
    honeypot: "",
  });
  const [pageLoadTime] = useState(() => Date.now());
  const [consentState, setConsentState] = useState({
    ready: false,
    consent: false,
    consent_version: "",
    consent_text: "",
    turnstile_token: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => legalOptions.find((item) => item.id === selectedOption) ?? legalOptions[0],
    [selectedOption],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    const result = await submitLead({
      funnel: "legal",
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      additionalFields: {
        "Funnel-Source": "legalzoom-partner-funnel",
        "Legal-Need": selected.shortLabel,
        "LegalZoom-Category": selected.legalZoomCategory,
        "LegalZoom-Option-Id": selected.id,
        "Client-Notes": form.notes,
        "Redirect-Target": legalZoomUrlFor(selected.id),
      },
      honeypot: form.honeypot,
      pageLoadTime,
      turnstile_token: consentState.turnstile_token,
      consent: consentState.consent,
      consent_version: consentState.consent_version,
      consent_text: consentState.consent_text,
    });

    if (!result.success) {
      setSubmitting(false);
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    try {
      sessionStorage.setItem(
        "smartr8_legalzoom_selection_v1",
        JSON.stringify({
          option: selected.id,
          label: selected.shortLabel,
          email: form.email,
          leadId: result.leadId ?? "",
        }),
      );
    } catch {}

    trackFbEvent("Lead", {
      content_name: "LegalZoom Partner Lead",
      content_category: "Legal Services",
      legal_need: selected.shortLabel,
    });
    window.location.assign(legalZoomUrlFor(selected.id, result.leadId));
  }

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
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-14 bg-accent px-6 text-base text-white shadow-lg hover:bg-accent/90"
                  asChild
                >
                  <a href="#legalzoom-funnel">
                    Pick My Legal Need
                    <CheckCircle2 className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 border-2 px-6 text-base"
                  asChild
                  data-testid="legalzoom-direct-hero-cta"
                >
                  <a href={LEGALZOOM_URL} target="_blank" rel="sponsored noopener noreferrer">
                    Go Direct to LegalZoom
                    <ExternalLink className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </div>
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
              {legalOptions.map(({ icon: Icon, title, body }) => (
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

        <section id="legalzoom-funnel" className="border-y border-border bg-[#F7F3EC] px-4 py-16">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-8 max-w-3xl">
              <h2 className="text-3xl font-bold text-primary md:text-4xl">
                Choose what you want help with
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                Tell us the legal category first. We will save that selection
                with your lead, then send you to LegalZoom through the matching
                partner link with your selection attached for tracking.
              </p>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-4">
              {legalOptions.map(({ id, icon: Icon, shortLabel, body }) => {
                const active = selectedOption === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedOption(id)}
                    className={`rounded-lg border p-4 text-left shadow-sm transition ${
                      active
                        ? "border-primary bg-white ring-2 ring-primary/20"
                        : "border-border bg-white/70 hover:border-primary/50 hover:bg-white"
                    }`}
                    data-testid={`legal-option-${id}`}
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-semibold text-foreground">{shortLabel}</div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-border bg-white p-5 shadow-xl md:p-7"
              data-testid="legalzoom-lead-form"
            >
              <input
                type="text"
                name="company"
                value={form.honeypot}
                onChange={(e) => setForm((prev) => ({ ...prev, honeypot: e.target.value }))}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />
              <div className="mb-6 rounded-lg bg-secondary/60 p-4">
                <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Selected option
                </div>
                <div className="mt-1 text-xl font-semibold text-primary">{selected.shortLabel}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="legal-first-name">First name</Label>
                  <Input
                    id="legal-first-name"
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal-last-name">Last name</Label>
                  <Input
                    id="legal-last-name"
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    autoComplete="family-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal-email">Email</Label>
                  <Input
                    id="legal-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal-phone">Phone</Label>
                  <Input
                    id="legal-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor="legal-notes">Anything you want Mykoal to know?</Label>
                <Textarea
                  id="legal-notes"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Example: setting up an LLC for a rental property, creating a will, protecting a brand name..."
                  rows={4}
                />
              </div>

              <div className="mt-5">
                <TcpaConsent onChange={setConsentState} />
              </div>

              {error && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="mt-6">
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 w-full bg-accent text-base text-white hover:bg-accent/90 md:w-auto"
                  disabled={submitting || !consentState.ready}
                  data-testid="legalzoom-submit-redirect"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving and redirecting
                    </>
                  ) : (
                    <>
                      Save My Selection and Continue
                      <ExternalLink className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <TcpaSubmitNotice />
                <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  We cannot pre-fill LegalZoom's checkout or forms from Smartr8.
                  Your selected category is saved with your lead and attached to
                  the partner redirect for attribution where supported.
                </p>
              </div>
            </form>
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

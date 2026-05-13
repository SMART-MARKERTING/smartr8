import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HelocForm } from "@/components/HelocForm";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Home as HomeIcon, TrendingDown, Zap } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "Will this affect my credit score?",
    a: "The initial pre-qualification uses a soft credit check, which does not impact your score. A hard pull only happens if you decide to move forward with a formal application.",
  },
  {
    q: "How much can I borrow?",
    a: "Most lenders allow you to borrow up to 80 to 90% of your home's value, minus what you owe on your first mortgage. Your exact line amount depends on your equity, credit profile, and the lender's specific program.",
  },
  {
    q: "How is a HELOC different from a cash-out refinance?",
    a: "A cash-out refinance replaces your existing first mortgage with a new, larger loan at today's rates. A HELOC leaves your first mortgage alone and adds a separate credit line in second position. If you have a low first mortgage rate, a HELOC usually makes more financial sense.",
  },
  {
    q: "What are the rates?",
    a: "HELOC rates are variable and tied to the prime rate, so they shift with the market. I'll walk you through current rates and APR options when we connect based on your specific scenario.",
  },
  {
    q: "How long does it take to close?",
    a: "Most HELOCs close within 2 to 4 weeks from application. Some lenders in my network offer expedited 7 to 10 day closings for qualified borrowers.",
  },
  {
    q: "Are there closing costs?",
    a: "This varies by lender and program. Some HELOCs have minimal or no closing costs. I'll show you the full picture upfront so there are no surprises.",
  },
];

export default function Heloc() {
  const [showStickyCta, setShowStickyCta] = useState(true);

  // SEO meta updates
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "HELOC in Arizona | Tap Home Equity Without Refinancing | Adaxa Home";

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      const created = !el;
      if (!el) {
        el = document.createElement("meta");
        if (attr === "property") el.setAttribute("property", selector.match(/\[property="([^"]+)"\]/)?.[1] ?? "");
        else el.setAttribute("name", selector.match(/\[name="([^"]+)"\]/)?.[1] ?? "");
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
      return { el, created };
    };

    const desc = "Access your home's equity with a HELOC and keep your low first mortgage rate. Pre-qualify in minutes with a soft credit check. Licensed loan officer Mykoal DeShazo, NMLS #1912347.";
    const ogTitle = "HELOC in Arizona | Tap Home Equity Without Refinancing | Adaxa Home";

    const metas = [
      setMeta('meta[name="description"]', "name", desc),
      setMeta('meta[property="og:title"]', "property", ogTitle),
      setMeta('meta[property="og:description"]', "property", desc),
      setMeta('meta[property="og:url"]', "property", "https://smartr8.com/heloc"),
      setMeta('meta[name="twitter:title"]', "name", ogTitle),
      setMeta('meta[name="twitter:description"]', "name", desc),
    ];

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalCreated = !canonical;
    const prevCanonical = canonical?.getAttribute("href");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", "https://smartr8.com/heloc");

    // JSON-LD
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "heloc-jsonld";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "name": "Adaxa Home",
      "description": "Licensed mortgage professionals specializing in HELOC, refinance, and home equity products.",
      "url": "https://smartr8.com/heloc",
      "telephone": "+19494185486",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "16767 N Perimeter Dr., Ste 150",
        "addressLocality": "Scottsdale",
        "addressRegion": "AZ",
        "postalCode": "85260",
        "addressCountry": "US",
      },
      "employee": {
        "@type": "Person",
        "name": "Mykoal DeShazo",
        "jobTitle": "Vice President, Senior Loan Officer",
        "identifier": "NMLS #1912347",
      },
    });
    document.head.appendChild(script);

    /* ANALYTICS: fire page_view event here */

    return () => {
      document.title = prevTitle;
      metas.forEach(({ el, created }) => {
        if (el && created) document.head.removeChild(el);
      });
      if (canonical) {
        if (canonicalCreated) document.head.removeChild(canonical);
        else canonical.setAttribute("href", prevCanonical ?? "");
      }
      const s = document.getElementById("heloc-jsonld");
      if (s) document.head.removeChild(s);
    };
  }, []);

  // Sticky CTA: hide when form section is in view
  useEffect(() => {
    const el = document.getElementById("qualify");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToForm = () => {
    document.getElementById("qualify")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />

      <main className="flex-1">

        {/* ── HERO ── */}
        <section className="pt-16 pb-12 md:pt-24 md:pb-20 px-4 container mx-auto max-w-4xl text-center">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-[1.1]">
              Tap Your Home's Equity. Keep Your Low First Mortgage Rate.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              A HELOC lets you access your equity without refinancing the great rate you already have. Pre-qualify in minutes with a soft credit check that won't impact your score.
            </p>
            <div className="flex justify-center pt-2">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white shadow-lg text-lg h-14 px-8"
                onClick={scrollToForm}
                data-testid="heloc-hero-cta"
              >
                See What You Qualify For
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              99+ wholesale lenders &middot; NMLS #1912347 &middot; Licensed mortgage professional &middot; No cost to apply
            </p>
          </div>
        </section>

        {/* ── WHY NOT REFINANCE ── */}
        <section className="border-y border-border bg-secondary/30 py-16 px-4">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-primary mb-8">Why Refinance When You Don't Have To?</h2>
            <div className="space-y-5 text-muted-foreground text-lg text-left max-w-2xl mx-auto">
              <p>
                If you bought or refinanced between 2020 and 2022, you're probably sitting on a first mortgage rate in the 2s, 3s, or low 4s. Trading that in for today's rates to pull cash out doesn't make sense for most homeowners.
              </p>
              <p>
                A HELOC keeps your first mortgage exactly where it is. You only borrow against your equity, only pay interest on what you actually use, and you can draw from it like a credit line whenever you need it.
              </p>
            </div>
          </div>
        </section>

        {/* ── THREE VALUE BULLETS ── */}
        <section className="py-20 px-4 container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">Built for Homeowners Who Want Flexibility</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="shadow-sm">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center">
                  <HomeIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Keep Your Rate Locked In</h3>
                <p className="text-muted-foreground text-sm">Your first mortgage stays untouched. The HELOC sits behind it as a second position credit line you control.</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Only Pay for What You Use</h3>
                <p className="text-muted-foreground text-sm">Get approved for a line up to your available equity. Draw what you need, when you need it. Interest only accrues on the balance you actually pull.</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Use It However You Want</h3>
                <p className="text-muted-foreground text-sm">Home renovation, debt consolidation, investment property down payment, college tuition, business capital, emergency reserve. Your equity, your call.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── SOCIAL PROOF ── */}
        <section className="bg-secondary/30 py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-14 text-primary">Why Homeowners Choose Adaxa Home</h2>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 text-center mb-14">
              <div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">99+</div>
                <div className="text-sm text-muted-foreground font-medium">Wholesale Lenders &amp; Investors</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">7+</div>
                <div className="text-sm text-muted-foreground font-medium">Years in the Mortgage Industry</div>
              </div>
              <div>
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">$199M+</div>
                <div className="text-sm text-muted-foreground font-medium">in Closed Loans</div>
              </div>
            </div>

            {/* Lender logo strip */}
            <div className="flex flex-wrap items-center justify-center gap-6 mb-14">
              {["Rocket Mortgage", "loanDepot", "Carrington Mortgage", "CAKE"].map((name) => (
                <div
                  key={name}
                  className="h-10 px-5 bg-white border border-border rounded-lg flex items-center justify-center text-sm font-medium text-muted-foreground"
                  aria-label={`${name} logo placeholder`}
                  title={`${name} — logo coming soon`}
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col h-full">
                  <p className="text-muted-foreground text-sm italic leading-relaxed mb-4 flex-1">
                    "Quick. Easy, straight to it. Mykoal was very communicative start to finish. I went to the extent of shopping many lenders, at least 10 of them, and Mykoal was patient and gave me the best deal by far."
                  </p>
                  <div className="text-xs font-semibold text-primary">Ethan W.</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col h-full">
                  <p className="text-muted-foreground text-sm italic leading-relaxed mb-4 flex-1">
                    "Excellent customer service. Went the extra mile to determine the best options for us and then stay with us throughout the entire process, even ensuring that technology glitches were addressed in a timely fashion."
                  </p>
                  <div className="text-xs font-semibold text-primary">Michelle F.</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col h-full">
                  <p className="text-muted-foreground text-sm italic leading-relaxed mb-4 flex-1">
                    "Mykoal did a great job working with us. He's good at follow up and keeping you updated. He also has all the patience in the world. Nice professional young man. Would definitely recommend him to do your loan."
                  </p>
                  <div className="text-xs font-semibold text-primary">Raymond L.</div>
                </CardContent>
              </Card>
            </div>

            {/* Review aggregate */}
            <div className="text-center text-sm text-muted-foreground">
              <span className="text-yellow-500 mr-1" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              4.9/5 across Google verified reviews
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="py-20 px-4 container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-16 text-primary">The Process, Simplified</h2>
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-[2px] bg-border z-0" />

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xl mb-6 shadow-md">1</div>
              <h3 className="font-semibold text-xl mb-3">Pre-Qualify in Minutes</h3>
              <p className="text-muted-foreground">Answer a few quick questions about your home and goals. Soft credit check only. No impact to your score.</p>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xl mb-6 shadow-md">2</div>
              <h3 className="font-semibold text-xl mb-3">See Your Options</h3>
              <p className="text-muted-foreground">I'll walk you through your numbers, terms, and which of my 99+ lender partners has the right program for your situation.</p>
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xl mb-6 shadow-md">3</div>
              <h3 className="font-semibold text-xl mb-3">Close and Fund</h3>
              <p className="text-muted-foreground">Most HELOCs close in 2 to 4 weeks. Funds available as soon as the line is open.</p>
            </div>
          </div>
        </section>

        {/* ── FORM ── */}
        <section id="qualify" className="bg-secondary/30 py-20 px-4 border-y border-border">
          <div className="container mx-auto max-w-xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-primary mb-3">Let's See What You Qualify For</h2>
              <p className="text-muted-foreground">Takes about 60 seconds. Soft credit check only.</p>
            </div>
            <div className="bg-white rounded-2xl border border-border shadow-lg p-6 sm:p-8">
              <HelocForm />
              {/* EHO compliance */}
              <div className="mt-6 pt-4 border-t flex items-center justify-center gap-2">
                <img src="/eho-logo.png" alt="Equal Housing Opportunity" className="h-4 w-auto object-contain opacity-60" />
                <span className="text-[10px] text-muted-foreground">Equal Housing Opportunity &middot; NMLS #1912347 &middot; Adaxa Home, LLC NMLS #2380533</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 px-4 container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">Common Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border rounded-lg px-5 data-[state=open]:border-primary/40"
              >
                <AccordionTrigger className="text-left font-semibold text-base py-4 hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* ── FINAL CTA BAND ── */}
        <section className="py-24 px-4 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Stop Wondering What You Qualify For</h2>
            <p className="text-xl text-primary-foreground/80 mb-10">60-second pre-qual. Soft credit check only. No obligation.</p>
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-white shadow-xl text-xl h-16 px-8"
              onClick={scrollToForm}
              data-testid="heloc-bottom-cta"
            >
              See My HELOC Options
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </section>

        {/* ── COMPLIANCE BLOCK ── */}
        <section className="py-10 px-4 border-t border-border bg-secondary/20">
          <div className="container mx-auto max-w-4xl text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/eho-logo.png" alt="Equal Housing Opportunity" className="h-4 w-auto object-contain opacity-60" />
              <span className="text-xs text-muted-foreground font-medium">Equal Housing Opportunity</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-3">
              Mykoal DeShazo | Vice President, Senior Loan Officer | NMLS #1912347
              <br />
              Adaxa Home | NMLS #2380533 | 16767 N Perimeter Dr., Ste 150, Scottsdale, AZ 85260
              <br />
              Office: <a href="tel:9494185486" className="hover:text-primary">(949) 418-5486</a> &middot; Email: <a href="mailto:mykoal@adaxahome.com" className="hover:text-primary">mykoal@adaxahome.com</a>
            </p>
            <p className="text-xs text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              All loans subject to credit approval and underwriting guidelines. Not all applicants will qualify. Rates and terms are subject to change without notice and based on creditworthiness, loan-to-value, occupancy, property type, and other factors. APR may vary. This is not a commitment to lend. Adaxa Home is licensed in AZ, CA, CO, FL, MI, MN, OR, PA, TX, VA, and WA. For licensing information, visit NMLS Consumer Access at{" "}
              <a
                href="https://www.nmlsconsumeraccess.org/TuringTestPage.aspx?ReturnUrl=/EntityDetails.aspx/COMPANY/2380533"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                www.nmlsconsumeraccess.org
              </a>
              .
            </p>
          </div>
        </section>

      </main>

      <Footer />

      {/* Sticky mobile CTA — hidden on desktop, hidden when form is in view */}
      {showStickyCta && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-safe md:hidden shadow-2xl border-t border-white/10"
          style={{ backgroundColor: "#13485A" }}
          role="complementary"
          aria-label="Pre-qualify call to action"
        >
          <Button
            className="w-full h-12 text-base font-semibold bg-accent hover:bg-accent/90 text-white"
            onClick={scrollToForm}
          >
            Pre-Qualify Now
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

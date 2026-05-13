import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ExternalLink } from "lucide-react";

interface LenderCardProps {
  tag: string;
  name: string;
  description: string;
  bullets: string[];
  href: string;
  cta: string;
}

function LenderCard({ tag, name, description, bullets, href, cta }: LenderCardProps) {
  return (
    <Card className="shadow-sm flex flex-col">
      <CardContent className="p-6 md:p-8 flex flex-col gap-5 h-full">
        <div
          className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
          style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
        >
          {tag}
        </div>
        <h2 className="text-2xl font-bold text-primary">{name}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        <ul className="space-y-2 text-sm text-foreground leading-relaxed">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4 border-t border-border">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#13485A" }}
          >
            {cta}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HelocInstantOptions() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />

      <main className="flex-1 py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl">

          {/* Heading */}
          <div className="text-center mb-12">
            <div
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
            >
              Instant Options
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
              Review Two Fast HELOC Paths
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              These options may help you get a quick rate review or pre-qualification experience, depending on lender rules and your eligibility. Review both and choose the one that best fits your needs.
            </p>
          </div>

          {/* Lender cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <LenderCard
              tag="Option 1"
              name="Deep Haven Mortgage"
              description="Useful for borrowers who want a streamlined online start and are comfortable reviewing lender-specific qualification details."
              bullets={[
                "Fast online prequalification experience.",
                "Documentation and approval timing vary by borrower profile.",
                "Review lender disclosures carefully before proceeding.",
                "Some borrowers may qualify without an appraisal or with alternative documentation, depending on the program.",
              ]}
              href="https://heloc.deephavenmortgage.com/prequal/consent?lo=mykoal-deshazo"
              cta="Apply with Deep Haven"
            />
            <LenderCard
              tag="Option 2"
              name="Figure"
              description="Useful for borrowers who want a digital process and a quick way to review available HELOC terms and next steps."
              bullets={[
                "Digital application and review process.",
                "Speed, rate, and funding timing vary by property and borrower profile.",
                "Proceed only after reviewing the lender's terms and disclosures.",
                "Alternative documentation or appraisal requirements may apply based on eligibility.",
              ]}
              href="https://heloc.adaxahome.com/account/heloc/register?referrer=07b7dc41-da1d-4044-8cfc-694ebbc1d3b7"
              cta="Apply with Figure"
            />
          </div>

          {/* Disclaimer note */}
          <div className="bg-secondary/40 border border-border rounded-xl p-5 text-sm text-muted-foreground leading-relaxed mb-6">
            <strong className="text-foreground">Important:</strong> Qualification and timing vary by lender and borrower profile. Claims about documentation requirements or appraisal waivers depend on lender program terms and individual eligibility. Not all applicants will qualify. Review each lender's disclosures for full terms.
          </div>

          {/* Questions? CTA */}
          <div className="text-center bg-primary rounded-2xl px-6 py-10 text-primary-foreground">
            <h2 className="text-2xl font-bold mb-3">Have questions before you apply?</h2>
            <p className="text-primary-foreground/80 mb-6">I'm here to walk you through both options and help you choose the right fit.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="tel:9494185486"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold text-sm bg-accent hover:bg-accent/90 text-white"
              >
                Call (949) 418-5486
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="sms:9494185486"
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-semibold text-sm border border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground"
              >
                Text Me
              </a>
            </div>
          </div>

          {/* Compliance */}
          <p className="text-center text-xs text-muted-foreground mt-8">
            Equal Housing Opportunity. NMLS #1912347. This is not a commitment to lend. All terms are subject to lender approval.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

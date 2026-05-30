import { useSearch } from "wouter";
import { PageMeta } from "@/components/PageMeta";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CalendarDays, Phone, MessageSquare, Zap } from "lucide-react";
import { Link } from "wouter";
export default function HelocNextSteps() {
  const search = useSearch();
  const firstName = new URLSearchParams(search).get("name") || "";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="Next Steps | Adaxa Home"
        description="Your HELOC application is underway. Mykoal DeShazo will be in touch shortly with your next steps."
        canonical="/heloc/next-steps"
        noIndex
      />
      <Header />

      <main className="flex-1 py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl">

          {/* Heading */}
          <div className="text-center mb-12">
            <div
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
            >
              Next Step
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
              {firstName ? `Thanks, ${firstName}. What would you like to do next?` : "What would you like to do next?"}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the fastest path for your situation. You can review instant HELOC options, schedule a quick conversation, or reach out directly.
            </p>
          </div>

          {/* Three option cards */}
          <div className="grid md:grid-cols-3 gap-5">

            {/* Card 1 — Instant options */}
            <Card className="shadow-sm border-primary/20 flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                >
                  Recommended
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">See My Instant Options</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Review two digital HELOC programs that may offer a fast qualification and rate review, depending on your profile and property.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-auto pt-2 border-t border-border">
                  Program terms, approval timing, documentation, and rates vary by lender and borrower eligibility.
                </p>
                <Link href="/heloc/instant-options">
                  <Button className="w-full h-11 bg-accent hover:bg-accent/90 text-white mt-1">
                    See My Instant Options
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Card 2 — Schedule */}
            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                >
                  Talk It Through
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Schedule an Appointment</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Want help comparing options before moving forward? Book a time to talk through your goals and next steps.
                  </p>
                </div>
                <div className="mt-auto">
                  <a
                    href="https://cal.com/mykoal-deshazo/consult"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Book a time with Mykoal on Cal.com (opens in new tab)"
                  >
                    <Button variant="outline" className="w-full h-11">
                      Book a Time
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Card 3 — Call / Text */}
            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                >
                  Immediate
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Call or Text Now</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Prefer a direct conversation? Reach out and I'll help you decide what to do next.
                  </p>
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <a href="tel:4802069290">
                    <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white">
                      <Phone className="mr-2 h-4 w-4" />
                      Call (480) 206-9290
                    </Button>
                  </a>
                  <a href="sms:4802069290">
                    <Button variant="outline" className="w-full h-11">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Text Me
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance note */}
          <p className="text-center text-xs text-muted-foreground mt-10">
            Equal Housing Opportunity. NMLS #1912347. This page is for general information only and is not a commitment to lend.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

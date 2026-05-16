import { useSearch, Link } from "wouter";
import { PageMeta } from "@/components/PageMeta";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CalendarDays, FileText, Zap } from "lucide-react";

const CAL_URL = "https://cal.com/mykoal-deshazo/consult";
const LENDINGPAD_URL =
  "https://prod.lendingpad.com/adaxa-home/pos#/?loid=dabbfd28-9b5f-46b8-9029-aa478433a995";

export default function WhatsNext() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const firstName = params.get("name") || "";
  const source = params.get("source") || "worksheet";

  const headline =
    source === "worksheet"
      ? firstName
        ? `Your worksheet is on its way, ${firstName}.`
        : "Your worksheet is on its way."
      : firstName
      ? `You're all set, ${firstName}.`
      : "You're all set.";

  const subhead =
    source === "worksheet"
      ? "Check your inbox for the PDF. While I review your numbers, here's how I can help you move forward right now."
      : "While I review your information, here's how I can help you move forward right now.";

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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Schedule a Call */}
            <Card className="shadow-sm border-primary/20 flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                >
                  Recommended
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Schedule a Call</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Want help walking through your numbers and picking the right strategy? Book a 20-minute
                    call with Mykoal directly.
                  </p>
                </div>
                <div className="mt-auto">
                  <a href={CAL_URL} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full h-11 bg-accent hover:bg-accent/90 text-white">
                      Book a Time <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Instant HELOC Options */}
            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                >
                  Fast Quote
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">See Instant HELOC Options</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Check two digital home-equity programs that may offer fast qualification — typically
                    no appraisal, soft credit pull.
                  </p>
                </div>
                <div className="mt-auto">
                  <Link href="/heloc/instant-options">
                    <Button variant="outline" className="w-full h-11">
                      See My Options <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Full Application */}
            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit"
                  style={{ backgroundColor: "rgba(19,72,90,0.08)", color: "#13485A" }}
                >
                  Ready to Apply
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Start a Full Application</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Skip the back-and-forth and start your application now in our secure portal. Takes
                    about 10–15 minutes.
                  </p>
                </div>
                <div className="mt-auto">
                  <a href={LENDINGPAD_URL} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full h-11">
                      Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
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
              or call <a href="tel:+19494185486" className="underline">(949) 418-5486</a>.
            </span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

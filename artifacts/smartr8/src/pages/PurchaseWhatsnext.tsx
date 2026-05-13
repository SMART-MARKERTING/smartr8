import { useSearch } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CalendarDays, FileText, Zap } from "lucide-react";
import { useGA4 } from "@/hooks/useGA4";
const CAL_URL = "https://cal.com/mykoal-deshazo/consult";
const LENDINGPAD_URL = "https://prod.lendingpad.com/adaxa-home/pos#/?loid=dabbfd28-9b5f-46b8-9029-aa478433a995";

export default function PurchaseWhatsnext() {
  const search = useSearch();
  const firstName = new URLSearchParams(search).get("name") || "";
  const ga4 = useGA4("purchase");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />

      <main className="flex-1 py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <div className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-5" style={{ backgroundColor:"rgba(19,72,90,0.08)", color:"#13485A" }}>
              Your Quote Is On Its Way
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4 leading-tight">
              {firstName ? `Your quote is on its way, ${firstName}.` : "Your quote is on its way."}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              While I review your information, here's how I can help you move forward right now.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <Card className="shadow-sm border-primary/20 flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit" style={{ backgroundColor:"rgba(19,72,90,0.08)", color:"#13485A" }}>
                  Fast Track
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Get Pre-Approved</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">Pre-approval positions you to make competitive offers. Most pre-approvals are done in 24 hours.</p>
                </div>
                <div className="mt-auto">
                  <a href={LENDINGPAD_URL} target="_blank" rel="noopener noreferrer" onClick={() => ga4.trackWhatsnextClick("get_preapproved")}>
                    <Button className="w-full h-11 bg-accent hover:bg-accent/90 text-white">Start Pre-Approval <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit" style={{ backgroundColor:"rgba(19,72,90,0.08)", color:"#13485A" }}>
                  Talk It Through
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Schedule a Call</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">Want to talk through programs and strategy first? Let's chat.</p>
                </div>
                <div className="mt-auto">
                  <a href={CAL_URL} target="_blank" rel="noopener noreferrer" onClick={() => ga4.trackWhatsnextClick("schedule_call")}>
                    <Button variant="outline" className="w-full h-11">Book a Time <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm flex flex-col">
              <CardContent className="p-6 flex flex-col gap-4 h-full">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit" style={{ backgroundColor:"rgba(19,72,90,0.08)", color:"#13485A" }}>
                  Full Application
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary mb-2">Continue to Full Application</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">Ready to start your purchase application?</p>
                </div>
                <div className="mt-auto">
                  <a href={LENDINGPAD_URL} target="_blank" rel="noopener noreferrer" onClick={() => ga4.trackWhatsnextClick("continue_application")}>
                    <Button variant="outline" className="w-full h-11">Continue Application <ArrowRight className="ml-2 h-4 w-4" /></Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-10">
            Equal Housing Opportunity. NMLS #1912347. This page is for general information only and is not a commitment to lend.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

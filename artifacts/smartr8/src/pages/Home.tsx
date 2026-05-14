import { useState } from "react";
import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FunnelModal } from "@/components/FunnelModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Phone, Home as HomeIcon, Percent, HelpCircle, Droplets, TrendingDown, Key } from "lucide-react";

export default function Home() {
  const [isFunnelOpen, setIsFunnelOpen] = useState(false);
  const [initialGoal, setInitialGoal] = useState<string | undefined>();

  const openFunnel = (goal?: string) => {
    setInitialGoal(goal);
    setIsFunnelOpen(true);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/10">
      <Header />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="pt-16 pb-12 md:pt-24 md:pb-20 px-4 container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-[1.1]">
                Real mortgage options from a loan officer who actually picks up the phone.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                I'm Mykoal at Adaxa Home in Scottsdale. Whether you want to pull cash from your home, lower your monthly payment, or just see what's possible, I'll show you real options from 99+ lenders. No credit pull required to see your options. We only pull credit when you give the OK.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-white shadow-lg text-lg h-14"
                  onClick={() => openFunnel()}
                  data-testid="hero-primary-cta"
                >
                  See My Options
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 text-lg border-2"
                  asChild
                  data-testid="hero-secondary-cta"
                >
                  <a href="tel:9494185486">
                    <Phone className="mr-2 h-5 w-5" />
                    Text Me
                  </a>
                </Button>
              </div>
            </div>

            {/* HEADSHOT */}
            <div className="relative h-64 md:h-[420px] w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-700 delay-150 flex items-center justify-center">
              <img
                src="/mykoal-headshot.jpg"
                alt="Mykoal DeShazo — VP & Senior Loan Officer at Adaxa Home"
                className="h-64 w-64 md:h-[380px] md:w-[380px] rounded-full object-cover object-top border-4 border-white shadow-2xl"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = "flex";
                }}
                data-testid="hero-headshot"
              />
              <div
                className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-secondary/30 rounded-full items-center justify-center border-4 border-white shadow-xl hidden"
                aria-hidden="true"
              >
                <span className="text-8xl font-bold text-primary/20 tracking-tighter">MD</span>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="border-y border-border bg-secondary/30 py-6">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm md:text-base font-medium text-muted-foreground text-center">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 7+ years closing loans</span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 99+ wholesale lenders</span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Vice President at Adaxa Home</span>
              <span className="hidden md:inline text-border">•</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Licensed since 2020</span>
            </div>
          </div>
        </section>

        {/* THREE PATHS */}
        <section className="py-20 px-4 container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">How can I help you today?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer group shadow-sm hover:shadow-md"
              onClick={() => openFunnel("Pull cash out of my home")}
              data-testid="path-card-cash"
            >
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <HomeIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Pull cash from your home</h3>
                <p className="text-muted-foreground text-sm">Access your equity to consolidate debt, renovate, or invest.</p>
                <div className="mt-4 text-primary font-medium text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Explore cash out <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer group shadow-sm hover:shadow-md"
              onClick={() => openFunnel("Lower my monthly payment")}
              data-testid="path-card-lower"
            >
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Percent className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Lower my monthly payment</h3>
                <p className="text-muted-foreground text-sm">Refinance to a better rate or drop mortgage insurance.</p>
                <div className="mt-4 text-primary font-medium text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  See lower rates <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer group shadow-sm hover:shadow-md"
              onClick={() => openFunnel("Not sure, show me options")}
              data-testid="path-card-unsure"
            >
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <HelpCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-xl">Not sure, show me options</h3>
                <p className="text-muted-foreground text-sm">Let's look at the numbers and see what makes sense for you.</p>
                <div className="mt-4 text-primary font-medium text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Get a review <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* READY TO APPLY */}
        <section className="py-12 px-4 bg-secondary/30">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-2 text-primary">Ready to Apply?</h2>
            <p className="text-center text-muted-foreground mb-8 text-sm">
              Pick your path. About 3 minutes, no credit pull.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Link href="/heloc">
                <Card className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm hover:shadow-md h-full">
                  <CardContent className="p-4 md:p-5 flex flex-col gap-2 h-full">
                    <div className="h-9 w-9 bg-primary/5 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base text-foreground leading-tight">HELOC</div>
                      <div className="text-muted-foreground text-xs mt-0.5">Tap your equity</div>
                    </div>
                    <div className="mt-auto pt-2 text-primary text-xs font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Start <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/apply/cash-out">
                <Card className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm hover:shadow-md h-full">
                  <CardContent className="p-4 md:p-5 flex flex-col gap-2 h-full">
                    <div className="h-9 w-9 bg-primary/5 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <HomeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base text-foreground leading-tight">Cash-Out Refi</div>
                      <div className="text-muted-foreground text-xs mt-0.5">Pull equity, one loan</div>
                    </div>
                    <div className="mt-auto pt-2 text-primary text-xs font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Start <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/apply/rate-reduction">
                <Card className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm hover:shadow-md h-full">
                  <CardContent className="p-4 md:p-5 flex flex-col gap-2 h-full">
                    <div className="h-9 w-9 bg-primary/5 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <TrendingDown className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base text-foreground leading-tight">Lower My Rate</div>
                      <div className="text-muted-foreground text-xs mt-0.5">Reduce your payment</div>
                    </div>
                    <div className="mt-auto pt-2 text-primary text-xs font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Start <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/apply/purchase">
                <Card className="hover:border-primary/50 transition-all cursor-pointer group shadow-sm hover:shadow-md h-full">
                  <CardContent className="p-4 md:p-5 flex flex-col gap-2 h-full">
                    <div className="h-9 w-9 bg-primary/5 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base text-foreground leading-tight">Buy a Home</div>
                      <div className="text-muted-foreground text-xs mt-0.5">Get pre-approved fast</div>
                    </div>
                    <div className="mt-auto pt-2 text-primary text-xs font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Start <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-background py-20 px-4">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl font-bold text-center mb-16 text-primary">How it works</h2>
            <div className="grid md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-[2px] bg-border z-0"></div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xl mb-6 shadow-md">1</div>
                <h3 className="font-semibold text-xl mb-3">Tell me about your home and goal</h3>
                <p className="text-muted-foreground">Quick form, no credit pull required to see what's possible.</p>
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xl mb-6 shadow-md">2</div>
                <h3 className="font-semibold text-xl mb-3">I pull options from 99+ lenders</h3>
                <p className="text-muted-foreground">Cash out, HELOC, refi, whatever fits your specific situation.</p>
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-white font-bold flex items-center justify-center text-xl mb-6 shadow-md">3</div>
                <h3 className="font-semibold text-xl mb-3">You pick what works</h3>
                <p className="text-muted-foreground">We review the numbers together. No pressure. We close it when you're ready.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT MYKOAL */}
        <section className="py-20 px-4 bg-secondary/30 container mx-auto max-w-4xl text-center">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/mykoal-headshot.jpg"
              alt="Mykoal DeShazo"
              className="h-24 w-24 rounded-full object-cover object-top border-4 border-white shadow-lg mb-6"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              data-testid="about-headshot"
            />
            <h2 className="text-3xl font-bold text-primary">About Mykoal</h2>
          </div>
          <div className="prose prose-lg mx-auto text-muted-foreground">
            <p className="lead text-xl text-foreground font-medium mb-6">
              I'm Vice President and Senior Loan Officer at Adaxa Home in Scottsdale, AZ, with 7+ years closing mortgages.
            </p>
            <p className="mb-8">
              I work with 99+ wholesale lenders -- Rocket, loanDepot, Carrington, CAKE, and more -- which means I'm not stuck pitching one product. I look at your situation and bring you the option that actually fits.
            </p>
            <div className="inline-block border border-border rounded-lg p-6 bg-card shadow-sm text-left">
              <div className="font-semibold text-foreground mb-1">Mykoal DeShazo</div>
              <div className="space-y-1 text-sm">
                <div><a href="tel:9494185486" className="hover:text-primary transition-colors">(949) 418-5486</a></div>
                <div><a href="mailto:mykoal@adaxahome.com" className="hover:text-primary transition-colors">mykoal@adaxahome.com</a></div>
                <div className="text-muted-foreground pt-2">NMLS #1912347</div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 px-4 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to see your options?</h2>
            <p className="text-xl text-primary-foreground/80 mb-10">Quick conversation. No credit pull. No commitment.</p>
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-white shadow-xl text-xl h-16 px-8 mb-6"
              onClick={() => openFunnel()}
              data-testid="footer-cta"
            >
              See My Options
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
            <p className="text-primary-foreground/70">
              Or text me directly at <a href="tel:9494185486" className="font-semibold hover:underline">(949) 418-5486</a>
            </p>
          </div>
        </section>
      </main>

      <Footer />
      <FunnelModal
        isOpen={isFunnelOpen}
        onClose={() => setIsFunnelOpen(false)}
        initialGoal={initialGoal}
      />
    </div>
  );
}

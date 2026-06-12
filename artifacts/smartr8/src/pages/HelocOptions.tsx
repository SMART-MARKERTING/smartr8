import { PiggyBank, Home, ShieldCheck, Clock, Lock, Layers } from "lucide-react";
import { ProductLanding, type ProductConfig } from "@/components/ProductLanding";
import { mykoalUrl, MYKOAL_ARTICLES } from "@/lib/funnelEvents";

// HELOC funnel lander. Angle: tap your home equity with a line of credit that
// sits behind your existing mortgage, so you keep your current first-mortgage
// rate. Indexable companion to the (noIndex) /heloc-v3 application funnel —
// this page carries the HELOC FAQ + FAQPage schema for search/AI visibility
// and hands leads off the same way the other product landers do.

const config: ProductConfig = {
  loanType: "HELOC",
  route: "/heloc-options",
  meta: {
    title: "HELOC Options | Mykoal DeShazo at Adaxa Home",
    description:
      "Tap your home equity with a HELOC and keep your current mortgage rate. See your options from Mykoal DeShazo, Senior Loan Officer at Adaxa Home. NMLS #1912347.",
  },
  eyebrow: "HELOC Options",
  h1: "Tap your home equity without touching your mortgage rate",
  subhead:
    "A home equity line of credit sits behind your current mortgage, so you can access your equity while keeping the low first-mortgage rate you already have. See what your options could look like, subject to a full application review.",
  consentProduct: "HELOC",
  ctaLabel: "See My HELOC Options",
  secondaryCtaLabel: "See My HELOC Options",
  serviceName: "HELOC (Home Equity Line of Credit)",
  serviceType: "Home Equity Line of Credit",
  trackingPage: "heloc",
  trustPills: [
    { icon: Home, label: "Keep your 1st-mortgage rate" },
    { icon: Clock, label: "Options in minutes" },
    { icon: Lock, label: "Soft review only" },
  ],
  benefits: [
    {
      icon: Home,
      title: "Keep your current rate",
      body: "A HELOC is a second lien behind your existing mortgage, so your first-mortgage rate and term stay exactly where they are.",
    },
    {
      icon: PiggyBank,
      title: "Draw what you need",
      body: "Access your equity as a revolving line and draw funds when you need them, rather than taking one lump sum up front.",
    },
    {
      icon: Layers,
      title: "Consolidate higher-rate debt",
      body: "Many homeowners use a HELOC to consolidate higher-rate balances, subject to their goals and a full application review.",
    },
    {
      icon: ShieldCheck,
      title: "Guidance, not pressure",
      body: "See your options with no obligation. There's no credit pull just to review what may fit your goals.",
    },
  ],
  howSteps: [
    { title: "Tell us about your home", body: "Share your estimated home value and mortgage balance. An estimate is fine to start." },
    { title: "We review your equity", body: "We look at what your equity could unlock and which programs may fit your goals." },
    { title: "See your options", body: "Mykoal walks you through your HELOC options and the next steps, with no obligation." },
  ],
  faqs: [
    {
      q: "What is a HELOC?",
      a: "A HELOC, or home equity line of credit, is a revolving credit line secured by the equity in your home. You can draw funds as you need them during the draw period and repay over time, similar to how a credit card works but tied to your property. How much you can access depends on your equity, your credit profile, and a full application review.",
    },
    {
      q: "Does a HELOC replace my current mortgage?",
      a: "No. A HELOC sits behind your existing mortgage as a second lien, so your current first mortgage and its rate stay exactly where they are. That makes it a common way to tap equity without refinancing a low first-mortgage rate you want to keep.",
    },
    {
      q: "Can I use a HELOC for debt consolidation?",
      a: "Many homeowners use a HELOC to consolidate higher-rate balances into a single line tied to their home equity. Whether it makes sense for you depends on your balances, your goals, and what you qualify for under a full application review. We can walk through your numbers with no obligation.",
    },
    {
      q: "How long does a HELOC take?",
      a: "Timelines vary by lender and by how quickly your documents come together, but many HELOCs move faster than a full refinance. Once we review your scenario, we can give you a realistic timeline for your situation. Actual closing time is subject to underwriting and verification.",
    },
    {
      q: "Is a HELOC better than a cash-out refinance?",
      a: "It depends on your current mortgage rate and your goals. A HELOC keeps your existing first mortgage in place, while a cash-out refinance replaces it with a new, larger loan. Many borrowers compare both before deciding which path fits.",
      learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.helocVsCashOut), label: "HELOC vs. cash-out refinance", mykoal: true },
    },
  ],
  faqGuideLinks: [
    { href: mykoalUrl(MYKOAL_ARTICLES.helocVsCashOut), label: "Read the full guide: HELOC vs. cash-out refinance", mykoal: true },
  ],
};

export default function HelocOptions() {
  return <ProductLanding config={config} />;
}

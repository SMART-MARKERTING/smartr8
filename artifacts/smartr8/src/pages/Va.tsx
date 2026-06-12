import { ShieldCheck, BadgeCheck, Home, Wallet, Clock } from "lucide-react";
import { ProductLanding, type ProductConfig } from "@/components/ProductLanding";
import { mykoalUrl, MYKOAL_ARTICLES } from "@/lib/funnelEvents";

// VA funnel. Angle: VA-backed home loans for eligible veterans, active-duty
// service members, and certain surviving spouses. Mirrors the DSCR lander via
// the shared <ProductLanding />.
//
// COMPLIANCE: product language is "VA loan" / "VA-backed loan" only — never
// imply endorsement by the VA or any government agency. Conditional phrasing
// only (no eligibility or approval guarantees). The required VA disclaimer
// renders in the ComplianceFooter via `vaDisclaimer: true` ({{VA_DISCLAIMER_TEXT}}).

// Official VA.gov source for the funding fee FAQ (no figures cited on-page;
// the source link points borrowers to the government page for current amounts).
const VA_GOV_FUNDING_FEE_URL =
  "https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/";

const config: ProductConfig = {
  loanType: "VA",
  route: "/va",
  meta: {
    title: "VA Home Loans | Mykoal DeShazo at Adaxa Home",
    description:
      "VA-backed home loans for eligible veterans, service members, and surviving spouses from Mykoal DeShazo, Senior Loan Officer at Adaxa Home. NMLS #1912347.",
  },
  eyebrow: "VA Home Loans",
  h1: "VA-backed home loans for those who served",
  subhead:
    "If you are an eligible veteran, active-duty service member, or surviving spouse, a VA-backed loan can be one of the strongest financing options available. Let us help you understand your options, subject to a full application review.",
  consentProduct: "VA loan",
  ctaLabel: "See My VA Loan Options",
  secondaryCtaLabel: "See My VA Loan Options",
  serviceName: "VA Home Loan",
  serviceType: "VA-backed mortgage",
  trackingPage: "va",
  vaDisclaimer: true,
  trustPills: [
    { icon: BadgeCheck, label: "Earned benefit" },
    { icon: Wallet, label: "No down payment for many" },
    { icon: Clock, label: "Options in minutes" },
  ],
  benefits: [
    {
      icon: Wallet,
      title: "No down payment for many",
      body: "Many eligible borrowers qualify for a VA-backed loan with no down payment, subject to entitlement and a full application review.",
    },
    {
      icon: ShieldCheck,
      title: "Built for your situation",
      body: "VA-backed loans are designed around the needs of veterans and service members. We tailor your options to your goals and timeline.",
    },
    {
      icon: Home,
      title: "Purchase or refinance",
      body: "Use your VA loan benefit to buy a home or to refinance, including a VA cash-out refinance for those who qualify.",
    },
    {
      icon: BadgeCheck,
      title: "Reuse your benefit",
      body: "In many cases the VA loan benefit can be used more than once, depending on your remaining entitlement.",
    },
  ],
  howSteps: [
    { title: "Tell us about your goal", body: "Share whether you are buying or refinancing and a little about your situation." },
    { title: "We review your options", body: "We look at VA-backed programs that may fit and what the path to qualify looks like." },
    { title: "See your options", body: "Mykoal walks you through your VA loan options and the next steps, with no obligation." },
  ],
  faqs: [
    {
      q: "Who is eligible for a VA loan?",
      a: "VA loans are available to many eligible veterans, active-duty service members, and certain surviving spouses who meet service requirements. Eligibility is documented through a Certificate of Eligibility (COE), and final qualification is subject to underwriting and a full application review. We can help you understand the steps to confirm your eligibility.",
    },
    {
      q: "Do VA loans require a down payment?",
      a: "Many eligible borrowers qualify for a VA-backed loan with no down payment, which is one of the program's most valuable features. Whether that applies to you depends on your entitlement and a full application review. Some situations, such as limited remaining entitlement, may change this.",
    },
    {
      q: "Can I use my VA loan benefit more than once?",
      a: "Yes, in many cases. The VA loan benefit can often be reused, and some borrowers have more than one VA-backed loan at a time depending on their remaining entitlement. The details depend on your situation and are confirmed through underwriting.",
      learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.vaLoanMyths), label: "Common VA loan myths", mykoal: true },
    },
    {
      q: "What is a VA cash-out refinance?",
      a: "A VA cash-out refinance lets eligible homeowners replace their current mortgage with a new VA-backed loan and access their home equity in cash. It can also be used to refinance a non-VA loan into a VA-backed loan for those who qualify. Terms and eligibility are subject to a full application review.",
      learnMore: { href: mykoalUrl(MYKOAL_ARTICLES.vaCashOut), label: "VA cash-out refinance explained", mykoal: true },
    },
    {
      q: "What is the VA funding fee?",
      a: "The VA funding fee is a one-time fee that helps sustain the VA loan program, and it applies to most VA-backed loans. The amount varies based on factors like your down payment and whether you have used the benefit before, and some borrowers may be exempt. Official details, including current amounts, are published by the VA.",
      learnMore: { href: VA_GOV_FUNDING_FEE_URL, label: "VA funding fee details (VA.gov)" },
    },
  ],
  faqGuideLinks: [
    { href: mykoalUrl(MYKOAL_ARTICLES.vaLoanMyths), label: "Read the full guide: VA loan myths", mykoal: true },
    { href: mykoalUrl(MYKOAL_ARTICLES.vaCashOut), label: "Read the full guide: VA cash-out refinance", mykoal: true },
  ],
};

export default function Va() {
  return <ProductLanding config={config} />;
}

import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="mt-auto py-12" style={{ backgroundColor: "#1A3A47" }}>
      <div className="container mx-auto px-4 max-w-5xl text-center">
        <p className="font-medium mb-1 text-white">Mykoal DeShazo | Vice President | Senior Loan Officer | NMLS #1912347</p>
        <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>Adaxa Home, LLC | NMLS #2380533</p>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>16767 N Perimeter Dr., Ste 150, Scottsdale, AZ 85260</p>

        <div className="flex items-center justify-center gap-2 mb-4">
          <img
            src="/eho-logo-optimized.png"
            alt="Equal Housing Opportunity"
            width={15}
            height={16}
            loading="lazy"
            decoding="async"
            className="h-4 w-auto object-contain brightness-0 invert"
          />
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>Equal Housing Opportunity</span>
        </div>

        <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>
          Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA.
        </p>

        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
          <a href="https://www.nmlsconsumeraccess.org/TuringTestPage.aspx?ReturnUrl=/EntityDetails.aspx/COMPANY/2380533" target="_blank" rel="noopener noreferrer" className="underline hover:text-white" style={{ color: "rgba(255,255,255,0.6)" }}>
            Full licensing and disclosures at adaxahome.com
          </a>
        </p>

        <p className="text-xs max-w-3xl mx-auto mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
          This is not a commitment to lend. All loans subject to credit approval, income verification, and property appraisal. Rates and terms subject to change.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
          <Link
            href="/worksheet/internal"
            className="underline hover:text-white"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Loan Benefits Worksheet
          </Link>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
          <a
            href="https://adaxahome.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Privacy Policy
          </a>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
          <a
            href="https://adaxahome.com/terms-of-use/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Terms of Use
          </a>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
          <a
            href="https://adaxahome.com/texas-compliance-notice/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Texas Compliance Notice
          </a>
        </div>
      </div>
    </footer>
  );
}

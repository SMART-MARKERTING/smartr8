export function Footer() {
  return (
    <footer className="bg-white border-t border-border py-12 mt-auto">
      <div className="container mx-auto px-4 max-w-5xl text-center">
        <p className="text-primary font-medium mb-1">Mykoal DeShazo | Vice President | Senior Loan Officer | NMLS #1912347</p>
        <p className="text-muted-foreground text-sm mb-1">Adaxa Home, LLC | NMLS #2380533</p>
        <p className="text-muted-foreground text-sm mb-4">16767 N Perimeter Dr., Ste 150, Scottsdale, AZ 85260</p>

        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/eho-logo.png" alt="Equal Housing Opportunity" className="h-4 w-auto object-contain" />
          <span className="text-muted-foreground text-sm font-medium">Equal Housing Opportunity</span>
        </div>

        <p className="text-muted-foreground text-xs mb-2">
          Licensed in multiple states. See{" "}
          <a href="https://adaxahome.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
            adaxahome.com
          </a>{" "}
          for full state licensing details.
        </p>

        <p className="text-muted-foreground text-xs mb-3">
          <a href="https://adaxahome.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
            Full licensing and disclosures at adaxahome.com
          </a>
        </p>

        <p className="text-muted-foreground text-xs max-w-3xl mx-auto opacity-80 mb-4">
          This is not a commitment to lend. All loans subject to credit approval, income verification, and property appraisal. Rates and terms subject to change.
        </p>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a
            href="https://adaxahome.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            Privacy Policy
          </a>
          <span>·</span>
          <a
            href="https://adaxahome.com/terms-of-use/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary"
          >
            Terms of Use
          </a>
        </div>
      </div>
    </footer>
  );
}

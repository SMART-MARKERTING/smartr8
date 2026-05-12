import { Link } from "wouter";
import { Phone } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0f3d4d] shadow-sm" style={{ backgroundColor: "#13485A" }}>
      <div className="container mx-auto px-4 h-auto min-h-16 flex items-center justify-between max-w-5xl py-2 gap-3">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <img src="/adaxa-logo.jpg" alt="Adaxa Home" className="h-10 w-auto object-contain shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold leading-tight text-sm text-white">Mykoal DeShazo</span>
            <span className="leading-tight text-[10px]" style={{ color: "rgba(255,255,255,0.75)" }}>
              Vice President | Senior Loan Officer at Adaxa Home
            </span>
          </div>
        </Link>
        <a
          href="tel:9494185486"
          className="flex items-center gap-2 font-medium transition-colors shrink-0 text-sm text-white hover:text-white/80"
          data-testid="header-phone"
        >
          <Phone className="h-4 w-4" />
          <span>(949) 418-5486</span>
        </a>
      </div>
    </header>
  );
}

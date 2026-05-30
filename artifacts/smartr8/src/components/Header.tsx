import { Link } from "wouter";
import { Phone } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0f3d4d] shadow-sm" style={{ backgroundColor: "#13485A" }}>
      <div className="container mx-auto px-4 h-12 flex items-center justify-between max-w-5xl gap-3">
        <Link href="/" className="flex items-center min-w-0">
          <img
            src="/adaxa-logo-optimized.jpg"
            alt="Adaxa Home"
            width={89}
            height={32}
            className="h-8 w-auto object-contain shrink-0"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
        <a
          href="tel:4802069290"
          className="flex items-center gap-2 font-medium transition-colors shrink-0 text-sm text-white hover:text-white/80"
          data-testid="header-phone"
        >
          <Phone className="h-4 w-4" />
          <span>(480) 206-9290</span>
        </a>
      </div>
    </header>
  );
}

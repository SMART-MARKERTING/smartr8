import {
  LO_NAME,
  NMLS_ID,
  COMPANY_NAME,
  COMPANY_NMLS_ID,
  EQUAL_HOUSING_TEXT,
  LICENSED_STATES_TEXT,
  VA_DISCLAIMER_TEXT,
} from "@/lib/compliance";

const BRAND_TEAL = "#13485A";

/**
 * Visible, legible, footer-positioned compliance block for the conversion
 * funnels. Renders the licensing identity (LO + company NMLS), Equal Housing
 * Opportunity, licensed states, and the standard "not a commitment to lend"
 * language. VA funnel pages additionally render {{VA_DISCLAIMER_TEXT}}.
 */
export function ComplianceFooter({ showVaDisclaimer = false }: { showVaDisclaimer?: boolean }) {
  return (
    <section className="px-4 py-8 border-t border-border" style={{ backgroundColor: "#F8F5F0" }}>
      <div className="mx-auto max-w-3xl text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img
            src="/eho-logo-optimized.png"
            alt={EQUAL_HOUSING_TEXT}
            width={15}
            height={16}
            loading="lazy"
            decoding="async"
            className="h-4 w-auto object-contain opacity-70"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <span className="text-xs font-semibold" style={{ color: BRAND_TEAL }}>
            {EQUAL_HOUSING_TEXT}
          </span>
        </div>

        <p className="text-xs font-medium" style={{ color: BRAND_TEAL }}>
          {LO_NAME} · NMLS #{NMLS_ID} · {COMPANY_NAME} · NMLS #{COMPANY_NMLS_ID}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">{LICENSED_STATES_TEXT}</p>

        <p className="mt-3 text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          This is not a commitment to lend. All loans are subject to credit approval, income
          verification, and property appraisal. Programs, rates, and terms are subject to change and
          to a full application review.
        </p>

        {showVaDisclaimer && (
          <p className="mt-3 text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {VA_DISCLAIMER_TEXT}
          </p>
        )}
      </div>
    </section>
  );
}

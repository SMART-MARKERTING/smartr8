// Conversion-funnel analytics.
//
// One naming convention: `{page}_{element}_{action}` in snake_case
// (e.g. heloc_primary_cta_click, va_form_start). Every event name + its
// properties is documented in /TRACKING.md.
//
// Events fire into GA4 via the GTM dataLayer (or the gtag fallback), matching
// the existing useGA4 hook. Nothing here ever throws — analytics must never
// break the conversion path.

function push(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as Window & {
      dataLayer?: unknown[];
      gtag?: (...a: unknown[]) => void;
    };
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event, ...params });
    } else if (typeof w.gtag === "function") {
      w.gtag("event", event, params);
    }
  } catch {
    // swallow — analytics must never break navigation
  }
}

/**
 * Returns a tracker bound to a single funnel page key (snake_case), e.g.
 * "heloc", "cash_out", "rate_reduction", "dscr", "va". Each method emits a
 * `{page}_{element}_{action}` event with the page echoed as a property.
 */
export function makeFunnelTracker(page: string) {
  const ev = (
    element: string,
    action: string,
    params: Record<string, unknown> = {},
  ) => push(`${page}_${element}_${action}`, { page, ...params });

  return {
    primaryCtaClick: () => ev("primary_cta", "click"),
    secondaryCtaClick: () => ev("secondary_cta", "click"),
    phoneClick: () => ev("phone", "click"),
    formStart: () => ev("form", "start"),
    formSubmit: () => ev("form", "submit"),
    faqExpand: (question: string) => ev("faq", "expand", { faq_question: question }),
    outboundMykoalClick: (url: string) =>
      ev("outbound_mykoal", "click", { destination_url: url }),
  };
}

export type FunnelTracker = ReturnType<typeof makeFunnelTracker>;

// ── mykoal.com cross-domain links ───────────────────────────────────────────
// Every smartr8 → mykoal link carries the funnel-FAQ UTM set so cross-domain
// attribution stitches with the mirror convention on mykoal.com
// (utm_source=mykoal, utm_medium=learn_article, utm_campaign=ai_search_visibility).

const MYKOAL_ORIGIN = "https://mykoal.com";

/** Builds a UTM-tagged mykoal.com URL from a path like "/learn/...". */
export function mykoalUrl(path: string): string {
  const base = path.startsWith("http") ? path : `${MYKOAL_ORIGIN}${path}`;
  try {
    const u = new URL(base);
    u.searchParams.set("utm_source", "smartr8");
    u.searchParams.set("utm_medium", "funnel_faq");
    u.searchParams.set("utm_campaign", "borrower_education");
    return u.toString();
  } catch {
    return base;
  }
}

/** Canonical mykoal.com learn-article paths referenced from the funnels. */
export const MYKOAL_ARTICLES = {
  helocVsCashOut: "/learn/heloc-vs-cash-out-refinance",
  whenRefinance: "/learn/when-does-refinancing-make-sense",
  dscrRequirementsAz: "/learn/dscr-loan-requirements-arizona",
  vaLoanMyths: "/learn/va-loan-myths",
  vaCashOut: "/learn/va-cash-out-refinance",
} as const;

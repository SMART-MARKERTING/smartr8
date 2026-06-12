import { useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { JsonLd } from "@/components/JsonLd";
import { ArrowUpRight } from "lucide-react";
import type { FunnelTracker } from "@/lib/funnelEvents";

const BRAND_TEAL = "#13485A";
const BRAND_RED = "#E31B23";

export interface FaqItem {
  /** Visible question. Used verbatim as the schema Question name. */
  q: string;
  /**
   * Visible answer, plain text. Used verbatim as the schema Answer text, so
   * keep it compliance-safe: conditional language only, no rates/figures.
   * Any deep link lives in `learnMore` (a separate element) so the schema
   * text stays an exact match of the visible answer paragraph.
   */
  a: string;
  /** Optional deep link rendered after the answer. */
  learnMore?: GuideLink;
}

export interface GuideLink {
  href: string;
  label: string;
  /** True when this link points at mykoal.com (fires the outbound event). */
  mykoal?: boolean;
}

export interface FunnelFAQProps {
  /** 5–7 question/answer pairs. */
  items: FaqItem[];
  /** "Read the full guide" link(s) shown after the accordion. */
  guideLinks?: GuideLink[];
  /** Analytics tracker for the host page. */
  track?: FunnelTracker;
  heading?: string;
}

/**
 * Collapsed-by-default FAQ accordion for the conversion funnels. Near-zero
 * visual weight, renders below the primary conversion section, and emits the
 * matching FAQPage JSON-LD built from the SAME `items` array — so the schema
 * text is always an exact match of what's on the page (exactly one FAQPage
 * block per page). Expanding an item fires a tracking event; clicking a
 * mykoal.com link fires an outbound event.
 */
export function FunnelFAQ({ items, guideLinks, track, heading = "Frequently asked questions" }: FunnelFAQProps) {
  // Only fire faq_expand on open (not on collapse), once per question per open.
  const lastOpen = useRef<string>("");

  const handleValueChange = (value: string) => {
    if (value && value !== lastOpen.current) {
      const idx = Number(value.replace("faq-", ""));
      const item = items[idx];
      if (item) track?.faqExpand(item.q);
    }
    lastOpen.current = value;
  };

  const onMykoalClick = (link: GuideLink) => {
    if (link.mykoal) track?.outboundMykoalClick(link.href);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6" style={{ color: BRAND_TEAL }}>
        {heading}
      </h2>

      <Accordion type="single" collapsible className="w-full" onValueChange={handleValueChange}>
        {items.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`}>
            <AccordionTrigger className="text-base font-semibold no-underline hover:no-underline" style={{ color: BRAND_TEAL }}>
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              <p>{item.a}</p>
              {item.learnMore && (
                <p className="mt-2">
                  <a
                    href={item.learnMore.href}
                    rel="noopener"
                    onClick={() => onMykoalClick(item.learnMore!)}
                    className="inline-flex items-center gap-1 font-semibold underline"
                    style={{ color: BRAND_RED }}
                  >
                    {item.learnMore.label}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {guideLinks && guideLinks.length > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          {guideLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              rel="noopener"
              onClick={() => onMykoalClick(link)}
              className="inline-flex items-center gap-1 text-sm font-semibold underline"
              style={{ color: BRAND_RED }}
            >
              {link.label}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ))}
        </div>
      )}

      {/* FAQPage schema — built from the same `items`, so it always matches the
          visible text. Exactly one FAQPage block per page. */}
      <JsonLd
        id="faqpage-jsonld"
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
    </div>
  );
}

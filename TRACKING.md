# Funnel Conversion Tracking

Analytics events for the smartr8.com conversion funnels. These fire into GA4
via the GTM `dataLayer` (with a `gtag` fallback), and never throw — analytics
must never break the conversion path.

## Naming convention

All funnel events use **`{page}_{element}_{action}`** in `snake_case`
(e.g. `heloc_primary_cta_click`, `va_form_start`).

The implementation lives in [`artifacts/smartr8/src/lib/funnelEvents.ts`](artifacts/smartr8/src/lib/funnelEvents.ts)
(`makeFunnelTracker(page)`), wired into:

- `ProductLanding` (the DSCR, VA, and HELOC landers)
- `Worksheet` (the cash-out and rate-reduction lanes)

### Page keys (`{page}`)

| Page key        | Route             | Component                  |
| --------------- | ----------------- | -------------------------- |
| `heloc`         | `/heloc-options`  | `ProductLanding`           |
| `dscr`          | `/dscr`           | `ProductLanding`           |
| `va`            | `/va`             | `ProductLanding`           |
| `cash_out`      | `/cash-out`       | `Worksheet`                |
| `rate_reduction`| `/rate-reduction` | `Worksheet`                |

> Note: `/heloc-v3` and `/heloc-v2` are pre-existing, `noIndex` application
> funnels and are intentionally **not** modified by this work.

## Events

Every event carries a `page` property (the page key above) in addition to the
properties listed below.

| Event                          | Trigger                                   | Extra properties                |
| ------------------------------ | ----------------------------------------- | ------------------------------- |
| `{page}_primary_cta_click`     | Primary CTA click (hero CTA / funnel Continue) | —                          |
| `{page}_secondary_cta_click`   | Secondary CTA click (after the FAQ block) | —                               |
| `{page}_phone_click`           | Click on a `tel:` phone link              | —                               |
| `{page}_form_start`            | First focus of the lead form's first field| —                               |
| `{page}_form_submit`           | Successful lead submission                | —                               |
| `{page}_faq_expand`            | FAQ accordion item expanded               | `faq_question` (question text)  |
| `{page}_outbound_mykoal_click` | Click on a mykoal.com link (FAQ deep link or "Read the full guide") | `destination_url` |

### Concrete event names

- HELOC: `heloc_primary_cta_click`, `heloc_secondary_cta_click`, `heloc_phone_click`, `heloc_form_start`, `heloc_form_submit`, `heloc_faq_expand`, `heloc_outbound_mykoal_click`
- DSCR: `dscr_primary_cta_click`, `dscr_secondary_cta_click`, `dscr_phone_click`, `dscr_form_start`, `dscr_form_submit`, `dscr_faq_expand`, `dscr_outbound_mykoal_click`
- VA: `va_primary_cta_click`, `va_secondary_cta_click`, `va_phone_click`, `va_form_start`, `va_form_submit`, `va_faq_expand`, `va_outbound_mykoal_click`
- Cash-out: `cash_out_primary_cta_click`, `cash_out_secondary_cta_click`, `cash_out_form_start`, `cash_out_form_submit`, `cash_out_faq_expand`, `cash_out_outbound_mykoal_click`
- Rate reduction: `rate_reduction_primary_cta_click`, `rate_reduction_secondary_cta_click`, `rate_reduction_form_start`, `rate_reduction_form_submit`, `rate_reduction_faq_expand`, `rate_reduction_outbound_mykoal_click`

> `phone_click` only fires where a `tel:` link is rendered (the `ProductLanding`
> thank-you screen). The `Worksheet` lanes do not render a phone link, so they
> do not emit `phone_click`.

## Cross-domain attribution (UTM)

Every smartr8.com → mykoal.com link carries:

- `utm_source=smartr8`
- `utm_medium=funnel_faq`
- `utm_campaign=borrower_education`

This mirrors the mykoal.com → smartr8.com convention
(`utm_source=mykoal`, `utm_medium=learn_article`, `utm_campaign=ai_search_visibility`)
so cross-domain attribution stitches. UTM tagging is centralized in
`mykoalUrl()` in `funnelEvents.ts`.

## Pre-existing analytics (unchanged)

These continue to fire alongside the funnel events above and are not part of
this convention:

- **GA4** via `useGA4` (`funnel_start`, `funnel_step_completed`, `generate_lead`, …)
- **Meta Pixel** via `trackFbEvent` (`ViewContent`, `Lead`, `Contact`, `Schedule`, …)

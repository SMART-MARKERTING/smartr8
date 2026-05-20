# Changelog

## Unreleased

### Follow-up backlog (after Meta campaign launches)

Parked here while the v2 A/B test runs. Revisit once we have ~1 week of
ad data:

1. **`manualChunks` route-split for ad-traffic visitors.** Move
   `pages/Home`, `pages/Worksheet`, `pages/WorksheetInternal`, and the
   `/heloc/whats-next` family into their own lazy chunks so visitors
   landing on `/heloc/quick(-v2)` from a Meta ad don't carry home-page
   or worksheet code. Keep the HELOC funnel routes (`HelocQuick`,
   `HelocQuickV2`, `HelocInstantOptions`, `HelocInstantOptionsV2`,
   `HelocWhatsnext`) eager-bundled together since users move between
   them. Estimated main-bundle shrink: 30-60 kB raw / 8-15 kB gz.

2. **Defer Meta Pixel and GTM further.** Currently end-of-body, which
   removed them from the critical path but they still execute on initial
   parse. Push them behind `requestIdleCallback` or a 1-2 second
   `setTimeout` so they don't compete with React mount for the main
   thread. **Risk:** the click-through Lead event on `/heloc/quick(-v2)`
   form submit must still fire reliably. Add a defensive timer that
   force-loads fbq before the form is submittable, or accept that a
   user who submits within ~1 second of landing might miss a Lead
   attribution. Verify in Meta Events Manager Test Events before
   shipping.

3. **Critical CSS pre-render.** Only feasible if we move to SSR
   (Cloudflare Workers, Vite SSR) or static pre-rendering at build
   time. Would unlock proper above-the-fold inlining (~3-5 kB inline,
   the rest deferred). Probably not worth the architectural change
   unless PSI is still flagging render-blocking CSS at that point.

4. **Delete legacy `/eho-logo.png` and `/adaxa-logo.jpg`.** Run the
   preview for ~24-48 hours with the `[smartr8 perf]` console-warn
   active. If no warnings surface and no external systems (email
   signatures, CRM templates) hot-link the originals, delete them
   from `public/` along with `src/lib/legacyAssetWarn.tsx` and its
   import in `App.tsx`. Single-commit cleanup.

---

### Round 2: render-blocking CSS + PSI URL normalization

**Non-blocking CSS.** Added a small Vite plugin (`nonBlockingCssPlugin`
in `vite.config.ts`) that rewrites the generated stylesheet link from

    <link rel="stylesheet" crossorigin href="/assets/index-*.css">

to

    <link rel="preload" as="style" crossorigin href="..."
          onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" crossorigin href="..."></noscript>

The browser starts the CSS download without blocking render. The
`<noscript>` fallback preserves blocking-stylesheet behavior for
JS-disabled crawlers. FOUC risk is minimal for this SPA: CSS (20 kB gz)
typically loads well before main.tsx (167 kB gz) finishes parsing, so
React mounts into already-styled DOM.

Critical-CSS inlining (beasties / vite-plugin-critical) was considered
and rejected: this is a client-rendered SPA whose initial body is just
`<div id="root">`, so static critical-CSS extraction has nothing to
analyze. The preload-swap pattern gives most of the win without the
complexity of pre-rendering.

**Removed static canonical from index.html.** PSI / Lighthouse on the
two v2 routes sometimes normalized the displayed URL back to the root
because they saw the initial-HTML `<link rel="canonical"
href="https://smartr8.com/">` before React mounted. `PageMeta` already
sets the correct per-route canonical after mount, so the static one was
both redundant and misleading. Removed; PageMeta is now the single
source of truth for canonical and robots meta.

---

### Round 1: site-wide performance fixes (all pages)

Targets: Performance 80+ on v1 mobile, v2 within 3 points of v1, LCP < 4s,
TBT < 200ms, CLS 0. PSI baseline before this batch (mobile, Slow 4G):
v1 quick 67, v2 quick 51, v1 instant-options 63, v2 instant-options 54.

**1. Optimized logos.** `/eho-logo.png` (1130x1209, 25 KB) and
`/adaxa-logo.jpg` (432x155, 7.3 KB) were served everywhere and displayed
at 15-32px tall.

- `public/eho-logo-optimized.png` (112x120, **4.2 KB**, 83% smaller)
- `public/adaxa-logo-optimized.jpg` (312x112, **5.6 KB**, 24% smaller)
- Originals retained at their old paths for any external references
  (email signatures, etc.). They are no longer referenced by the app.
- All three `<img>` references updated to point at the optimized files:
  `src/components/Header.tsx`, `src/components/Footer.tsx`,
  `src/components/FunnelLayout.tsx`. Every `<img>` now has explicit
  `width` and `height` attributes so the browser reserves space (CLS
  stays at 0). Header logo gets `fetchPriority="high"`; EHO footer
  logos get `loading="lazy"`.
- **If a vector source exists** for either logo, replacing the raster
  with `.svg` will eliminate even the optimized raster cost and look
  sharper on retina. The PNG/JPG path is documented under "What's
  needed from Mykoal" below.

**2. Self-hosted Inter (variable font, latin subset).** The previous
setup loaded Inter via Google Fonts in both `index.html` (link tag)
AND `src/index.css` (`@import url(...)`), forcing two render-blocking
cross-origin requests (~750ms combined).

- Added `public/fonts/inter-latin.woff2` (48 KB; covers weights
  400-700 as a variable font; latin subset only).
- `src/index.css`: replaced the Google `@import` with a single
  `@font-face` declaration with `font-weight: 400 700` range and
  `font-display: swap`.
- `index.html`: removed both `<link rel="preconnect">` tags (no
  longer needed) and the Google Fonts stylesheet link. Added
  `<link rel="preload" href="/fonts/inter-latin.woff2" as="font"
  type="font/woff2" crossorigin>`.

**3. Modern build target.** `vite.config.ts`: `build.target = "es2020"`.
Bundle audit confirms no `@babel/`, `core-js/`, `regeneratorRuntime`,
or `_classCallCheck` polyfills present in the production main bundle.

**4. Cloudflare Pages cache headers.** New `public/_headers` file
applies `Cache-Control: public, max-age=31536000, immutable` to
`/assets/*` (content-hashed Vite output) and `/fonts/*` (immutable
woff2). Logos and other static images get 30-day caching.

**5. Deferred analytics tags.** `index.html` rewrite moves GTM, GA,
and Meta Pixel inline scripts to the **end of `<body>`**, just below
the `<div id="root">` and before the deferred module script for
`/src/main.tsx`. The browser now parses the document head and starts
painting before executing any analytics IIFEs. All three still fire:

- GTM gtm.js still loads async via the inline loader.
- gtag/js external script keeps its `async` attribute.
- Meta Pixel still calls `fbq('init', ...)` and `fbq('track', 'PageView')`
  during initial parse (just later than before). `trackFbEvent` calls
  from React `useEffect` run after the inline IIFEs, so the fbq queue
  is set up before any event is fired.

**6. Eager-loaded v2 routes.** `src/App.tsx`: removed `React.lazy()`
+ `Suspense` for `HelocQuickV2` and `HelocInstantOptionsV2`. These are
ad-traffic landing pages: visitors arrive directly, so the lazy split
saved zero bytes on the warmup path while costing ~750-840ms of
critical-path latency. All other routes remain eager (as they were).
Bundle cost: +18 KB raw / +3.6 KB gz in the main `index.js`.

### Assets needed from Mykoal (handoff)

For the largest LCP wins, replace the raster logos with vector:

- **Adaxa logo (SVG):** ideal display sizes 56-156px wide. Save to
  `artifacts/smartr8/public/adaxa-logo.svg`. Then update Header.tsx
  to `src="/adaxa-logo.svg"`. SVG removes the 5.6 KB raster cost
  entirely and renders pixel-perfect at any size.
- **EHO logo (SVG):** ideal display size 15-32px square. Save to
  `artifacts/smartr8/public/eho-logo.svg`. Update Footer.tsx and
  FunnelLayout.tsx to `src="/eho-logo.svg"`. SVG also lets us drop
  the current `brightness-0 invert` filter hack used in Footer.tsx.

These are nice-to-have, not blockers. The optimized rasters already
deliver most of the byte savings.

---

### Added: HELOC v2 A/B test (Meta/Instagram campaign)

Two new pages built as the **treatment** arm of an A/B test against the
existing v1 funnel. Split is performed in Meta Ads Manager (different
ad sets point to v1 vs v2 URLs). No server-side split.

**Treatment URLs (v2)**
- `/heloc/quick-v2` → `artifacts/smartr8/src/pages/HelocQuickV2.tsx`
- `/heloc/instant-options-v2` → `artifacts/smartr8/src/pages/HelocInstantOptionsV2.tsx`

**Control URLs (v1, untouched)**
- `/heloc/quick`
- `/heloc/instant-options`

**Routing change**
- `artifacts/smartr8/src/App.tsx`: added two `<Route>` entries and
  `React.lazy()` imports for the v2 pages. v1 routes are unmodified.
  All v2 chunks are code-split out of the main bundle.

**Pixel events fired from v2**
- `ViewContent` on Page 1 mount → `{ funnel_version: "v2", variant: "B" }`
- `Lead` on Page 1 submit → `{ funnel_version: "v2", variant: "B" }`
- `ViewContent` on Page 2 mount → `{ funnel_version: "v2" }`
- `OptionSelected` (custom) on Option 1/2 click → `{ option: "flexible" | "fast", funnel_version: "v2" }`

V1 pages are **not** touched. Absence of `funnel_version` on a Lead
event implies v1 by inference. Filter in Meta Events Manager / your CRM
on `funnel_version` to split the test.

**Lead payload also carries**
- `Funnel-Source: "heloc-quick-v2"`
- `funnel_version: "v2"`
- `variant: "B"` (preserves the existing A/B funnel-bucket dimension)
- `consent_box_checked: "yes" | "no"` (TCPA audit trail; submit itself is the affirmative act)

---

### How to update copy / NMLS / state list

The compliance footer is centralized: edit `artifacts/smartr8/src/components/Footer.tsx`
once and both v1 and v2 pages update. This file already contains:

- Mykoal's name, title, NMLS #1912347
- Adaxa Home, LLC NMLS #2380533 and Scottsdale address
- Equal Housing Opportunity line
- Licensed states list (currently AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA)
- "Not a commitment to lend" disclaimer
- Privacy Policy, Terms of Use, Texas Compliance Notice, Loan Benefits
  Worksheet links

**The licensed states list also appears in the form `<Select>` on both
`/heloc/quick` and `/heloc/quick-v2`.** Per the v1-untouched rule for
this A/B test, the list is duplicated:

- v1: `artifacts/smartr8/src/pages/HelocQuick.tsx` (const `LICENSED_STATES`, around line 22)
- v2: `artifacts/smartr8/src/pages/HelocQuickV2.tsx` (const `LICENSED_STATES`, near the top)

When the test concludes, extract `LICENSED_STATES` to a shared module
(suggested: `src/config/compliance.ts`) and import from both the winning
page and `Footer.tsx`.

Copy for the v2 option cards lives inline in `HelocInstantOptionsV2.tsx`
in the constants `FLEXIBLE_BULLETS` and `FAST_BULLETS`, plus the JSX
below.

The TCPA consent label text lives inline in each form file. Updating
the disclosure language requires editing every form that has one. The
forms are listed in `git grep -l "consent_box_checked"`.

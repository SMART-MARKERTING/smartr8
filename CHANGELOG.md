# Changelog

## Unreleased

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

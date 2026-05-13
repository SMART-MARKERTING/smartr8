# SMARTR8 — Adaxa Home Lead Funnel

A static lead capture funnel for Mykoal DeShazo, VP & Senior Loan Officer at Adaxa Home, LLC. Single-page funnel with a 6-step multi-step modal, Formspree form submission, and three routes: /, /thank-you, /404.

## Run & Operate

- `pnpm --filter @workspace/smartr8 run dev` — run the frontend (port assigned by workflow)
- `pnpm --filter @workspace/smartr8 run build` — build static output to `artifacts/smartr8/dist/public/`
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (static export)
- Routing: wouter
- Styling: Tailwind CSS v4 + shadcn/ui
- Forms: react-hook-form + zod
- Lead submission: Formspree (https://formspree.io/f/meennekb)
- No backend, no database

## Where things live

- `artifacts/smartr8/src/pages/Home.tsx` — main landing page
- `artifacts/smartr8/src/pages/ThankYou.tsx` — thank-you page (noindex)
- `artifacts/smartr8/src/pages/not-found.tsx` — 404 page
- `artifacts/smartr8/src/components/FunnelModal.tsx` — 6-step lead capture funnel
- `artifacts/smartr8/src/components/Header.tsx` — shared header
- `artifacts/smartr8/src/components/Footer.tsx` — shared footer
- `artifacts/smartr8/src/App.tsx` — wouter router
- `artifacts/smartr8/src/index.css` — theme variables (Inter font, Adaxa brand colors)
- `artifacts/smartr8/public/adaxa-logo.jpg` — Adaxa Home logo

## Architecture decisions

- Static-only React + Vite instead of Next.js — same deployment target (Cloudflare Pages static), simpler monorepo integration
- Formspree for lead submission — no backend needed, free tier handles the volume
- Wouter for routing — lightweight, matches the existing monorepo pattern
- 6-step funnel built as a modal overlay — keeps everything on one URL for analytics

## Product

A trust-first mortgage lead funnel. Homeowners land, choose their goal (cash-out, lower payment, explore options), complete 6 quick questions about their property, and submit contact info. Mykoal gets email notifications via Formspree and follows up personally.

## User preferences

- Owner: Mykoal DeShazo, VP | Senior Loan Officer, Adaxa Home LLC
- NMLS #1912347 (personal), NMLS #2380533 (company)
- Phone: (949) 418-5486, Email: mykoal@adaxahome.com
- Brand: clean black + white + light gray, Inter font, professional + trust-focused
- Formspree endpoint: https://formspree.io/f/meennekb
- Cal.com booking URL: https://cal.com/mykoal-deshazo/consult (used in HelocNextSteps.tsx; embed still pending on /thank-you)

## Gotchas

- Always add Google Fonts `@import url(...)` as the VERY FIRST line of index.css — PostCSS will fail silently if it appears after other imports
- The Vite build uses BASE_PATH env var from the workflow — don't hardcode "/" as base
- For Cloudflare Pages deployment, build command must install pnpm first: `npm install -g pnpm && pnpm install && pnpm --filter @workspace/smartr8 run build`
- Build output directory for Cloudflare: `artifacts/smartr8/dist/public`

## Pointers

- See `README.md` for full Cloudflare Pages deployment steps and Cal.com embed instructions
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

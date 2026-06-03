# Adaxa Quick Quote Tool — `quote.smartr8.com`

A single, self-contained static page (`public/index.html`). Everything is inline
(CSS, JS, base64 images); the only external dependencies are Google Fonts
(DM Sans) and jsPDF (cdnjs), both loaded over HTTPS at runtime. No build step,
no backend, no database.

This is deployed as its **own** Cloudflare Pages project, completely isolated
from the main `smartr8` site, so it carries zero risk to the lead funnel.

## Local preview

Just open `public/index.html` in a browser, or serve the folder:

```sh
npx serve artifacts/quote/public
```

## Deploy to `quote.smartr8.com` (one-time setup)

Either option below serves `public/` as the site root. Pick one.

### Option A — Git-connected Pages project (auto-deploys on push to `main`)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the `SMART-MARKERTING/smartr8` repo.
3. Settings:
   - **Project name:** `adaxa-quote` (or similar)
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `artifacts/quote/public`
4. Save & deploy. You'll get a `*.pages.dev` URL to verify.
5. Project → **Custom domains → Set up a domain →** `quote.smartr8.com`.
   Because `smartr8.com` is on Cloudflare DNS, the CNAME and SSL cert are
   created automatically.

### Option B — Direct upload via Wrangler (no Git connection)

```sh
npx wrangler pages deploy artifacts/quote/public --project-name=adaxa-quote
```

Then add the `quote.smartr8.com` custom domain as in Option A, step 5.

## Updating the tool

Replace `public/index.html` with the new export and push to `main`
(Option A) or re-run the `wrangler pages deploy` command (Option B).

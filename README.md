# SMARTR8 — Adaxa Home Lead Funnel

A static lead capture funnel for Mykoal DeShazo, Vice President & Senior Loan Officer at Adaxa Home, LLC.

## Development

```bash
pnpm --filter @workspace/smartr8 run dev
```

## Build

```bash
pnpm --filter @workspace/smartr8 run build
```

The output lands in `artifacts/smartr8/dist/public/`.

---

## Syncing to GitHub

The repo is connected to **https://github.com/mdeshazo/smartr8**.

### One-command push

```bash
bash scripts/push-github.sh
```

This script:
1. Reads `GITHUB_PAT` from the Replit Secrets tab
2. Authenticates and pushes `main` to GitHub
3. Always strips the token from the remote URL on exit (success or failure) so it is never left stored in `.git/config`

> Note: this is a manual one-command sync from Replit to GitHub. It is not automatic on every file save — run it after committing changes you want to push.

**First-time setup:** Make sure `GITHUB_PAT` is set in Replit → Secrets tab. It must be a classic GitHub Personal Access Token with `repo` scope.

### GitHub Actions

Every push to `main` on GitHub triggers `.github/workflows/sync.yml`, which runs a full build check (`pnpm --filter @workspace/smartr8 run build`) to confirm the site builds correctly. Results appear in the **Actions** tab of the GitHub repo.

---

## Deploying to Cloudflare Pages

### 1. Push to GitHub

```bash
bash scripts/push-github.sh
```

### 2. Connect GitHub repo to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages** → **Create a project** → **Connect to Git**.
2. Authorize Cloudflare and select `mdeshazo/smartr8`.
3. Click **Begin setup**.

### 3. Build settings

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | `npm install -g pnpm && pnpm install && pnpm --filter @workspace/smartr8 run build` |
| Build output directory | `artifacts/smartr8/dist/public` |
| Root directory | `/` (repo root) |

No environment variables need to be added in the Cloudflare Pages dashboard — `BASE_PATH` defaults to `/` automatically during the build.

> **SPA routing:** A `public/_redirects` file (`/* /index.html 200`) is already included so that direct links to `/thank-you` and any other route resolve correctly on Cloudflare's CDN.

Click **Save and Deploy**.

### 4. Add custom domain smartr8.com

1. After the first successful deploy, go to your Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `smartr8.com` and follow the DNS instructions.
3. Cloudflare will automatically provision an SSL certificate.

---

## Lead-capture pipeline (production)

Website lead capture: Worker validates form input (zod + Turnstile + honeypot + rate limit), writes to LeadMailbox synchronously, then via `ctx.waitUntil` upserts the contact to GHL with tags `['web lead', 'heloc']` plus `loan_type`, `property_state`, `tcpa_consent`, and `conversation_summary` custom fields, creates an opportunity in the Web Leads pipeline, and sends a Resend confirmation to the lead. The upsert triggers GHL's existing "Contact Created with web lead tag" workflow, which routes by loan-type tags, assigns by timezone, and handles all SMS and nurture downstream. The Worker does NOT send SMS directly. The Sendblue API is integrated only inside GHL's send_blue connector and is never called from this codebase.

D1 audit + KV dedup details:
- 10-minute dedup against `sha256(email|phone|funnel)` in `LEAD_DEDUP`
- audit row in `LEADS_DB.leads` with per-destination status columns (`leadmailbox_status`, `ghl_upsert_status`, `ghl_status` for opportunity, `resend_status`) and a `tcpa_consents` row when consent fields are present
- a companion Worker at `cloudflare-workers/retry-cron/` runs every 5 minutes and POSTs to `/api/cron/retry-failed`, which replays only failed destinations (max 5 attempts; rows hitting the cap are marked `dead_letter`)

## Required Pages env vars

Set these in **Cloudflare Pages → Settings → Environment variables** for both **Production** and **Preview**. Bindings (D1, KV) are declared in `artifacts/smartr8/wrangler.toml`.

| Name | Purpose |
|---|---|
| `SMARTR8_LEAD_CAPTURE_PROD` | GoHighLevel Private Integration Token (PIT labeled `smartr8-lead-capture-prod` in GHL) |
| `GHL_LOCATION_ID` | GoHighLevel location ID |
| `GHL_CF_LOAN_TYPE` | GHL custom field ID for "Loan Type" (use `scripts/fetch-ghl-ids.ts`) |
| `GHL_CF_PROPERTY_STATE` | GHL custom field ID for "Property State" |
| `GHL_CF_TCPA_CONSENT` | GHL custom field ID for "TCPA Consent" |
| `GHL_CF_CONVERSATION_SUMMARY` | GHL custom field ID for "Conversation Summary" |
| `GHL_PIPELINE_ID` | GHL pipeline ID for "Web Leads" |
| `GHL_PIPELINE_STAGE_NEW` | GHL stage ID for "New Lead" inside that pipeline |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side secret |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key (exposed to the browser) |
| `VITE_TCPA_CONSENT_VERSION` | Optional client-side override for the consent version (defaults to the value in `src/lib/tcpa.ts`) |
| `CRON_SECRET` | Shared secret between the companion retry Worker and `/api/cron/retry-failed` |
| `RESEND_API_KEY` | Resend API key (already in place; powers the confirmation email and worksheet PDFs) |
| `LEAD_INBOX_EMAIL` | Documented for clarity; not currently read by the Worker code |

Use `scripts/fetch-ghl-ids.ts` (run via `npx tsx`) to pull the four GHL ID values from the API and paste them straight into Cloudflare.

## GHL Private Integration Token — granted scopes

This token is labeled **`smartr8-lead-capture-prod`** inside GoHighLevel. The Cloudflare env var name (`SMARTR8_LEAD_CAPTURE_PROD`) intentionally matches the PIT label for audit traceability. Rotate the token annually, or immediately on suspected exposure.

Granted scopes:
- `contacts.write`
- `contacts.readonly`
- `opportunities.write`
- `opportunities.readonly`
- `locations/customFields.readonly`
- `locations.readonly`

## One-time setup (after first deploy)

Run these commands once after merging the lead-capture pipeline PR, before the first production deploy that depends on D1 + KV:

```bash
# from artifacts/smartr8/
wrangler d1 create smartr8-leads
# paste the returned database_id into wrangler.toml [[d1_databases]]

wrangler kv:namespace create LEAD_DEDUP
# paste the returned id into wrangler.toml [[kv_namespaces]]

wrangler d1 migrations apply smartr8-leads --remote
```

A convenience script that lists these in order lives at `scripts/setup-cloudflare.sh`.

Then deploy the companion retry Worker (only required once):

```bash
cd cloudflare-workers/retry-cron
wrangler secret put CRON_SECRET           # paste the same value you set in Pages env
wrangler secret put PAGES_BASE_URL        # https://smartr8.com
wrangler deploy
```

## Post-merge verification

After the first production deploy that depends on the pipeline:
- Submit a test lead on smartr8.com and confirm a row appears in the `leads` D1 table with `leadmailbox_status = 'sent'`, `ghl_upsert_status = 'sent'`, `ghl_status = 'sent'`, `resend_status = 'sent'`.
- Confirm the Resend confirmation arrives from `mykoal@mykoal.com`.
- Confirm the GHL contact appears with the `web lead` and `heloc` tags and the four custom fields populated.
- Confirm the GHL workflow fires the first SMS via send_blue within 1 to 3 minutes of submit.
- Hit `POST /api/cron/retry-failed` with the `X-Cron-Secret` header and confirm `{ ok: true, retried: 0 }` when there's nothing failed.

---

## Owner Info

- **Name:** Mykoal DeShazo
- **Title:** Vice President | Senior Loan Officer
- **Company:** Adaxa Home, LLC
- **NMLS:** #1912347 (personal) / #2380533 (company)
- **Phone:** (949) 418-5486
- **Email:** mykoal@adaxahome.com
- **Formspree endpoint:** https://formspree.io/f/meennekb

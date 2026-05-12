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

## Deploying to Cloudflare Pages

### 1. Push to GitHub from Replit

1. Open the **Git** panel in Replit (left sidebar → Git icon).
2. Stage all files, commit with a message like `Initial build`, and push.
3. If you haven't connected a GitHub repo yet, click **Connect to GitHub** and follow the prompts to create or link a repository.

### 2. Connect GitHub repo to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages** → **Create a project** → **Connect to Git**.
2. Authorize Cloudflare to access your GitHub account and select the repo.
3. Click **Begin setup**.

### 3. Build settings

| Setting | Value |
|---|---|
| Framework preset | **None** (or "React") |
| Build command | `npm install -g pnpm && pnpm install && pnpm --filter @workspace/smartr8 run build` |
| Build output directory | `artifacts/smartr8/dist/public` |
| Root directory | `/` (repo root) |

> **Note:** The site uses Vite (React) with static output — functionally identical to Next.js static export for Cloudflare Pages. No server-side rendering is used.

Click **Save and Deploy**.

### 4. Add custom domain smartr8.com

1. After the first successful deploy, go to your Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `smartr8.com` and follow the DNS instructions.
3. Cloudflare will automatically provision an SSL certificate.

### 5. Add the Cal.com booking embed on /thank-you

Open `artifacts/smartr8/src/pages/ThankYou.tsx` and find the `/* TODO: Replace with Cal.com embed script */` comment. Replace the placeholder div with your Cal.com embed snippet:

```tsx
{/* Cal.com embed */}
<div id="cal-booking">
  {/* Paste your Cal.com inline embed script here */}
  {/* Example: <Cal calLink="mykoal/30min" /> */}
</div>
```

Cal.com inline embeds can be found at: **Cal.com Dashboard → Apps → Embed → Inline Embed** → copy the snippet and paste it in place of the placeholder.

---

## Owner Info

- **Name:** Mykoal DeShazo
- **Title:** Vice President | Senior Loan Officer
- **Company:** Adaxa Home, LLC
- **NMLS:** #1912347 (personal) / #2380533 (company)
- **Phone:** (949) 418-5486
- **Email:** mykoal@adaxahome.com
- **Formspree endpoint:** https://formspree.io/f/meennekb

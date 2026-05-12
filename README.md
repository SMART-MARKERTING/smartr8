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

Click **Save and Deploy**.

### 4. Add custom domain smartr8.com

1. After the first successful deploy, go to your Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `smartr8.com` and follow the DNS instructions.
3. Cloudflare will automatically provision an SSL certificate.

---

## Owner Info

- **Name:** Mykoal DeShazo
- **Title:** Vice President | Senior Loan Officer
- **Company:** Adaxa Home, LLC
- **NMLS:** #1912347 (personal) / #2380533 (company)
- **Phone:** (949) 418-5486
- **Email:** mykoal@adaxahome.com
- **Formspree endpoint:** https://formspree.io/f/meennekb

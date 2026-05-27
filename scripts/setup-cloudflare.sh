#!/usr/bin/env bash
# One-time setup for the smartr8 lead-capture pipeline.
#
# After merging the lead-capture PR, run these in order. Each command
# prints an ID; paste the ID into artifacts/smartr8/wrangler.toml at the
# matching placeholder, then continue.

set -euo pipefail

cd "$(dirname "$0")/../artifacts/smartr8"

echo "==> 1. Create the D1 database (smartr8-leads)."
echo "    Paste database_id into wrangler.toml [[d1_databases]] block."
echo
echo "    wrangler d1 create smartr8-leads"
echo

echo "==> 2. Create the dedup KV namespace (LEAD_DEDUP)."
echo "    Paste id into wrangler.toml [[kv_namespaces]] block."
echo
echo "    wrangler kv:namespace create LEAD_DEDUP"
echo

echo "==> 3. Confirm the existing CF_KV_NAMESPACE ID is also present in"
echo "    wrangler.toml (look up the existing ID via the Cloudflare"
echo "    dashboard: Workers and Pages -> KV)."
echo

echo "==> 4. Apply the migration to D1."
echo "    wrangler d1 migrations apply smartr8-leads --remote"
echo

echo "==> 5. Set production env vars in Cloudflare Pages (dashboard ->"
echo "    Pages -> Settings -> Environment variables). See README.md."
echo

echo "==> 6. Deploy the companion retry Worker:"
echo "    cd cloudflare-workers/retry-cron"
echo "    wrangler secret put CRON_SECRET"
echo "    wrangler secret put PAGES_BASE_URL    # https://smartr8.com"
echo "    wrangler deploy"

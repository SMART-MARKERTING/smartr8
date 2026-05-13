#!/usr/bin/env bash
# Push the HELOC feature branch to GitHub and open a PR.
# Run this AFTER the Replit session ends (platform will have auto-committed).
#
# Requires GITHUB_PAT environment variable (classic PAT with repo + workflow scope).
# Usage: bash scripts/push-heloc-pr.sh

set -euo pipefail

REPO="mdeshazo/smartr8"
BRANCH="feature/heloc-landing-page"
BASE="main"
REPO_URL="https://github.com/${REPO}.git"

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "Error: GITHUB_PAT environment variable is not set."
  echo "Add it in Replit: Secrets tab → GITHUB_PAT → paste your classic PAT."
  exit 1
fi

AUTHED_URL="https://${GITHUB_PAT}@github.com/${REPO}.git"

cleanup() {
  git remote set-url origin "$REPO_URL" 2>/dev/null || true
}
trap cleanup EXIT

git remote set-url origin "$AUTHED_URL"

echo "Creating and pushing branch: ${BRANCH}..."
git push origin "main:refs/heads/${BRANCH}" --force

echo "Opening pull request..."
PR_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token ${GITHUB_PAT}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO}/pulls" \
  -d "{
    \"title\": \"feat: /heloc landing page with 4-step form, social proof, FAQ, and post-submit flow\",
    \"body\": \"## What's in this PR\\n\\n### New routes\\n- \`/heloc\` — full HELOC landing page (hero, why HELOC, 3 value cards, social proof, how it works, 4-step form, FAQ accordion, final CTA, compliance block)\\n- \`/heloc/next-steps\` — post-submit selector: Instant Options / Schedule / Call or Text\\n- \`/heloc/instant-options\` — two lender cards (Deep Haven Mortgage + Figure) with compliant copy\\n\\n### New files\\n- \`artifacts/smartr8/src/pages/Heloc.tsx\`\\n- \`artifacts/smartr8/src/pages/HelocNextSteps.tsx\`\\n- \`artifacts/smartr8/src/pages/HelocInstantOptions.tsx\`\\n- \`artifacts/smartr8/src/components/HelocForm.tsx\`\\n\\n### Changed files\\n- \`artifacts/smartr8/src/App.tsx\` — added 3 new wouter routes\\n\\n### Spec compliance\\n- Formspree \`meennekb\` — same endpoint as main funnel, \`_subject\` prefixed \\\"New HELOC lead\\\"\\n- Form redirects to \`/heloc/next-steps?name=FirstName\` after submit\\n- Soft credit check language throughout; no rate quotes, no guarantee language\\n- No em dashes, no emoji\\n- Sticky mobile CTA (hides when form section is in view)\\n- SEO: title, meta description, canonical, OG/Twitter, JSON-LD FinancialService schema\\n- Analytics placeholders commented \`/* ANALYTICS: */\`\\n- Real testimonials: Ethan W., Michelle F., Raymond L.\\n- Licensed states: AZ, CA, CO, FL, MI, MN, OR, PA, TX, VA, WA\\n- Closed volume: \$199M+\\n\\n### Remaining placeholders\\n- \`HelocNextSteps.tsx\`: replace \`CALENDAR_LINK_HERE\` with Cal.com booking URL\\n\\n### No new dependencies\\nAll components (accordion, checkbox, radio-group, select, progress, card, button, input, label) were already present in the workspace.\",
    \"head\": \"${BRANCH}\",
    \"base\": \"${BASE}\",
    \"draft\": false
  }")

PR_URL=$(echo "$PR_RESPONSE" | grep -o '"html_url": "[^"]*pulls/[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PR_URL" ]; then
  echo ""
  echo "PR opened: ${PR_URL}"
  echo ""
  echo "Cloudflare Pages will automatically build a preview for this PR."
  echo "Do NOT merge until you've reviewed the preview and confirmed everything looks right."
else
  echo ""
  echo "Branch pushed. PR creation may have failed — check GitHub or create manually:"
  echo "https://github.com/${REPO}/compare/${BRANCH}?expand=1"
  echo ""
  echo "Raw API response:"
  echo "$PR_RESPONSE"
fi

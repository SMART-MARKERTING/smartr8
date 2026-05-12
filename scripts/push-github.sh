#!/usr/bin/env bash
# Push current main branch to GitHub.
# Requires GITHUB_PAT environment variable (classic PAT with repo scope).
# Usage: bash scripts/push-github.sh

set -euo pipefail

REPO_URL="https://github.com/mdeshazo/smartr8.git"

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "Error: GITHUB_PAT environment variable is not set."
  echo "Add it in Replit: Secrets tab → GITHUB_PAT → paste your classic PAT."
  exit 1
fi

AUTHED_URL="https://${GITHUB_PAT}@github.com/mdeshazo/smartr8.git"

# Ensure origin remote exists and points to the right repo
if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$AUTHED_URL"
else
  git remote add origin "$AUTHED_URL"
fi

echo "Pushing main → GitHub..."
git push -u origin main

# Reset remote URL to unauthenticated form so the PAT isn't stored in .git/config
git remote set-url origin "$REPO_URL"

echo "Done. https://github.com/mdeshazo/smartr8"

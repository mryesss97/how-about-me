#!/usr/bin/env bash
#
# Verify the current branch was cut from the `develop` line, not from the
# production line (`main`). See docs/06-engineering/04-git-workflow.md §2.
#
# Why this matters: `develop` and `main` diverge between releases. A branch cut
# from the production line looks fine locally but cannot be rebased onto
# `develop` — the rebase replays every production commit and conflicts
# immediately. Catch it before any code is written.
#
# How it works: the branch's fork point from `develop` must be PAST the point
# where develop and main diverged. If the only shared history with develop is
# that divergence point, the branch came off the production line.
#
# Usage:  bash scripts/check-base-branch.sh      (or: pnpm git:check-base)
# Env:    PROD_BRANCH=main   production line to compare against
#         STALE_LIMIT=50     warn when the base is this many commits behind develop
# Exit:   0 = ok (or unverifiable/offline), 1 = wrong base

set -euo pipefail

REMOTE="${REMOTE:-origin}"
PROD_BRANCH="${PROD_BRANCH:-main}"
STALE_LIMIT="${STALE_LIMIT:-50}"

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_rst=$'\033[0m'
ok()   { printf '%s✓%s %s\n' "$c_grn" "$c_rst" "$1"; }
warn() { printf '%s!%s %s\n' "$c_ylw" "$c_rst" "$1"; }
err()  { printf '%s✗%s %s\n' "$c_red" "$c_rst" "$1"; }

if ! git fetch --quiet "$REMOTE" develop "$PROD_BRANCH" 2>/dev/null; then
  warn "Could not fetch ${REMOTE}/develop — skipping base check (offline, or develop does not exist yet)."
  exit 0
fi

DEV="$REMOTE/develop"
PROD="$REMOTE/$PROD_BRANCH"

BASE="$(git merge-base HEAD "$DEV")"
FORK="$(git merge-base "$DEV" "$PROD")"
BEHIND="$(git rev-list --count "${BASE}..${DEV}")"

# When develop has been fully merged into the production line the two have
# converged and the fork-point test cannot distinguish them — nothing to warn
# about.
if git merge-base --is-ancestor "$DEV" "$PROD" 2>/dev/null; then
  ok "develop and ${PROD_BRANCH} are converged — base check not applicable."
  [ "$BEHIND" -gt "$STALE_LIMIT" ] && warn "Base is ${BEHIND} commits behind ${DEV}; merge it in."
  exit 0
fi

if [ "$BASE" = "$FORK" ]; then
  err "WRONG BASE — this branch was cut from the ${PROD_BRANCH} line, not develop."
  err "  fork point : $(git rev-parse --short "$BASE")  (= the develop/${PROD_BRANCH} divergence)"
  err "  develop is : ${BEHIND} commits ahead of it"
  err ""
  err "  Fix before writing code"
  err "      git checkout -b <type>/<summary> ${DEV}"
  err "      git cherry-pick <sha>     # cherry-pick — NEVER rebase across the lines"
  exit 1
fi

ok "Base is on the develop line (fork point $(git rev-parse --short "$BASE"))."
if [ "$BEHIND" -gt "$STALE_LIMIT" ]; then
  warn "Base is ${BEHIND} commits behind ${DEV} — merge develop in before you go further."
fi
exit 0

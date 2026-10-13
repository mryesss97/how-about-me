#!/usr/bin/env bash
# The repo's checks run here, before the push leaves the machine: GitHub
# Actions does not fire on push/pull_request in this repo yet, so CI runs only
# by hand (docs/06-engineering/07-ci-cd.md). Ported from live-stream-admin.
#
#   1. gitleaks on the commits this push adds
#   2. shellcheck on scripts/*.sh
#   3. pnpm verify: prisma generate · format:check · lint · typecheck · unit
#      test · workflow script tests, one worktree at a time
#
# Called by .husky/pre-push with git's stdin. A missing gitleaks or shellcheck
# only warns: `brew install gitleaks shellcheck`.
# Skip once with `git push --no-verify` — never past a red check.
set -euo pipefail

zero=0000000000000000000000000000000000000000
pushed=()
while read -r _local_ref local_sha remote_ref _remote_sha; do
  # A branch deletion pushes no code.
  [ "$local_sha" = "$zero" ] && continue
  # pr-assets holds PR screenshots only (scripts/pr-done.mjs), no code to verify.
  [ "$remote_ref" = "refs/heads/pr-assets" ] && continue
  pushed+=("$local_sha")
done
[ "${#pushed[@]}" -gt 0 ] || exit 0

echo "pre-push: gitleaks · shellcheck · pnpm verify. Bỏ qua: git push --no-verify"

if command -v gitleaks >/dev/null 2>&1; then
  # Only the commits no remote branch has yet: what this push adds.
  for sha in "${pushed[@]}"; do
    if ! gitleaks git --no-banner --redact --log-level warn \
      --log-opts="$sha --not --remotes=origin" .; then
      echo "pre-push: gitleaks thấy secret trong commit sắp push. Gỡ secret khỏi lịch sử rồi push lại."
      exit 1
    fi
  done
  echo "gitleaks: pass"
else
  echo "pre-push: ! chưa cài gitleaks, bỏ qua secret scan (brew install gitleaks)"
fi

if command -v shellcheck >/dev/null 2>&1; then
  # SC1091: sourced lib is resolved at runtime, not by shellcheck's static pass.
  shellcheck --severity=error --exclude=SC1091 scripts/*.sh scripts/lib/*.sh
  echo "shellcheck: pass"
else
  echo "pre-push: ! chưa cài shellcheck, bỏ qua (brew install shellcheck)"
fi

# `issue:ship` runs verify before it pushes and leaves a stamp for the commit
# (scripts/lib/verify-stamp.sh). The pushed sha must be HEAD, the tree clean and
# the stamp for that sha, else verify runs in full here. This keeps the hook to
# seconds, so GitHub does not close the idle SSH connection.
# shellcheck source-path=SCRIPTDIR source=lib/verify-stamp.sh
. "$(git rev-parse --show-toplevel)/scripts/lib/verify-stamp.sh"
reuse=1
for sha in "${pushed[@]}"; do
  verify_stamp_valid "$sha" || reuse=0
done
if [ "$reuse" = 1 ]; then
  echo "verify: pass (dùng lại kết quả của ${pushed[0]:0:8}, đã chạy trước khi push)"
  exit 0
fi

bash scripts/verify-quiet.sh

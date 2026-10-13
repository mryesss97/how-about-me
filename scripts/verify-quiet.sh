#!/usr/bin/env bash
# Run `pnpm verify` and keep its log out of an agent's context.
# Ported from live-stream-admin.
#
#   bash scripts/verify-quiet.sh          # or: pnpm verify:quiet
#
# A pass prints one line. A failure prints the last VERIFY_TAIL lines (50 by
# default) and the path of the full log, so the agent reads more only when
# the tail is not enough.
#
# One verify at a time across every worktree: the run waits for a shared lock
# in the common git dir (scripts/lib/verify-lock.sh) and frees it on exit,
# Ctrl-C included.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=lib/verify-lock.sh
. "$here/lib/verify-lock.sh"
# shellcheck source-path=SCRIPTDIR source=lib/verify-stamp.sh
. "$here/lib/verify-stamp.sh"

log="$(git rev-parse --path-format=absolute --git-dir)/verify.log"
lock="$(git rev-parse --path-format=absolute --git-common-dir)/verify.lock"
lines="${VERIFY_TAIL:-50}"

hold_verify_lock_until_exit "$lock"
clear_verify_stamp

if pnpm verify >"$log" 2>&1; then
  # The pre-push hook reuses this pass for the same commit.
  write_verify_stamp
  echo "verify: pass (log: $log)"
  exit 0
fi

echo "verify: FAIL — ${lines} dòng cuối. Log đầy đủ: $log"
tail -n "$lines" "$log"
exit 1

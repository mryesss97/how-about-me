#!/usr/bin/env bash
# Run `pnpm test:int` and keep its log out of an agent's context (#189).
#
#   bash scripts/test-int-quiet.sh        # or: pnpm test:int:quiet
#
# A pass prints one line. A failure prints the last TEST_INT_TAIL lines (50 by
# default) and the log path. Each failure is also kept as
# test-int-<UTC>.log (last 5) so a flaky run's log survives a passing rerun.
# Logs live in this worktree's git dir; each worktree has its own test DB
# (apps/api/test/helpers/test-db.ts), so no cross-worktree lock is needed.
set -uo pipefail

dir="$(git rev-parse --path-format=absolute --git-dir)"
log="$dir/test-int.log"
lines="${TEST_INT_TAIL:-50}"
keep=5

if pnpm test:int >"$log" 2>&1; then
  echo "test:int: pass (log: $log)"
  exit 0
fi

kept="$dir/test-int-$(date -u +%Y%m%dT%H%M%SZ).log"
cp "$log" "$kept"
# Keep only the newest $keep failure logs (names sort by UTC timestamp).
old="$(find "$dir" -maxdepth 1 -name 'test-int-*.log' | sort -r | tail -n +$((keep + 1)))"
if [ -n "$old" ]; then
  while IFS= read -r f; do rm -f -- "$f"; done <<<"$old"
fi

echo "test:int: FAIL — ${lines} dòng cuối. Log đầy đủ: $log (bản giữ lại: $kept)"
tail -n "$lines" "$log"
exit 1

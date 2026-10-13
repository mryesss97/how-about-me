# shellcheck shell=bash
# Shared lock so only one `pnpm verify` runs at a time across every
# worktree of this repo. Sourced by scripts/verify-quiet.sh.
#
# Why: several agents push from parallel worktrees. Each `vitest run` starts a
# worker per core, so three at once push the load average past 100 and
# CPU-bound tests hit their timeout. Raising the timeout hides that.
#
# The lock is a symlink whose target is the holder's PID. `ln -s` fails when
# the link exists, so taking it is atomic, and the PID travels with it.
# A lock whose holder no longer runs (kill -9, crash, reboot) is reclaimed.

# Poll interval in seconds while another worktree holds the lock.
VERIFY_LOCK_POLL="${VERIFY_LOCK_POLL:-2}"
VERIFY_LOCK_PATH=""

# True when the PID still runs a verify. Checking the command, not only the
# PID, keeps a PID reused after a reboot from holding the lock forever.
verify_lock_holder_alive() {
  local pid="$1" command
  [ -n "$pid" ] || return 1
  command="$(ps -p "$pid" -o command= 2>/dev/null)" || return 1
  case "$command" in
    *verify*) return 0 ;;
    *) return 1 ;;
  esac
}

# acquire_verify_lock <path> — block until this process holds the lock.
acquire_verify_lock() {
  local path="$1" holder waited=0
  while ! ln -s "$$" "$path" 2>/dev/null; do
    holder="$(readlink "$path" 2>/dev/null || true)"
    if [ -n "$holder" ] && ! verify_lock_holder_alive "$holder"; then
      # Re-read before removing: another waiter may have reclaimed it already.
      if [ "$(readlink "$path" 2>/dev/null || true)" = "$holder" ]; then
        rm -f "$path"
      fi
      continue
    fi
    if [ "$waited" -eq 0 ]; then
      echo "verify: đang chờ verify của worktree khác… (PID ${holder:-?}). Khoá kẹt thì xoá: rm $path"
      waited=1
    fi
    sleep "$VERIFY_LOCK_POLL"
  done
  VERIFY_LOCK_PATH="$path"
}

# Release only a lock this process holds.
release_verify_lock() {
  if [ -n "$VERIFY_LOCK_PATH" ] &&
    [ "$(readlink "$VERIFY_LOCK_PATH" 2>/dev/null || true)" = "$$" ]; then
    rm -f "$VERIFY_LOCK_PATH"
  fi
  VERIFY_LOCK_PATH=""
}

# hold_verify_lock_until_exit <path> — take the lock and free it when the
# script ends: normal exit, failure, Ctrl-C or kill (not kill -9; the next
# run reclaims that one).
hold_verify_lock_until_exit() {
  trap release_verify_lock EXIT
  # Exit on a signal so the EXIT trap runs.
  trap 'exit 130' INT
  trap 'exit 143' TERM
  acquire_verify_lock "$1"
}

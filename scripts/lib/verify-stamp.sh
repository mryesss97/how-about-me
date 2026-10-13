# shellcheck shell=bash
# Remembers that `pnpm verify` passed for one exact commit, so the pre-push
# hook does not run it a second time after `issue:ship` already did.
#
# Why: `git push` opens its SSH connection BEFORE the hook runs. A verify of
# several minutes on a loaded machine leaves that connection idle, and GitHub
# closes it ("Connection to github.com closed by remote host"). Running verify
# before the push and letting the hook reuse the result keeps the hook short.
#
# The stamp holds the HEAD sha verify passed on. It counts only when the
# pushed sha is HEAD and the working tree is clean, so verify has checked
# exactly the code being pushed. Any other sha, a dirty tree, or no stamp
# means the hook runs verify in full. gitleaks and shellcheck never read the
# stamp: the hook always runs them.

verify_stamp_path() {
  echo "$(git rev-parse --path-format=absolute --git-dir)/verify-pass.stamp"
}

# Forget the stamp. Called before every verify run, so a failed run cannot
# leave an older pass behind.
clear_verify_stamp() {
  rm -f "$(verify_stamp_path)"
}

# Record a pass for HEAD. Does nothing on a dirty tree: the result would
# describe code that no commit holds.
write_verify_stamp() {
  [ -z "$(git status --porcelain)" ] || return 0
  git rev-parse HEAD >"$(verify_stamp_path)"
}

# True when verify passed on <sha>, <sha> is HEAD, and the tree is clean.
verify_stamp_valid() {
  local sha="$1" stamp
  stamp="$(verify_stamp_path)"
  [ -f "$stamp" ] || return 1
  [ "$(cat "$stamp")" = "$sha" ] || return 1
  [ "$(git rev-parse HEAD)" = "$sha" ] || return 1
  [ -z "$(git status --porcelain)" ]
}

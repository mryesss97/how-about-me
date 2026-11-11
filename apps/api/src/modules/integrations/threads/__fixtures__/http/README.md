# Threads HTTP fixtures (T-039)

Anonymised: no real token, user id, username or `fbtrace_id`. Shapes from the live POC on 2026-11-11
(docs/05-operations/01-poc-threads-api.md §5) unless marked "synthetic" (built from Meta Graph API docs).

| File                           | Source                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| `search-page-1.json`           | recorded shape (`keyword_search` 200), ids/usernames/cursors replaced |
| `search-page-last.json`        | recorded shape, `paging.next` removed (last page)                     |
| `search-empty.json`            | synthetic                                                             |
| `me.json`                      | recorded shape (`/me?fields=id,username`)                             |
| `debug-token.json`             | recorded shape (`/debug_token`), timestamps replaced                  |
| `debug-token-invalid.json`     | synthetic                                                             |
| `error-permission-code10.json` | recorded verbatim (missing `threads_keyword_search`)                  |
| `error-oauth-190.json`         | synthetic (Graph expired token)                                       |
| `error-rate-limit-code4.json`  | synthetic (Graph app rate limit)                                      |
| `error-bad-request-100.json`   | synthetic (Graph invalid parameter)                                   |
| `error-5xx.json`               | synthetic (Graph transient error)                                     |
| `malformed.txt`                | synthetic (truncated JSON)                                            |

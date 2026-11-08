# 10 · Product Decisions (Decision Log)

| Field   | Value                                                                                                                                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Living document. Decisions by the acting PO (Claude) under the owner mandate of 2026-11-08; the owner reviews and may overturn any entry.                                                                                                            |
| Related | [04-functional-requirements.md](04-functional-requirements.md) FR-177, FR-197…FR-199, FR-202, FR-210…FR-257 · [09-ux-specification.md](09-ux-specification.md) §3.9–§3.15 · [../../design/figma/TRACKING.md](../../design/figma/TRACKING.md) J10–J17 |

One row per decision. A decision is never edited after the fact; a later decision supersedes it and says so.

## D-001 · MVP+1 scope (2026-11-08)

**Context.** v0.1.0 ships every P0/P1 screen (Figma J0–J9). The owner asked the PO to check the full flow, research what is missing and decide.

**Inputs.**

1. Gap analysis of the docs and backlog (#429): 10 promised-but-unbuilt items, 9 journey holes, 3 phone gaps.
2. Benchmark of Brandwatch, Talkwalker, Sprout Social, Meltwater, Brand24, Mention, Sprinklr and Vietnamese agencies (YouNet, Buzzmetrics). Every vendor sells real-time alerts, scheduled digests and saved views; Sprout and Sprinklr add case assignment with SLA for customer care.
3. Threads API limits: keyword search needs `threads_keyword_search`, budget 2 200 queries / user / 24 h, no firehose; @mentions need `threads_manage_mentions` + advanced access; replying needs `threads_content_publish` and is limited to recently found posts.

**Decision.** MVP+1 (milestone M7) builds, in this order:

| #   | Feature                                                                                                                  | Why                                                                           | FR             |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------- |
| 1   | First-run setup for an empty project (checklist + correct empty states)                                                  | A new project today dead-ends on "mở rộng khoảng thời gian"                   | FR-210…FR-211  |
| 2   | Access: accept invite → set password, forgot password, magic link, invite status + resend                                | Invited staff cannot get in without engineer help                             | FR-212…FR-215  |
| 3   | Faster review: reviewed filter in Mentions, one-tap verdict for "Chưa chắc", unmark                                      | Queue of 90 items needs a dialog per item today                               | FR-197…FR-199  |
| 4   | Alerts: rules (volume spike, negative share, severe safety, system health) → in-app alert centre + email, Slack, webhook | Problems only show to people who are logged in; every vendor has this         | FR-220…FR-227  |
| 5   | Scheduled digest (daily / weekly email, KPIs + top negative + AI summary)                                                | Leads read results without opening the app (vision §3.3 time-to-insight)      | FR-230…FR-233  |
| 6   | Saved views (personal or shared) on Overview and Mentions                                                                | Recurring questions in one click; base for digest and alerts scope            | FR-240…FR-242  |
| 7   | Cases for customer care: create from a mention, assignee, status, notes, SLA, "Việc của tôi"                             | CS supervisor persona (P3) has no workflow today                              | FR-250…FR-257  |
| 8   | Small ops fixes: analyzer budget shown in System Status; audit log filter "Hệ thống"                                     | Dead end when analysis pauses for budget; scheduler actions cannot be audited | FR-177, FR-202 |

**Deferred (not in M7).** Competitor share of voice / multi-project comparison (needs project creation and doubles search budget); reply or hide from the tool (permissions + 24 h quota); author/influencer insights (Profile Discovery needs app review, 1 000 lookups / 24 h); async exports > 10 000 rows; retention UI; custom taxonomy; X and other platforms; slim tablet sidebar.

**Owner inputs this creates.** Email sender (SMTP or provider) and Slack app for alerts/digest (IN-8); Telegram/Zalo stays out until the owner asks; Meta advanced access for @mentions (IN-1, already open).

## D-002 · One-tap verdict for "Chưa chắc" (2026-11-08)

UX §3.8 left this open (#390, "needs owner decision"). Decision: build it. An uncertain item in the review queue and in the mention detail shows two buttons, "Liên quan" and "Không liên quan". A tap creates a normal relevance override (FR-191) with the reason "Xác nhận nhanh từ hàng chờ" and marks the item reviewed (FR-195). It is undoable from the toast for 10 s (revokes the override, BR-043). Only `admin` and `analyst`.

## D-003 · Unmark reviewed (2026-11-08)

Supersedes "no Unmark in v1" (UX §3.8). A reviewed item shows "Bỏ đánh dấu" in the drawer and in the bulk bar of "Hiện mục đã xem lại"; it returns to the queue and the audit log records `review.unmarked`. Same roles as marking.

## D-004 · Alert channels (2026-11-08)

In-app alert centre is always on. External channels in M7: email, Slack (incoming webhook URL) and generic webhook (JSON POST, HMAC-signed). Webhook and Slack URLs are secrets: encrypted like provider tokens (ADR-0012), shown masked, never logged. Telegram and Zalo are not built.

## D-005 · Cases are not a helpdesk (2026-11-08)

A case links one or more mentions to an owner and a status (`Mới → Đang xử lý → Chờ phản hồi → Đã xong`, plus `Bỏ qua`). Notes are internal. No reply from the tool (Threads limits), no customer identity beyond the Threads handle. SLA is per priority, set by admin (defaults: Cao 4 h, Thường 24 h, Thấp 72 h), counted in wall-clock hours in the project timezone.

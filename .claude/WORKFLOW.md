# Subagent Workflow — Implementation Pipeline

> Workflow cho **task implementation** (feature, fix, refactor). Port từ `live-stream-admin` ngày 2026-10-13 (repo đó lấy từ 1zone-seatmap).
>
> Không port: script Jira/Confluence (`jira.sh`, `confluence.sh`, `atlassian-*`) và dòng `Refs: PROD-XXXX`, agent `docs-writer` cùng `DOCS-WORKFLOW.md`, `docs-bundle`, `drawio-export`, `sync-deploy-branch`. Repo này lấy việc từ GitHub issue và viết docs tay trong `docs/`.

Một loạt yêu cầu chạy theo vòng lặp issue ở [docs/06-engineering/04-git-workflow.md §8](../docs/06-engineering/04-git-workflow.md#8-issue-loop-agent): mỗi yêu cầu một ticket, mỗi ticket một worktree và một PR, merge rồi làm ticket tiếp. Pipeline dưới đây chạy bên trong một ticket.

Chủ dự án chốt vòng lặp của live-stream-admin ngày 2026-10-13. Agent làm theo cho mọi loạt yêu cầu, không cần nhắc lại:

- Merge khi xanh: push đã qua hook `pre-push` thì `pnpm issue:finish <PR>`.
- Ticket tiếp theo cắt từ `develop` mới, chỉ sau khi PR trước đã merge. Không đổi branch trong checkout chính.
- Ticket đụng cùng file chạy lần lượt. Khu vực khác nhau chạy song song, giữ khoảng 4 agent.
- Ticket chủ dự án ghi "pending" thì giữ nguyên. Câu hỏi mở chưa có trả lời: làm theo đề xuất đã viết, ghi quyết định kèm ngày vào comment của ticket.

**Ticket** là số GitHub issue (`45`) hoặc task id của backlog (`T-049`). Task id đổi sang số issue qua `docs/03-delivery/issue-map.json`. Mọi lệnh `issue:*` và `agent` nhận cả hai dạng.

Bốn nguyên tắc:

1. Script chọn model theo việc. Agent không tự chọn model.
2. Script làm mọi bước cố định. Agent chỉ làm phần cần suy nghĩ.
3. Lệnh và hook chỉ trả 50 dòng lỗi cuối.
4. Mỗi lượt chạy agent ghi chi phí theo ticket.

## Pipeline (chạy liên tục)

Chủ dự án chốt ngày 2026-10-13 (#140): pipeline chạy liên tục từ `issue:start` tới `issue:finish`, **không dừng chờ review plan hay review QA**. Anh xem plan, báo cáo QA và PR sau khi merge, qua các file `.claude/runs/*` và mô tả PR.

```
[issue:start] → [triage] → [plan] → [code → issue:tidy → review] → PASS → commit → [issue:ship] → [issue:finish] → ticket tiếp
   script        Haiku      Opus      Opus low   script   Haiku/Opus            script           script
                                                              ↓
                                                    FAIL → [code: sửa blocker] → review (tối đa 2 vòng)
```

- Câu hỏi mở trong plan: làm theo đề xuất của researcher, ghi quyết định kèm ngày vào comment của issue, rồi code tiếp.
- QA FAIL: `pnpm agent code <ticket>` đọc `qa-<ticket>.md` và sửa blocker, rồi `pnpm agent review <ticket>` chạy lại. Sau 2 vòng sửa mà QA vẫn FAIL thì dừng và báo anh.
- QA PASS mà còn warning: sửa warning rẻ ngay; warning lớn ghi vào mô tả PR hoặc tạo issue follow-up.

### Chạy song song

Ticket không bị chặn thì chạy song song, mỗi ticket một agent và một worktree, giữ khoảng 4 ticket cùng lúc. Ticket không bị chặn khi:

- Mọi ticket trong `depends_on` (backlog) đã merge vào `develop`.
- Không có label `needs: owner-input`, và chủ dự án không ghi "pending".
- Không đụng cùng file hay cùng module với ticket đang chạy. Ticket cùng khu vực chạy lần lượt.

Ticket nào merge xong thì lấy ticket không bị chặn tiếp theo theo milestone rồi priority. Ticket chạy song song mà merge sau thì cập nhật branch với `develop` trước `issue:ship` nếu PR báo conflict.

### Khi nào dừng hỏi anh

Chỉ dừng khi:

1. Ticket cần input của chủ dự án (`needs: owner-input`, secret, tài khoản, quyết định sản phẩm).
2. Plan cần đổi contract API hay data model mà docs chưa chốt và không có đề xuất an toàn.
3. QA vẫn FAIL sau 2 vòng sửa.
4. `verify` hoặc CI đỏ vì lỗi không thuộc ticket.

Ngoài các trường hợp trên, làm tiếp và báo kết quả theo lô.

---

## Bước 0 — Nguồn nghiệp vụ

`docs/` là source of truth. Researcher đọc issue `[T-###]` và mọi doc issue link tới (FR, BR, metric, taxonomy, UX, kiến trúc) trước khi lập plan. Không đọc được thì nói thẳng. **Không đoán nội dung ticket.**

---

## Chọn model theo việc

`pnpm agent` chọn model bằng `--model` và `--effort` của `claude -p`. Bảng chọn nằm trong `pickModel` ở [`scripts/agent.mjs`](../scripts/agent.mjs).

| Stage    | Agent        | Model                       | Effort | Khi nào                                     |
| -------- | ------------ | --------------------------- | ------ | ------------------------------------------- |
| `triage` | —            | `claude-haiku-4-5-20251001` | —      | Mọi ticket mới                              |
| `plan`   | `researcher` | `claude-opus-5-5`           | `low`  | Ticket thường                               |
| `plan`   | `researcher` | `claude-opus-5-5`           | `high` | Triage ghi `"hard": true`, hoặc có `--hard` |
| `code`   | `coder`      | `claude-opus-5-5`           | `low`  | Mọi ticket                                  |
| `review` | `qa-tester`  | `claude-haiku-4-5-20251001` | —      | Diff so với `origin/develop` ≤ 200 dòng     |
| `review` | `qa-tester`  | `claude-opus-5-5`           | `low`  | Diff > 200 dòng                             |

- Script dùng model ID đầy đủ, không dùng alias. Alias có thể trỏ sang model khác (trên CLI 2.1.210, `haiku` chạy `claude-sonnet-5`). Sổ chi phí ghi model đã chạy thật (`ran`).
- `claude-opus-5-5` cần CLI ≥ 2.1.280. CLI cũ hơn thì script dừng trước khi gọi API. Chạy `claude update`.
- Diff không tính `pnpm-lock.yaml`.
- Triage ghi `hard: true` khi plan cần quyết định thiết kế, contract API hay data model mà docs chưa chốt, hoặc đụng nhiều workspace.
- Script tắt MCP server và skill (`--strict-mcp-config`, `--disable-slash-commands`). Không stage nào cần chúng. `CLAUDE.md` và file agent vẫn nạp.
- Stage `review` không ghi file. Haiku chạy `--permission-mode auto` không ghi được vào `.claude/`. Agent trả báo cáo `# Báo cáo QA: ...` ở tin nhắn cuối, script lưu `.claude/runs/qa-<ticket>.md`. Stage không để lại báo cáo thì script exit 1.
- Effort `high` chỉ dùng cho plan của ticket khó. Bước code luôn dùng `low`.
- Triage chọn `area` từ label `area: *` của repo.

Trong session tương tác (`@researcher`, `@coder`, `@qa-tester`), subagent dùng model khai báo trong frontmatter file agent: `researcher` và `coder` chạy `claude-opus-5-5` effort `low`, `qa-tester` chạy `claude-haiku-4-5-20251001`. `@qa-tester` luôn chạy Haiku. Review diff lớn bằng `pnpm agent review <ticket>`. Test `interactive agents declare the model of their stage` giữ frontmatter khớp `pickModel`. Script không đo chi phí của session tương tác.

## Script làm bước cố định

| Bước                                                     | Lệnh                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| Tạo branch và worktree, chép file `.env`, `pnpm install` | `pnpm issue:start <ticket> <type> <mô tả ≤ 5 từ>`                     |
| Prettier và `eslint --fix` các file branch đã đổi        | `pnpm issue:tidy`                                                     |
| Chạy check, chỉ in lỗi                                   | `pnpm verify:quiet`                                                   |
| Chụp screenshot trước và sau                             | `pnpm issue:shot <before\|after> <name> --url /<route>`               |
| Kiểm tra branch, title, target, issue trước khi mở PR    | `pnpm pr:check --base develop --title "<subject>" --body-file <file>` |
| Verify, push, đẩy screenshot, tạo PR                     | `pnpm issue:ship --title "<subject>" --body-file <file>`              |
| Squash-merge, đóng issue, xoá branch, gỡ worktree        | `pnpm issue:finish <PR>`                                              |

Agent vẫn làm việc cần suy nghĩ: đọc ticket, viết plan, viết code, viết commit message, viết mô tả PR.

- `type` là một trong: `feature`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `spike`. Branch: `<type>/<issue>-<slug>`.
- Worktree nằm cạnh checkout chính: `../how-about-me-<issue>`.
- `issue:start` chép `.env`, `apps/api/.env`, `apps/web/.env.local`, `.mcp.json` từ checkout chính nếu có. Git không theo dõi các file này.
- `issue:start` chỉ cắt branch từ `origin/develop`. `release/*` và `hotfix/*` làm tay theo git workflow §2.
- `issue:ship` dừng nếu còn thay đổi chưa commit, hoặc branch là `develop`/`main`.
- Mô tả PR theo [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md), có `Closes #N`. `issue:ship` thay mục `## Definition of Done` của template bằng mục đã kiểm, và thêm `## Chi phí agent`.
- `pr:create` từ chối mô tả thiếu mục `## Definition of Done` (trừ `release/*`). Mở PR tay thì điền mục đó trong template.

## Definition of Done

Đầy đủ ở [docs/03-delivery/05-definition-of-ready-done.md](../docs/03-delivery/05-definition-of-ready-done.md). Phần script kiểm:

1. `pnpm verify` pass: prisma generate · format:check · lint · typecheck · unit test · test script workflow. Hook `pre-push` chạy nó (cùng gitleaks, shellcheck), vì GitHub Actions chưa tự chạy trên push/PR ở repo này.
2. E2E pass khi root có script `test:e2e`. Hiện chưa có, `issue:ship` ghi rõ.
3. PR đổi UI có screenshot trước và sau. `issue:ship` đẩy ảnh lên nhánh orphan `pr-assets` và ghi bảng ảnh vào mục Definition of Done của mô tả PR.

Screenshot:

- Chụp ảnh "trước" ngay sau `issue:start`, trước khi sửa code. Chụp ảnh "sau" khi QA pass. Dev server: `pnpm dev` (web cổng `3000`, API cổng `4000`), hoặc cấu hình `web`/`api` trong [`.claude/launch.json`](launch.json).
- `--url /<route>` chạy trên `http://localhost:3000`. Worktree chạy web ở cổng khác thì set `SHOT_BASE_URL=http://localhost:<cổng>`, hoặc truyền URL đầy đủ.
- Ảnh nằm ở `.claude/runs/shots/` (gitignored), tên `before-<name>.png` và `after-<name>.png`. `issue:ship` cần đủ cặp, rồi xoá thư mục sau khi tạo PR.
- File "UI" là mọi file trong `apps/web/src`, trừ test (`*.test.*`, `*.spec.*`), `__tests__`, `__mocks__` và `.md`. Branch không đổi file nào như vậy thì không cần ảnh; mục Definition of Done ghi lý do.
- Branch đổi file UI nhưng giao diện không đổi thật (vd. chỉ đổi type): `pnpm issue:ship ... --no-shots "<lý do>"`.
- Không xoá nhánh `pr-assets`: PR đã merge link ảnh tới đó. Hook `pre-push` bỏ qua nhánh này (chỉ có ảnh, không có code).
- Script chụp bằng Playwright mà `apps/web` đã cài cho e2e: Chrome ở `CHROME_PATH`, rồi Chromium của Playwright, rồi Google Chrome của máy. Thiếu cả ba thì chạy `pnpm --filter @how-about-me/web exec playwright install chromium`.

| Cờ của `issue:shot`   | Tác dụng                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `--url <url\|/path>`  | Trang cần chụp. Bắt buộc, trừ khi dùng `--file`                                           |
| `--file <png>`        | Lưu một ảnh đã chụp bằng cách khác. Không đi cùng cờ nào khác                             |
| `--size 390x844`      | Đổi viewport. Mặc định `1366x768`                                                         |
| `--timeout <ms>`      | Giới hạn cho việc mở trang và cho từng bước. Mặc định 30000, khoảng 1000–300000           |
| `--wait-text "<chữ>"` | Chờ chữ hiện và nhìn thấy được. Dùng cho màn tải dữ liệu sau khi mở                       |
| `--click "<nhãn>"`    | Bấm theo thứ tự ưu tiên: nút, rồi link (đúng tên), rồi chữ hiển thị. Sau đó chờ mạng lắng |
| `--scroll "<chữ>"`    | Cuộn phần tử chứa chữ vào viewport                                                        |
| `--dark`              | Giả lập `prefers-color-scheme: dark`; script kiểm tra `<html>` có class `dark-mode`       |

- Script chờ trang `load`, rồi chờ mạng lắng thêm tối đa 5 s. Animation luôn tắt (`prefers-reduced-motion: reduce`).
- `--wait-text`, `--click`, `--scroll` lặp được và chạy theo thứ tự trên dòng lệnh. Một bước lỗi thì lệnh lỗi, nêu bước đó, và không lưu ảnh.
- `--dark` không đổi tên ảnh. Đặt tên riêng, vd. `before-mentions-dark` và `after-mentions-dark`.
- Không `--click` nút ghi dữ liệu (Lưu, Xoá, Gửi…) khi dev server trỏ tới dữ liệu thật. Script không chặn được.
- Script mở một trình duyệt mới, không có phiên đăng nhập. Khi `(app)` có guard đăng nhập (T-032), màn trong đó (vd. `/mentions`) chuyển về `/login`. Màn cần đăng nhập: chụp trên trình duyệt đã đăng nhập, rồi lưu bằng `--file <png>`.

```bash
pnpm issue:shot before login --url /login --wait-text "Sign in"
pnpm issue:shot after login-dark --url /login --dark
pnpm issue:shot after mentions --file ~/Desktop/mentions-after.png   # màn cần đăng nhập
```

## Output lỗi ngắn

- `pnpm verify:quiet`: pass in một dòng; fail in 50 dòng cuối và đường dẫn log đầy đủ. Đổi số dòng bằng `VERIFY_TAIL=30`.
- Một verify chạy một lúc trên mọi worktree (khoá chung trong git dir).
- `issue:*` in một dòng cho bước pass, 50 dòng cuối cho bước fail.
- `issue:ship` chạy verify trước khi push và để lại stamp cho commit. Hook `pre-push` dùng lại stamp, nên push mất vài giây.
- `pnpm agent:test` (một phần của `pnpm verify`) chạy test của script workflow: `agent-workflow` (agent, issue, ticket), `pr-done` (screenshot, Definition of Done, tìm Chrome), `pr-conventions`, `merge-state`, `verify-lock`, `verify-stamp`. Các file nằm cạnh script trong `scripts/`.
- CI chạy tay (`gh workflow run ci.yml --ref <branch>`): đọc log bằng `gh run view <id> --log-failed | tail -50`. Không đọc cả log.

## Đo chi phí từng ticket

`pnpm agent` chạy `claude -p --output-format json` và lấy `total_cost_usd`. Mỗi lượt ghi một dòng JSON vào `.claude/runs/agent-costs.jsonl` của checkout chính. Mọi worktree ghi chung file này. Git không theo dõi file này.

Mỗi dòng có: ticket, tiêu đề, label, stage, model đã chọn, model đã chạy (`ran`), effort, USD, thời gian, số lượt, session id.

```bash
pnpm agent cost         # tổng theo ticket, theo label, theo stage và model
pnpm agent cost 45     # chỉ một ticket (nhận cả T-049)
```

`issue:ship` thêm bảng chi phí của các issue trong `Closes #N` vào mô tả PR. Lượt chạy sau `issue:ship` không có trong bảng.

---

## Cách dùng

### 0. Tạo worktree và triage

```bash
pnpm issue:start T-049 feature window calculator
cd ../how-about-me-45
pnpm agent triage 45
```

Output: `.claude/runs/triage-45.json` (type, area, size, `hard`).

Ticket đổi UI thì chụp ảnh "trước" ngay lúc này, trên code cũ:

```bash
pnpm dev    # terminal khác
pnpm issue:shot before <name> --url /<route>
```

### 1. Lập plan

```bash
pnpm agent plan 45            # Opus low, hoặc high nếu triage ghi hard
pnpm agent plan 45 --hard     # buộc Opus high
```

Trong session tương tác: `@researcher {mô tả task}` kèm ticket và ràng buộc. Output: `.claude/runs/research-45.md`.

Câu hỏi mở: ghi quyết định vào comment của issue (`gh issue comment <n>`) rồi chạy tiếp, không chờ.

### 2. Code → tidy → review

1. `pnpm agent code 45`: coder làm theo plan, ghi `.claude/runs/impl-45.md`.
2. `pnpm issue:tidy`: script format và lint.
3. `pnpm agent review 45`: QA đọc plan, báo cáo và code thật, script lưu `.claude/runs/qa-45.md`.

### 3. Theo kết quả QA

- **PASS** → chụp ảnh "sau" (`pnpm issue:shot after <name> --url /<route>`), commit, `pnpm issue:ship --title "<subject>" --body-file <file>` (thêm `--no-shots "<lý do>"` khi file UI đổi mà giao diện không đổi), rồi `pnpm issue:finish <PR>` ngay.
- **FAIL** → `pnpm agent code 45` (đọc `qa-45.md`, sửa blocker) → `pnpm issue:tidy` → `pnpm agent review 45`. Tối đa 2 vòng.

Truyền thêm tham số cho `claude` sau `--`, ví dụ `pnpm agent code 45 -- --max-turns 40`.

---

## File Naming

| Stage      | Output                 |
| ---------- | ---------------------- |
| Triage     | `triage-{ticket}.json` |
| Researcher | `research-{ticket}.md` |
| Coder      | `impl-{ticket}.md`     |
| QA Tester  | `qa-{ticket}.md`       |

`{ticket}` là số issue. Các file nằm trong `.claude/runs/` của worktree (gitignored).

## Ngôn ngữ

- Agent viết output bằng **tiếng Việt**.
- Giữ tiếng Anh cho: tên file, tên biến, code, tên thư viện, API path, JSON key, error code.
- Code comment và commit message viết bằng tiếng Anh.
- Văn phong: câu ngắn, trực tiếp, một ý một câu; bảng thay đoạn văn cho danh sách rule.

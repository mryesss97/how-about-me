# How About Me: quy trình làm docs và design theo từng flow

Port từ `short-videos-docs/design/figma/` ngày 08/11/2026 (#403). Mọi thay đổi về quy trình design cập nhật vào file này. Liên quan: [TRACKING.md](TRACKING.md), [COMPONENTS.md](COMPONENTS.md), [ROLES.md](ROLES.md), [DATA-MAU.md](DATA-MAU.md), [tokens/TOKENS.md](tokens/TOKENS.md), [DESIGNER-BRIEF.md](DESIGNER-BRIEF.md).

## Khác short-videos ở đâu

short-videos là repo docs + Figma, chưa có code: Figma là nơi chốt giao diện. How About Me đã có web chạy thật (Next.js + Untitled UI), nên:

| Việc                | short-videos                                 | How About Me                                                                                                          |
| ------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Nguồn giá trị token | Biến trên Figma                              | `apps/web/src/styles/theme.css` (app) và `apps/web/DESIGN.md` (landing biển hiệu). Figma chép lại theo đúng tên code  |
| Nguồn component     | Page `02 Components`                         | `apps/web/src/components/**` (Untitled UI) và `apps/web/src/features/**`. Figma có một component cho mỗi cái màn dùng |
| Nguồn hành vi       | Epic, US, BR, MSG, AC trong `docs/products/` | FR, BR trong `docs/01-product/`, màn trong UX spec §3 (`09-ux-specification.md`)                                      |
| Kiểm tra            | `tools/check.sh` lint spec                   | `pnpm design:check` (token, component, route trong các file này phải có thật trong code), chạy trong `pnpm verify`    |
| Thứ tự việc mới     | docs → Figma                                 | docs → Figma → code                                                                                                   |
| Màn đã ship         |                                              | code → Figma (chép màn thật để làm nền, không vẽ lại từ đầu)                                                          |
| Mode màu            | Dark, Light                                  | Chỉ Light (#263). `.dark-mode` trong `theme.css` còn nhưng không dùng                                                 |

## Tổ chức

- **Chủ dự án:** anh Đước (GitHub `mryesss97`). Xem lại trên PR và comment Figma.
- **Việc:** mỗi việc là một GitHub issue, chạy theo vòng issue ở [docs/06-engineering/04-git-workflow.md §8](../../docs/06-engineering/04-git-workflow.md#8-issue-loop-agent). Nhãn `area: docs`, `area: web`; thêm `needs: owner-input` khi cần anh chốt.
- **Designer:** agent của Claude nhận theo issue, brief ở [DESIGNER-BRIEF.md](DESIGNER-BRIEF.md). Khi có người, giao issue như bình thường.
- **File Figma:** một file, các page `00 Định hướng`, `01 Foundations`, `02 Components`, `03 App`, `99 Lưu trữ`. Biến và component nằm chung file nên dùng ngay, không cần publish thư viện. Link và node id ghi ở [TRACKING.md](TRACKING.md).
- **Thứ tự:** docs → token → component → từng flow → rà soát. Không vẽ flow khi docs chưa có màn đó.

## 0. Các chặng

| Chặng         | Việc                                                                                                                      | Đầu ra                                   | Ai chốt             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------- |
| 0. Hiện trạng | Chụp màn thật theo route, đọc UX spec §3                                                                                  | Bảng TRACKING đủ route                   | Agent               |
| 1. Định hướng | Hướng nhìn: Untitled UI cho màn làm việc, biển hiệu Sài Gòn cho landing và điểm nhấn (`apps/web/DESIGN.md`, `PRODUCT.md`) | Đã chốt (#271, 14/10/2026)               | Anh                 |
| 2. Nền        | Token (`01 Foundations`), component (`02 Components`) chép từ code                                                        | Page Foundations, Components             | Anh                 |
| 3. Theo flow  | Làm từng flow theo mục 2                                                                                                  | Section `J<n>` trên `03 App` + docs khớp | Anh duyệt từng flow |
| 4. Bàn giao   | Prototype, ghi chú cho dev, issue code cho phần đổi                                                                       | Link Figma trên issue                    | Anh                 |

Thứ tự flow đề xuất, đi từ nơi người dùng ở lâu nhất: Tổng quan → Bài nhắc tới → Chi tiết bài → Hàng chờ rà soát → Truy vấn theo dõi → Trạng thái hệ thống → Cài đặt → Landing và Cụm từ → Đăng nhập, 404.

Với mỗi flow, ghi rõ hành vi nào **giữ nguyên**, hành vi nào **đổi**. Đổi logic (không chỉ giao diện) thì phải sửa FR/BR trong docs và có issue code riêng.

## 1. Thứ tự làm

1. Design token (mục 4, [tokens/TOKENS.md](tokens/TOKENS.md)).
2. Component có đủ trạng thái ([COMPONENTS.md](COMPONENTS.md)).
3. Từng flow, mỗi lần một flow. Xong flow này mới mở flow khác.
4. Sau cùng: prototype và chuyển cảnh.

## 2. Một flow gồm những bước nào

Mỗi flow ứng với một mục màn trong UX spec §3. Flow chỉ xong khi đủ các bước:

1. **Đối chiếu:** so UX spec, FR/BR liên quan, section trên Figma và màn chạy thật (`pnpm dev`, web cổng 3100, `pnpm db:seed:demo`). Liệt kê case thiếu, chỗ sai.
2. **Docs trước:** case docs chưa có hoặc phải đổi thì sửa UX spec, FR, BR trước, rồi mới vẽ.
3. **Component:** UI cần component chưa có thì thêm vào `02 Components` và ghi vào COMPONENTS, không để frame dùng một lần. Component chưa có trong code thì ghi "đề xuất".
4. **Dựng section:** một Section có tên trên Figma cho cả flow (mục 3).
5. **Role:** rà role theo ma trận quyền (`02-personas-rbac.md`), ghi vào [ROLES.md](ROLES.md).
6. **Báo lệch:** liệt kê chỗ màn thật, Figma và docs khác nhau. Lệch về hành vi thì mở issue code.
7. **Đóng flow:** cập nhật TRACKING, COMPONENTS, ROLES, chạy `pnpm design:check`, một PR cho cả flow.

## 3. Section trên Figma

- Tên theo hành trình: `J<n> · <tên flow>`, thứ tự ở [TRACKING.md](TRACKING.md). Đầu section ghi mục UX spec và route. Số liệu trên màn theo [DATA-MAU.md](DATA-MAU.md).
- Trong section đi hết luồng, mỗi hàng một loại: **Luồng chính**, **Trạng thái** (đang tải, trống, lỗi, cũ, một phần theo UX §2.3), **Theo role**, **Thành công**.
- Mỗi màn có nhãn `Annotation/StepLabel`: loại, số bước, tên bước, mô tả ngắn kèm mã FR, BR.
- Tên màn: `J4 · Trạng thái 2 · Mô tả`. Khung 1440×900 (màn dài cao theo nội dung). Thêm một màn 390 cho mỗi flow có bố cục điện thoại riêng (UX §4).
- Màn "đề xuất" (chưa có trong code) ghi rõ trên nhãn.

## 4. Quy tắc Design System

Chi tiết token ở [tokens/TOKENS.md](tokens/TOKENS.md), component ở [COMPONENTS.md](COMPONENTS.md).

- Màu, khoảng cách, bo góc, cỡ chữ đều gắn biến; không ghi màu cứng trên màn. Tên biến giống tên CSS bỏ `--color-` (`bg-primary`, `text-secondary`), code syntax WEB `var(--color-bg-primary)`.
- 4 tầng như short-videos: `brand` (thang, font, số; ẩn) → `alias` (vai trò màu ẩn; spacing, radius, viền, font) → `mapped` (tên code Untitled UI, mode Light) + `sign` (biển hiệu) → `responsive` (Desktop, Mobile). Không biến nào `ALL_SCOPES`. Chi tiết [tokens/TOKENS.md](tokens/TOKENS.md).
- Text style dùng tên Untitled UI (`Text sm/Medium`, `Display xs/Semibold`), font Inter. Landing dùng Bungee và Saira Extra Condensed theo `apps/web/DESIGN.md`.
- Màn làm việc (bảng, bộ lọc, nội dung bài) giữ Untitled UI. Biển hiệu chỉ là điểm nhấn: tiêu đề trang, bảng tên trạng thái, landing.
- Ý nghĩa không dựa vào màu một mình: badge cảm xúc, an toàn luôn có biểu tượng và chữ (NFR-030, UX §2.2). Cảm xúc khác an toàn, không suy cái này từ cái kia (BR-017).
- Mọi khối dữ liệu có đủ trạng thái UX §2.3. Khối trống và lỗi căn giữa vùng còn trống, có một nút chính khi có việc để làm.
- Chữ trên màn tiếng Việt, số kiểu Việt (`1.284`, `23,5%`), giờ theo múi giờ của project (mặc định `Asia/Ho_Chi_Minh`).
- Hộp thoại: nút phụ trái, nút chính phải. Tác vụ xoá dùng kiểu `primary-destructive` như code. Drawer (slideout) mở từ phải.
- Lựa chọn loại trừ dùng radio, bật tắt độc lập dùng toggle.
- Ẩn nút theo role chỉ là UX; màn của role không có quyền vẫn phải có trạng thái "chỉ đọc" hoặc "không có quyền" (FR-015).
- Thêm token hay đổi giá trị: sửa `theme.css` (hoặc `globals.css` cho landing), TOKENS.md và Figma trong cùng PR.

## 5. Quy tắc docs

- `docs/` là nguồn gốc. Màn và trạng thái ở UX spec, hành vi ở FR, luật ở BR, số đo ở metric definitions. Không sửa trong Figma mà không sửa docs.
- Mã FR, BR đã gỡ không dùng lại. Thêm luật mới thì cấp mã tiếp theo trong `06-business-rules-glossary.md`.
- Trước khi xong: `pnpm design:check` và `pnpm verify:quiet`.

## 6. Ghi chú kỹ thuật khi dựng bằng script

- Giới hạn Figma: seat Full 200 lượt/ngày, 10 lượt/phút. Gộp việc vào một lần gọi; script lỗi thì Figma rollback cả lần gọi.
- Gọi skill `figma:figma-use` trước mọi `use_figma`; `figma:figma-generate-library` khi dựng token, component từ code; `figma:figma-generate-design` khi dựng màn.
- `resize()` trên frame auto-layout khoá chiều cao: đặt lại `primaryAxisSizingMode = 'AUTO'` sau đó.
- `combineAsVariants` chạy trên page hiện tại rồi mới chuyển page.
- `textTruncation = 'ENDING'` đặt trước `maxLines`.
- Màn đã ship: chụp bằng `generate_figma_design` hoặc `html_to_figma` từ trang chạy thật, rồi thay lớp bằng instance component và gắn biến. Không dán ảnh chụp cả màn làm UI.
- Không đưa token, mật khẩu, email thật vào Figma. Dùng data mẫu ở DATA-MAU.

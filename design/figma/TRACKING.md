# How About Me: Figma tracking

Quy trình: [WORKFLOW.md](WORKFLOW.md). Role theo màn: [ROLES.md](ROLES.md). Data mẫu: [DATA-MAU.md](DATA-MAU.md).

Folder Figma: https://www.figma.com/files/team/1554682555569327021/folder/686779774 (team Mr Yesss)

File chính: https://www.figma.com/design/jczRPmHz0rLbbGrK1uxqK5 (dựng 08/11/2026, #405)

| Page           | Id    | Nội dung                                                                                                                         |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| 00 Định hướng  | `0:1` | Bìa: cách dùng file, danh sách page, sơ đồ J0–J9. Frame `5:771`                                                                  |
| 01 Foundations | `2:2` | Bảng tra biến `primitives` (131), `semantic` Light (215), `sign` (6), `scale` (28); 42 text style; 7 effect style. Frame `5:202` |
| 02 Components  | `2:3` | 76 icon, 19 component và set: atoms, form, bảng, hộp thoại, drawer, khung app, biển hiệu. Xem [COMPONENTS.md](COMPONENTS.md)     |
| 03 App         | `2:4` | Chưa có section                                                                                                                  |
| 99 Lưu trữ     | `2:5` | Trống                                                                                                                            |

## Trạng thái section

Mỗi section cùng bố cục: tiêu đề, mục UX spec, route, rồi các hàng Luồng chính, Trạng thái, Theo role, Thành công. Tên màn: `J4 · Trạng thái 2 · Mô tả`.

`pnpm design:check` báo lỗi khi một route trong `apps/web/src/app` (trừ `/dev/*`) không có dòng trong bảng này.

| Chặng | Section                                 | Route                                                                                                 | UX spec     | Node       | Màn | Trạng thái                             |
| ----- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------- | ---------- | --- | -------------------------------------- |
| J0    | Landing                                 | `/`                                                                                                   | §3.0        | `31:14282` | 6   | Đã dựng 08/11/2026, chờ anh xem        |
| J1    | Cụm từ                                  | `/terms/[term]`                                                                                       | §3.0b       | `32:14570` | 3   | Đã dựng 08/11/2026, chờ anh xem        |
| J2    | Đăng nhập, 404                          | `/login`, `not-found`                                                                                 | §3.1, §3.1a | `32:15075` | 4   | Đã dựng 08/11/2026, chờ anh xem        |
| J3    | Tổng quan                               | `/overview`                                                                                           | §3.2        | `14:5`     | 8   | Đã dựng 08/11/2026 (#410), chờ anh xem |
| J4    | Bài nhắc tới                            | `/mentions`                                                                                           | §3.3        | `17:2325`  | 9   | Đã dựng 08/11/2026, chờ anh xem        |
| J5    | Chi tiết bài                            | `/mentions/[id]`                                                                                      | §3.4        | `19:4727`  | 9   | Đã dựng 08/11/2026, chờ anh xem        |
| J6    | Rà soát                                 | `/reviews`                                                                                            | §3.8        | `21:5649`  | 9   | Đã dựng 08/11/2026, chờ anh xem        |
| J7    | Truy vấn theo dõi                       | `/listening-queries`                                                                                  | §3.5        | `24:7725`  | 11  | Đã dựng 08/11/2026, chờ anh xem        |
| J8    | Trạng thái hệ thống                     | `/system-status`                                                                                      | §3.6        | `27:10347` | 12  | Đã dựng 08/11/2026, chờ anh xem        |
| J9    | Cài đặt                                 | `/settings`, `/settings/project`, `/settings/members`, `/settings/integrations`, `/settings/analysis` | §3.7        | `29:12377` | 14  | Đã dựng 08/11/2026, chờ anh xem        |
| J10   | Thiết lập lần đầu (đề xuất)             | `/overview` khi chưa có truy vấn                                                                      | §3.9        |            |     | Đề xuất MVP+1 (D-001), chưa có code    |
| J11   | Lời mời, mật khẩu, magic link (đề xuất) | `/auth/set-password`, `/login`                                                                        | §3.10       |            |     | Đề xuất MVP+1                          |
| J12   | Cảnh báo (đề xuất)                      | chuông + `/settings/alerts`                                                                           | §3.11       |            |     | Đề xuất MVP+1                          |
| J13   | Bản tin (đề xuất)                       | `/settings/digest`                                                                                    | §3.12       |            |     | Đề xuất MVP+1                          |
| J14   | View đã lưu (đề xuất)                   | `/overview`, `/mentions`                                                                              | §3.13       |            |     | Đề xuất MVP+1                          |
| J15   | Việc chăm sóc (đề xuất)                 | `/cases`, `/cases/[id]`                                                                               | §3.14       |            |     | Đề xuất MVP+1                          |
| J16   | Bổ sung rà soát và vận hành (đề xuất)   | `/reviews`, `/mentions`, `/system-status`                                                             | §3.8, §3.15 |            |     | Đề xuất MVP+1                          |
| J17   | Điện thoại 390 (đề xuất)                | các màn chính                                                                                         | §4          |            |     | Đề xuất MVP+1                          |

Thứ tự J theo hành trình người dùng (vào landing, xem cụm từ, đăng nhập, rồi tới màn làm việc), không theo thứ tự làm. Thứ tự làm ở [WORKFLOW.md](WORKFLOW.md) mục 0.

## Prototype

Chưa có. Khi nối: mỗi section một flow `★` theo hàng Luồng chính; ghi ở đây các flow đã bấm thử thật và ngày thử.

## Kết quả đợt dựng 08/11/2026

Claude làm PO theo uỷ quyền của anh Đước (08/11/2026), chạy WORKFLOW mục 2 cho từng chặng, mỗi chặng một PR: J3 (#411), J4 + J5 (#413), J6 (#415), J7 (#417), J8 (#420), J9 (#422), J0 + J1 + J2 (#424). Tổng 85 màn, dựng từ bản đang chạy với `pnpm db:seed:demo`, mọi màn dùng instance và biến (không màu cứng, font Inter, Bungee, Saira ExtraCondensed).

Quyết định PO và lệch đã ghi:

- Code là nguồn: UX §3.2 nhãn KPI 17px (#411), UX §3.0 bỏ dòng "30 NGÀY QUA" trên biển chính (#424).
- Chữ: nhật ký thao tác thống nhất "Đánh dấu đã xem lại" (Figma đã đổi, code ở #418).
- Lỗi code tìm thấy: hydration mismatch ở `/overview` (#409).

## Còn lại

- Prototype: chưa nối. Khi nối, mỗi section một flow `★` theo hàng Luồng chính.
- Màn điện thoại 390: chưa dựng. Bố cục điện thoại theo UX §4; ưu tiên Tổng quan, Bài nhắc, Chi tiết bài, landing.
- Component chưa dựng (cột Node id trống trong [COMPONENTS.md](COMPONENTS.md)): ButtonUtility, Tooltip, Pagination, Chart (biểu đồ đang vẽ thẳng trong thẻ), lịch của DateRangePicker và các component theo màn chưa tách (FilterBar, popover Bộ lọc khác, drawer chi tiết). Tách khi flow sau sửa tới.
- Lỗi phân tích trong drawer J4 và màn `/mentions?item=` dùng bố cục J5; nếu drawer đổi riêng thì tách section.
- `/dev/ui` là trang thử component cho dev, không dựng.
- File nháp trống "How About Me · Design System" trong Drafts của team Mr Yesss (tạo nhầm trước khi có link folder): anh xoá tay.

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

| Chặng | Section             | Route                                                                                                 | UX spec     | Node      | Màn | Trạng thái                             |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------------- | ----------- | --------- | --- | -------------------------------------- |
| J0    | Landing             | `/`                                                                                                   | §3.0        |           |     | Đã ship, chưa dựng Figma               |
| J1    | Cụm từ              | `/terms/[term]`                                                                                       | §3.0b       |           |     | Đã ship, chưa dựng Figma               |
| J2    | Đăng nhập, 404      | `/login`, `not-found`                                                                                 | §3.1, §3.1a |           |     | Đã ship, chưa dựng Figma               |
| J3    | Tổng quan           | `/overview`                                                                                           | §3.2        | `14:5`    | 8   | Đã dựng 08/11/2026 (#410), chờ anh xem |
| J4    | Bài nhắc tới        | `/mentions`                                                                                           | §3.3        | `17:2325` | 9   | Đã dựng 08/11/2026, chờ anh xem        |
| J5    | Chi tiết bài        | `/mentions/[id]`                                                                                      | §3.4        | `19:4727` | 9   | Đã dựng 08/11/2026, chờ anh xem        |
| J6    | Rà soát             | `/reviews`                                                                                            | §3.8        | `21:5649` | 9   | Đã dựng 08/11/2026, chờ anh xem        |
| J7    | Truy vấn theo dõi   | `/listening-queries`                                                                                  | §3.5        | `24:7725` | 11  | Đã dựng 08/11/2026, chờ anh xem        |
| J8    | Trạng thái hệ thống | `/system-status`                                                                                      | §3.6        |           |     | Đã ship, chưa dựng Figma               |
| J9    | Cài đặt             | `/settings`, `/settings/project`, `/settings/members`, `/settings/integrations`, `/settings/analysis` | §3.7        |           |     | Đã ship, chưa dựng Figma               |

Thứ tự J theo hành trình người dùng (vào landing, xem cụm từ, đăng nhập, rồi tới màn làm việc), không theo thứ tự làm. Thứ tự làm ở [WORKFLOW.md](WORKFLOW.md) mục 0.

## Prototype

Chưa có. Khi nối: mỗi section một flow `★` theo hàng Luồng chính; ghi ở đây các flow đã bấm thử thật và ngày thử.

## Còn lại

- Component chưa dựng (cột Node id trống trong [COMPONENTS.md](COMPONENTS.md)): ButtonUtility, ButtonGroup, InputTags, Textarea, Checkbox, RadioButtons, Toggle, Tooltip, Tags, Dropdown, Tabs, DateRangePicker, Pagination, EmptyState, LoadingIndicator, Chart và các component theo màn. Dựng khi flow đầu tiên cần tới (WORKFLOW mục 2 bước 3).
- Dựng section J0–J9 trên `03 App`, mỗi lần một flow (WORKFLOW mục 2).
- `/dev/ui` là trang thử component cho dev, không dựng.

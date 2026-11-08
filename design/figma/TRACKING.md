# How About Me: Figma tracking

Quy trình: [WORKFLOW.md](WORKFLOW.md). Role theo màn: [ROLES.md](ROLES.md). Data mẫu: [DATA-MAU.md](DATA-MAU.md).

File chính: chưa tạo. Khi tạo, ghi link và id file ở đây.

| Page           | Nội dung                                                                       |
| -------------- | ------------------------------------------------------------------------------ |
| 00 Định hướng  | Hướng biển hiệu Sài Gòn (`apps/web/DESIGN.md`), sơ đồ route                    |
| 01 Foundations | Biến `primitives`, `semantic`, `sign`, `scale`; text style; effect style; logo |
| 02 Components  | Theo [COMPONENTS.md](COMPONENTS.md)                                            |
| 03 App         | Một section mỗi chặng bên dưới                                                 |
| 99 Lưu trữ     | Bản nháp cũ, không dùng cho việc mới                                           |

## Trạng thái section

Mỗi section cùng bố cục: tiêu đề, mục UX spec, route, rồi các hàng Luồng chính, Trạng thái, Theo role, Thành công. Tên màn: `J4 · Trạng thái 2 · Mô tả`.

`pnpm design:check` báo lỗi khi một route trong `apps/web/src/app` (trừ `/dev/*`) không có dòng trong bảng này.

| Chặng | Section             | Route                                                                                                 | UX spec     | Node | Màn | Trạng thái               |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------------- | ----------- | ---- | --- | ------------------------ |
| J0    | Landing             | `/`                                                                                                   | §3.0        |      |     | Đã ship, chưa dựng Figma |
| J1    | Cụm từ              | `/terms/[term]`                                                                                       | §3.0b       |      |     | Đã ship, chưa dựng Figma |
| J2    | Đăng nhập, 404      | `/login`, `not-found`                                                                                 | §3.1, §3.1a |      |     | Đã ship, chưa dựng Figma |
| J3    | Tổng quan           | `/overview`                                                                                           | §3.2        |      |     | Đã ship, chưa dựng Figma |
| J4    | Bài nhắc tới        | `/mentions`                                                                                           | §3.3        |      |     | Đã ship, chưa dựng Figma |
| J5    | Chi tiết bài        | `/mentions/[id]`                                                                                      | §3.4        |      |     | Đã ship, chưa dựng Figma |
| J6    | Rà soát             | `/reviews`                                                                                            | §3.8        |      |     | Đã ship, chưa dựng Figma |
| J7    | Truy vấn theo dõi   | `/listening-queries`                                                                                  | §3.5        |      |     | Đã ship, chưa dựng Figma |
| J8    | Trạng thái hệ thống | `/system-status`                                                                                      | §3.6        |      |     | Đã ship, chưa dựng Figma |
| J9    | Cài đặt             | `/settings`, `/settings/project`, `/settings/members`, `/settings/integrations`, `/settings/analysis` | §3.7        |      |     | Đã ship, chưa dựng Figma |

Thứ tự J theo hành trình người dùng (vào landing, xem cụm từ, đăng nhập, rồi tới màn làm việc), không theo thứ tự làm. Thứ tự làm ở [WORKFLOW.md](WORKFLOW.md) mục 0.

## Prototype

Chưa có. Khi nối: mỗi section một flow `★` theo hàng Luồng chính; ghi ở đây các flow đã bấm thử thật và ngày thử.

## Còn lại

- Tạo file Figma, dựng `01 Foundations` và `02 Components` từ code (chặng 2).
- `/dev/ui` là trang thử component cho dev, không dựng.

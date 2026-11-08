# How About Me: bộ data mẫu trên Figma

Mọi màn trên Figma dùng chung bộ số này, để một cụm từ hay một bài giữ đúng số khi đi qua nhiều màn. Bộ số lấy từ data demo của code (`pnpm db:seed:demo`, #294), nên màn Figma và màn chạy thật khớp nhau. Đây là số minh hoạ, không phải số thật của Threads.

## Quy ước

- Số kiểu Việt: `1.284`, `23,5%`. Giờ theo `Asia/Ho_Chi_Minh`, ngày `08/11/2026`.
- Khoảng thời gian mặc định: 30 ngày gần nhất (FR-020, UX §2.1).
- Không đưa email, token, tên thật của người dùng Threads vào Figma. Tên tài khoản và nội dung bài là chữ mẫu.

## Project và tài khoản

| Mục             | Giá trị                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project         | `1Zone / Eventista Social Listening` (slug `1zone-eventista`), múi giờ `Asia/Ho_Chi_Minh`                                                                                       |
| Tài khoản       | 3 role: Quản trị, Phân tích, Chỉ xem. Email thật nằm trong `apps/api/.env`, không ghi lên Figma; trên màn dùng `admin@example.com`, `analyst@example.com`, `viewer@example.com` |
| Kết nối Threads | Đã kết nối, tài khoản `demo_threads_account`                                                                                                                                    |

## Truy vấn theo dõi (8)

4 truy vấn gốc của seed (từ khoá thương hiệu `1zone`, `#1zone`, `eventista`, `#eventista`) và 4 truy vấn demo:

| Truy vấn           | Loại                        | Chu kỳ  | Trạng thái          |
| ------------------ | --------------------------- | ------- | ------------------- |
| `fan meeting`      | Từ khoá, loại trừ `pass vé` | 5 phút  | Lỗi đồng bộ         |
| `#lightstick`      | Thẻ chủ đề                  | 30 phút | Bật                 |
| `hoàn vé`          | Từ khoá                     | 60 phút | Tắt                 |
| `eventista refund` | Từ khoá                     | 10 phút | Đã xoá 5 ngày trước |

## Bài và phân tích

- 600 bài trong 30 ngày, có phân tích nhiều phiên bản, đủ mọi lý do rà soát, có bài đã sửa tay, lượt đồng bộ và nhật ký thao tác.
- Số trên KPI, biểu đồ, bảng lấy từ màn chạy thật sau khi seed; ghi lại số đã dùng vào bảng dưới khi dựng section, để các màn sau dùng lại.

| Số  | Giá trị đã dùng | Màn |
| --- | --------------- | --- |
|     |                 |     |

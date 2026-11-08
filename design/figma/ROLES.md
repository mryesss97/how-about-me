# How About Me: role theo từng màn

Danh sách role và ma trận quyền gốc: [docs/01-product/02-personas-rbac.md](../../docs/01-product/02-personas-rbac.md). Quyền do API chặn (FR-015); ẩn nút trên màn chỉ là UX.

| Role      | Tên trên màn (`roleLabelVi`) | Tóm tắt                                                                      |
| --------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `admin`   | Quản trị                     | Toàn quyền project: kết nối, truy vấn, đồng bộ, phân tích, thành viên, xuất  |
| `analyst` | Phân tích                    | Xem tất cả, rà soát và sửa kết quả, xuất, phân tích lại một bài nếu được bật |
| `viewer`  | Chỉ xem                      | Chỉ xem; xuất khi Quản trị bật                                               |

## Role theo màn

Mỗi section trên Figma có hàng **Theo role** vẽ đủ các khác biệt dưới đây.

| Chặng  | Màn                 | Admin                                       | Analyst                                                | Viewer                            | Ghi chú khi vẽ                           |
| ------ | ------------------- | ------------------------------------------- | ------------------------------------------------------ | --------------------------------- | ---------------------------------------- |
| J0, J1 | Landing, Cụm từ     | Xem                                         | Xem                                                    | Xem                               | Giống nhau                               |
| J3     | Tổng quan           | Xem                                         | Xem                                                    | Xem                               | Giống nhau                               |
| J4     | Bài nhắc tới        | Xem, xuất, phân tích lại hàng loạt          | Xem, xuất                                              | Xem; xuất khi `allowViewerExport` | Nút Xuất và Phân tích lại theo role      |
| J5     | Chi tiết bài        | Phân tích lại, sửa kết quả                  | Sửa kết quả; phân tích lại khi `allowAnalystReanalyze` | Chỉ xem                           | Vẽ màn Viewer không có thao tác          |
| J6     | Rà soát             | Đánh dấu đã rà                              | Đánh dấu đã rà                                         | Chỉ xem                           | Thanh chọn nhiều chỉ có ở Admin, Analyst |
| J7     | Truy vấn theo dõi   | Tạo, sửa, bật tắt, xoá, chạy ngay, backfill | Chỉ xem                                                | Chỉ xem                           | Vẽ màn chỉ đọc                           |
| J8     | Trạng thái hệ thống | Thử lại, tab Nhật ký thao tác               | Xem, không có tab Nhật ký                              | Như Analyst                       | Deep link tab Nhật ký về Tổng quan       |
| J9     | Cài đặt             | Sửa mọi mục                                 | Chỉ đọc                                                | Chỉ đọc                           | `SettingsReadOnlyNote` ở màn chỉ đọc     |

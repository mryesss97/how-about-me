# Release notes — How About Me v0.1.0 (bản nháp)

> Phiên bản: `v0.1.0` · Ngày phát hành: `TBD (T-129)` · Môi trường production: `TBD (T-129)`

How About Me là công cụ social listening nội bộ trên Threads: thu thập bài viết theo Listening Query, phân loại bằng AI (relevance, sentiment, safety, intent, topic, key phrase), rồi hiển thị số liệu và hàng đợi review cho dự án `1Zone / Eventista`.

## 1. Tính năng chính

### Trang chủ / Overview

- Landing toàn màn hình, mỗi landing term một board, bấm vào mở trang phrase detail `/terms/<term>` (FR-020, FR-149). Landing không hiển thị safety (BR-017).
- Analytics lọc theo khoảng thời gian, timezone, query, sentiment (FR-130…148). Mọi phân bố đều kèm mẫu số (FR-140).

### Mentions

- Danh sách phân trang theo cursor, có bộ lọc và lọc theo term (FR-150…161, BR-042). Deep link `/mentions/:id` (FR-160).
- Analyst override, có badge phân biệt giá trị AI và Analyst (FR-191…194).
- Bulk re-analysis có xem trước số lượng và giới hạn tần suất (FR-196).
- Xuất CSV, có giới hạn `EXPORT_MAX_ROWS` (FR-180, FR-181).

### Reviews

- Hàng đợi review gồm bài `uncertain`, bài có confidence thấp và lượt phân tích lỗi. Có thể đánh dấu đã review (FR-195).

### Listening Queries

- Tạo, sửa, bật/tắt, xoá mềm và khôi phục query; chạy ngay; backfill theo cửa sổ thời gian (FR-050…063).

### Settings

- Kết nối Threads: lưu token đã mã hoá, xác minh kết nối, xem trạng thái tích hợp (FR-040…047).
- Quản lý thành viên và role Admin / Analyst / Viewer (FR-030…036). Phân quyền kiểm tra ở server (FR-015).
- Phân tích: cấu hình confidence band và safety policy theo version (FR-190).

### System Status

- Trạng thái Threads, collector, analyzer, database; sync jobs; audit log; lỗi phân tích kèm retry (FR-170…176, FR-200…201).

## 2. Cách đọc số liệu

- Mọi số liệu đếm `DISTINCT post_id`. Một bài khớp nhiều query chỉ được tính một lần.
- Mặc định loại bài `irrelevant`. Bài `uncertain` chỉ được tính khi bật tuỳ chọn (BR-016).
- Confidence chia theo band (BR-021). Bài dưới band sẽ vào hàng đợi review.
- Sentiment (tích cực / tiêu cực) **không phải** safety (mức độ rủi ro nội dung). Đây là hai trục độc lập.
- Override của Analyst được ưu tiên hơn kết quả AI (FR-192). Kết quả phân tích chỉ ghi thêm (append-only) và có version.
- Bucket thời gian theo timezone được yêu cầu, mặc định `Asia/Ho_Chi_Minh`.

## 3. Known limitations

- **Thu thập Threads thật chưa chạy (tính tới 2026-10-18).** Adapter Threads thật (#35, T-039) chờ token Meta (IN-1); hiện chỉ chạy được với provider giả (`PROVIDERS_MODE=fake`). Phải xong trước khi phát hành.
- **Không crawl reply tree.** Chỉ thu thập bài gốc mà search trả về. Reply của bên thứ ba không lấy được ([POC Threads API](../05-operations/01-poc-threads-api.md)).
- **`uncertain`**: bài vào hàng đợi review và không tính vào số liệu mặc định. Người dùng phải bật tuỳ chọn mới thấy chúng trong số liệu.
- **Giới hạn Threads API**: chịu rate limit của nhà cung cấp. Backfill tối đa `COLLECTOR_MAX_BACKFILL_DAYS` ngày, có giới hạn số trang mỗi job. Khi token hết hạn hoặc mất quyền, lịch thu thập tạm dừng cho tới khi kết nối lại (FR-045).
- **Đăng nhập Google OAuth chưa bật.** Hiện chỉ có email/password (FR-012).
- Rủi ro còn mở: xem [risk register](04-risk-register.md).

## 4. Sắp làm (M6)

- Google OAuth qua Supabase (FR-012, P1).
- Các mục rút ra từ feedback của buổi onboarding (issue có label `feedback`, milestone M6).

## 5. Tài liệu tham khảo

- [Glossary](../01-product/06-business-rules-glossary.md#2-glossary)
- [Runbook](../05-operations/02-runbook.md)
- [Tài liệu onboarding](08-stakeholder-onboarding.md)

## 6. Gửi feedback

Tạo GitHub issue có label `feedback` và milestone `M6`. Ghi rõ màn hình, mô tả và mức độ. Không dán token hay dữ liệu cá nhân vào issue.

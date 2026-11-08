# Brief cho designer dựng flow

File Figma: xem [TRACKING.md](TRACKING.md). Nguồn gốc là `docs/` và code đang chạy.

## Đọc trước

1. [WORKFLOW.md](WORKFLOW.md) (mục Khác short-videos, 2, 3, 4, 6), `apps/web/DESIGN.md`, `apps/web/PRODUCT.md`.
2. [COMPONENTS.md](COMPONENTS.md), [tokens/TOKENS.md](tokens/TOKENS.md).
3. Mục màn được giao trong `docs/01-product/09-ux-specification.md` §3, cùng FR, BR mà mục đó nhắc. Chữ trên màn lấy đúng từ UX spec hoặc màn chạy thật; mọi màn gắn mã FR, BR.
4. Màn chạy thật: `pnpm dev` (web cổng 3100), `pnpm db:seed:demo`, đăng nhập bằng tài khoản seed.

## Công cụ

- ToolSearch tải `mcp__figma__create_session`, `mcp__figma__use_figma`, `mcp__figma__get_screenshot`, `mcp__figma__search_design_system`. Gọi Skill `figma:figma-use` trước mọi `use_figma`; `figma:figma-generate-library` khi dựng token, component; `figma:figma-generate-design` khi dựng màn.
- Gọi `create_session` một lần. Figma dùng chung 10 lượt/phút nên gộp nhiều việc trong một lần gọi; gặp rate limit thì đợi rồi thử lại. Tối đa **28 lượt** cho phần của bạn.
- Nhiều designer cùng làm một file: chỉ tạo và sửa section của bạn, trong vùng toạ độ được giao. Không sửa component có sẵn trừ khi thiếu thật; thiếu thì thêm vào `02 Components` với tiền tố nhóm và ghi vào báo cáo. Không xoá gì của người khác.

## Bắt buộc

- Dùng instance từ `02 Components`, biến và style có sẵn. Không màu cứng, không frame dùng một lần. Font Inter; landing Bungee, Saira Extra Condensed.
- Khung 1440×900 (màn dài cao theo nội dung), mode `semantic = Light`. Thêm một màn 390 khi màn có bố cục điện thoại riêng.
- Section theo WORKFLOW mục 3: đầu section ghi mục UX spec và route. Hàng Luồng chính, Trạng thái, Theo role, Thành công. Trên mỗi màn có nhãn: loại, số bước, tên bước, mã FR, BR.
- Đủ trạng thái UX §2.3: đang tải, trống, lỗi, dữ liệu cũ, một phần; mỗi mục trong menu có màn kết quả. Chữ dài vẽ một ví dụ.
- Role theo [ROLES.md](ROLES.md); số liệu theo [DATA-MAU.md](DATA-MAU.md).
- Bố cục: màn cách nhau 80, hàng cách nhau 160, không chồng lấn. Kiểm bằng script: không chữ bị cắt, không chồng, 0 màu cứng, font đúng. Chụp một ảnh mỗi section, sửa lỗi thấy được.
- Gặp lệch giữa docs, code và Figma: không tự sửa docs. Dựng theo màn chạy thật, gắn nhãn "lệch" hoặc "đề xuất" trên màn, ghi vào báo cáo.

## Sau khi xong

KHÔNG commit, KHÔNG push, KHÔNG sửa file trong repo. Báo lại: node id từng section, số màn, component đã thêm, chỗ lệch docs, phần chưa làm được, số lượt Figma đã dùng. Ngắn gọn.

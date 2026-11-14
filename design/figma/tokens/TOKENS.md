# How About Me: design tokens

Nguồn giá trị là code: `apps/web/src/styles/theme.css` (Untitled UI, Tailwind v4 `@theme`) cho app, và khối `.sign-wall` trong `apps/web/src/styles/globals.css` cùng `apps/web/DESIGN.md` cho landing biển hiệu. Figma chép lại đúng tên và giá trị, không tự đặt giá trị mới. Đổi token: sửa CSS, file này và biến Figma trong cùng một PR ([WORKFLOW.md](../WORKFLOW.md) mục 4).

`pnpm design:check` kiểm mọi token dạng `--tên` trong file này có thật trong hai file CSS trên.

## 1. Cấu trúc

Định nghĩa lại ngày 14/11/2026 (#447) theo cách của short-videos (`short-videos-docs/design/figma/tokens/TOKENS.md`): bốn tầng **brand → alias → mapped → responsive**, cộng `sign` cho biển hiệu. Khác short-videos ở hai chỗ: tên biến `mapped` giữ đúng tên Untitled UI trong code (không đổi sang `text-color-*`), và chỉ có mode Light.

| Collection   | Chứa gì                                                                                                                                    | Mode                | Số biến | Id                              | Ai dùng                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `brand`      | Thang màu (`brand` sky + thang Tailwind), `white`, `black`, `custom/*` (Mist, chữ chính, sơn biển hiệu), `fonts/*`, thang số `scale/<px>`  | `Giá trị`           | 182     | `VariableCollectionId:2:6`      | Chỉ alias trỏ tới. Ẩn khỏi danh sách chọn (scope rỗng)                        |
| `alias`      | Vai trò màu `Primary`, `Neutral`, `Error`, `Warning`, `Success`, `Information`, `Foundations`; `spacing`, `radius`, `border-width`, `font` | `How About Me`      | 92      | `VariableCollectionId:2:361`    | Vai trò màu ẩn, mapped trỏ tới. Spacing, radius, viền, font hiện cho designer |
| `mapped`     | Màu gắn vào component: `bg/*`, `text/*`, `fg/*`, `border/*`, `focus-ring*`, `utility/<màu>-<bậc>`                                          | `Light`             | 215     | `VariableCollectionId:2:138`    | Component và màn                                                              |
| `sign`       | Sơn biển hiệu: `wall`, `ink`, `sky-enamel`, `red-enamel`, `green-enamel`, `enamel-white`                                                   | `Giá trị`           | 6       | `VariableCollectionId:2:354`    | Landing, khung app, `PlaqueButton`, `StatusPlate`, tiêu đề trang              |
| `responsive` | Cỡ chữ, line height (`typography/*`), layout (`layout/*`)                                                                                  | `Desktop`, `Mobile` | 42      | `VariableCollectionId:57:21636` | Text style, khung màn. Màn điện thoại (J17) đặt `Mobile` ở frame              |

Trước 14/11/2026 ba collection đầu tên `primitives`, `scale`, `semantic`; đổi tên không làm mất chỗ gắn. Không có mode Dark: app chỉ sáng (#263). `.dark-mode` trong `theme.css` giữ nguyên, không chép sang Figma.

Quy ước:

- Tên biến `mapped` và `sign` giống code: bỏ tiền tố `--color-`, nhóm bằng `/`. `--color-bg-brand-solid_hover` → `bg/brand-solid_hover`, code syntax WEB `var(--color-bg-brand-solid_hover)`.
- Mỗi biến có code syntax WEB và mô tả. Mô tả màu ghi chỗ dùng, biến trỏ tới và mã hex, ví dụ `text/tertiary`: "→ Neutral/600 · #525252".
- Không biến nào `ALL_SCOPES`. Nền `FRAME_FILL`, `SHAPE_FILL`; chữ `TEXT_FILL`; viền `STROKE_COLOR`; spacing `GAP`; radius `CORNER_RADIUS`; font `FONT_FAMILY`, `FONT_STYLE`; cỡ chữ `FONT_SIZE`; line height `LINE_HEIGHT`; layout `GAP` hoặc `WIDTH_HEIGHT`. `sign` dùng được cho nền, chữ và viền.
- Chuỗi trỏ: `mapped` → `alias` (vai trò) → `brand` (thang). `utility/*` trỏ thẳng thang ở `brand` vì là màu theo tên (badge, biểu đồ). `sign` trỏ thẳng `brand`.

## 2. brand

Thương hiệu là thang sky (BR logo trong `public/brand/`, brand guide `docs/assets/brand/brand-guide-v2.pdf`). Giá trị bậc 500 và 700 trùng ở landing và app.

| Bậc               | 25      | 50      | 100     | 200     | 300     | 400     | 500         | 600     | 700         | 800     | 900     | 950     |
| ----------------- | ------- | ------- | ------- | ------- | ------- | ------- | ----------- | ------- | ----------- | ------- | ------- | ------- |
| `--color-brand-*` | #F8FCFF | #F0F9FF | #E0F2FE | #BAE6FD | #7DD3FC | #38BDF8 | **#0EA5E9** | #0284C7 | **#0369A1** | #075985 | #0C4A6E | #082F49 |

Thang `neutral`, `red`, `green`, `yellow`, `blue`, `orange`, `purple`, … lấy nguyên giá trị mặc định của Tailwind v4. `custom/*` là giá trị Untitled UI chỉnh riêng cho How About Me: `custom/text-primary` #15344B, `custom/bg-secondary` (Mist) #F5FBFF, `custom/border-secondary_alt` đen 10%, và bốn sơn biển hiệu `custom/wall`, `custom/enamel-white`, `custom/red-enamel`, `custom/green-enamel`.

| Nhóm         | Biến                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fonts`      | `fonts/inter` "Inter", `fonts/bungee` "Bungee", `fonts/saira-extra-condensed` "Saira ExtraCondensed"; `fonts/weight/regular`, `medium`, `semibold` "Semi Bold", `bold` |
| `scale/<px>` | 0, 1, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 36, 37, 38, 40, 44, 48, 56, 60, 64, 72, 80, 96, 280, 390, 1280, 1440, 9999           |

## 2b. alias (mode `How About Me`)

| Vai trò       | Trỏ tới (`brand`) | Dùng cho                            |
| ------------- | ----------------- | ----------------------------------- |
| `Primary`     | `brand` (sky)     | Nút chính, link, focus, thương hiệu |
| `Neutral`     | `neutral`         | Chữ, nền, viền                      |
| `Error`       | `red`             | Lỗi, xoá, tiêu cực                  |
| `Warning`     | `yellow`          | Cảnh báo                            |
| `Success`     | `green`           | Thành công, tích cực                |
| `Information` | `blue`            | Thông tin                           |
| `Foundations` | `white`, `black`  |                                     |

Đổi màu thương hiệu: cho `Primary/*` trỏ sang thang khác, mọi biến `mapped` đi theo. Code không có tầng này; code syntax của vai trò là biến thang mà nó trỏ tới (`Primary/700` → `var(--color-brand-700)`).

| Nhóm           | Biến                                                                                                                                                   | Scope                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `spacing/<px>` | 0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 64, 80, 96 (trỏ `scale/<px>`)                                                                       | `GAP`                       |
| `radius/*`     | `none` 0, `xs` 2, `sm` 4 (biển, plaque), `md` 6, `lg` 8 (nút, ô nhập, thẻ), `xl` 12, `2xl` 16 (hộp thoại), `3xl` 24, `full` 9999                       | `CORNER_RADIUS`             |
| `border-width` | 1 (`ring-1`), 2 (keyline biển hiệu, `ring-2`)                                                                                                          | `STROKE_FLOAT`              |
| `font`         | `font-family-body` Inter, `font-family-sign` Bungee, `font-family-figure` Saira ExtraCondensed; `font-weight-regular`, `-medium`, `-semibold`, `-bold` | `FONT_FAMILY`, `FONT_STYLE` |

## 3. mapped (mode `Light`)

Chọn theo vai trò, không theo màu. Những biến hay dùng:

| Biến code                      | Trỏ tới (alias)   | Hex     | Dùng cho                       |
| ------------------------------ | ----------------- | ------- | ------------------------------ |
| `--color-bg-primary`           | Foundations/white | #FFFFFF | Thẻ, bảng, drawer              |
| `--color-bg-secondary`         | riêng (Mist)      | #F5FBFF | Nền app                        |
| `--color-bg-brand-solid`       | Primary/700       | #0369A1 | Nút chính                      |
| `--color-bg-brand-solid_hover` | Primary/800       | #075985 | Nút chính khi hover            |
| `--color-bg-brand-primary`     | Primary/50        | #F0F9FF | Nền nhấn nhẹ                   |
| `--color-bg-error-solid`       | Error/600         |         | Nút xoá                        |
| `--color-bg-overlay`           | Neutral/950       |         | Lớp phủ dưới hộp thoại, drawer |
| `--color-text-primary`         | riêng             | #15344B | Chữ chính                      |
| `--color-text-secondary`       | Neutral/700       |         | Chữ phụ                        |
| `--color-text-tertiary`        | Neutral/600       |         | Chú thích                      |
| `--color-text-placeholder`     | Neutral/500       |         | Placeholder                    |
| `--color-text-brand-secondary` | Primary/700       | #0369A1 | Link, chữ thương hiệu          |
| `--color-text-error-primary`   | Error/600         |         | Lỗi                            |
| `--color-text-success-primary` | Success/600       |         | Thành công                     |
| `--color-text-warning-primary` | Warning/600       |         | Cảnh báo                       |
| `--color-border-primary`       | Neutral/300       |         | Viền ô nhập                    |
| `--color-border-secondary`     | Neutral/200       |         | Viền thẻ, đường kẻ bảng        |
| `--color-border-brand`         | Primary/500       | #0EA5E9 | Viền khi chọn                  |
| `--color-fg-brand-primary`     | Primary/700       | #0369A1 | Biểu tượng thương hiệu         |
| `--color-fg-quaternary`        | Neutral/400       |         | Biểu tượng mờ                  |
| `--color-focus-ring`           | Primary/600       | #0284C7 | Vòng focus                     |

`--color-utility-<màu>-<bậc>` (15 màu × 50–700) dùng cho badge và biểu đồ. Badge cảm xúc, an toàn, trạng thái lấy màu ở đây nhưng luôn kèm biểu tượng và chữ (NFR-030).

## 4. sign (landing biển hiệu)

Đủ bảng màu, chữ, bo góc, khoảng cách và component landing ở frontmatter của `apps/web/DESIGN.md`. Biến CSS:

| Biến code        | Giá trị | Dùng cho                  |
| ---------------- | ------- | ------------------------- |
| `--wall`         | #D9E6EF | Nền tường                 |
| `--ink`          | #0C4A6E | Chữ, viền trên bảng trắng |
| `--sky-enamel`   | #0369A1 | Biển chính, bảng số hạng  |
| `--red-enamel`   | #B42318 | Tiêu cực                  |
| `--green-enamel` | #067647 | Tích cực                  |
| `--enamel-white` | #FBFDFF | Bảng trắng, biển cửa      |

Trong Figma: `ink` → `Primary/900`, `sky-enamel` → `Primary/700`, bốn biến còn lại → `custom/*` ở `brand`.

`--enamel`, `--letter`, `--line` là biến cục bộ của từng bảng, đặt theo kiểu bảng, không chép sang Figma thành biến riêng: dùng biến của `sign` trực tiếp trong variant.

## 5. responsive (`Desktop` / `Mobile`)

Text style gắn cỡ chữ và line height vào đây. Chữ Untitled UI giữ nguyên ở hai mode vì code không đổi cỡ theo màn; chỉ chữ biển hiệu (dùng `clamp()` trong `globals.css`) và layout đổi.

| Biến                                                        | Desktop   | Mobile    | Code                                                                |
| ----------------------------------------------------------- | --------- | --------- | ------------------------------------------------------------------- |
| `typography/font-size-xs` … `display-lg` và `line-height-*` | như §6    | như §6    | `var(--text-*)`, `var(--text-*--line-height)`                       |
| `typography/font-size-sign-display`                         | 48        | 26        | `.main-sign`: `clamp(26px, 3.1vw, 48px)`                            |
| `typography/font-size-sign-headline`                        | 32        | 22        | `.page-fascia` (tiêu đề trang): `clamp(22px, 2.3vw, 32px)`          |
| `typography/font-size-sign-figure`                          | 40        | 28        | `.kpi-figure` 40px, `.main-sign-figures` `clamp(28px, 2.6vw, 40px)` |
| Các `font-size-sign-*` khác                                 | bằng nhau | bằng nhau | cỡ cố định trong `globals.css`                                      |
| `layout/frame-width`                                        | 1440      | 390       | khung màn Figma                                                     |
| `layout/page-gutter`                                        | 32        | 16        | `px-4 md:px-8`                                                      |
| `layout/section-gap`                                        | 24        | 12        | `gap-3 md:gap-6`                                                    |
| `layout/card-padding`                                       | 20        | 16        | `p-4 md:p-5`                                                        |
| `layout/control-height`                                     | 40        | 44        | nút, ô nhập; điện thoại ≥ 44 px để chạm (#343)                      |
| `layout/sidebar-width`                                      | 280       | 0         | sidebar desktop; điện thoại mở bằng menu                            |

Line height chữ biển hiệu tính theo tỉ lệ cũ (116 %, 120 %, …) rồi làm tròn về `scale/<px>`, nên lệch tối đa 1–2 px so với trước 14/11/2026.

## 6. Typography

Figma: file https://www.figma.com/design/jczRPmHz0rLbbGrK1uxqK5, page `01 Foundations`. Text style `Sign/Display`, `Sign/Headline` (Bungee), `Sign/Title`, `Sign/Figure`, `Sign/Label`, `Sign/Share line` (Figma gọi font là "Saira ExtraCondensed").

Font app Inter (`--font-body`, `--font-display`, subset latin và vietnamese), mono `--font-mono`. Text style Figma đặt tên theo Untitled UI: `<cỡ>/<độ đậm>`, ví dụ `Text sm/Medium`, `Display xs/Semibold`.

Từ 14/11/2026 cả 45 text style gắn biến: cỡ chữ và line height ở `responsive`, họ font ở `alias/font/font-family-*`, độ đậm ở `alias/font/font-weight-*`. Sửa cỡ chữ: sửa biến, không sửa style.

| Cỡ         | Biến code           | Cỡ/dòng (px)      |
| ---------- | ------------------- | ----------------- |
| Text xs    | `--text-xs`         | 12/18             |
| Text sm    | `--text-sm`         | 14/20             |
| Text md    | `--text-md`         | 16/24             |
| Text lg    | `--text-lg`         | 18/28             |
| Text xl    | `--text-xl`         | 20/30             |
| Display xs | `--text-display-xs` | 24/32             |
| Display sm | `--text-display-sm` | 30/38             |
| Display md | `--text-display-md` | 36/44, giãn -0,72 |
| Display lg | `--text-display-lg` | 48/60, giãn -0,96 |

Độ đậm: Regular 400, Medium 500, Semibold 600, Bold 700. Landing: Bungee 400 và Saira Extra Condensed 600/700, thang chữ ở `apps/web/DESIGN.md`.

## 7. Effect style

| Style                 | Biến code                  | Dùng cho          |
| --------------------- | -------------------------- | ----------------- |
| `Shadow/xs`           | `--shadow-xs`              | Nút, ô nhập       |
| `Shadow/sm`           | `--shadow-sm`              | Thẻ               |
| `Shadow/md`           | `--shadow-md`              | Menu, popover     |
| `Shadow/lg`           | `--shadow-lg`              | Dropdown, toast   |
| `Shadow/xl`           | `--shadow-xl`              | Hộp thoại, drawer |
| `Shadow/skeuomorphic` | `--shadow-xs-skeuomorphic` | Nút Untitled UI   |

Landing không dùng bóng, gradient hay glow (`apps/web/DESIGN.md`).

## 8. Ghi chú kỹ thuật

- Biến màu dựng bằng script: trỏ tới tầng dưới thay vì ghi hex, để đổi thang là đổi cả hệ.
- Scope: xem quy ước ở §1.
- Màu dự phòng của biến alias không tự cập nhật khi đổi thang; sau khi đổi, chụp lại màn để kiểm.
- Bóng (`Shadow/*`) giữ màu trong effect style như Untitled UI, chưa gắn biến.
- Gradient gắn biến qua `boundVariables` của từng stop. Landing không có gradient.

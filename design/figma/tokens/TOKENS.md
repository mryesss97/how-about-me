# How About Me: design tokens

Nguồn giá trị là code: `apps/web/src/styles/theme.css` (Untitled UI, Tailwind v4 `@theme`) cho app, và khối `.sign-wall` trong `apps/web/src/styles/globals.css` cùng `apps/web/DESIGN.md` cho landing biển hiệu. Figma chép lại đúng tên và giá trị, không tự đặt giá trị mới. Đổi token: sửa CSS, file này và biến Figma trong cùng một PR ([WORKFLOW.md](../WORKFLOW.md) mục 4).

`pnpm design:check` kiểm mọi token dạng `--tên` trong file này có thật trong hai file CSS trên.

## 1. Cấu trúc

Short-videos dùng 4 tầng `brand → alias → mapped → responsive`. Untitled UI đã có sẵn hai tầng nên How About Me dùng 3 collection, cộng một collection số:

| Collection   | Chứa gì                                                                                                              | Mode      | Số biến (Light)                                       | Ứng với code                                                                              | Ai dùng                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `primitives` | Thang màu `brand` 25–950, thang Tailwind (`neutral`, `red`, `green`, `yellow`, `blue`, …), `white`, `black`, `alpha` | `Giá trị` | 12 brand + thang Tailwind đang dùng                   | `--color-brand-*` (thang Tailwind là mặc định của Tailwind v4)                            | Chỉ `semantic` trỏ tới. Ẩn khỏi danh sách chọn (scope rỗng) |
| `semantic`   | Vai trò: `bg/*`, `text/*`, `fg/*`, `border/*`, `focus-ring*`, `utility/<màu>-<bậc>`                                  | `Light`   | 29 bg, 24 text, 19 fg, 8 border, 134 utility, 2 focus | `--color-bg-*`, `--color-text-*`, `--color-fg-*`, `--color-border-*`, `--color-utility-*` | Component và màn                                            |
| `sign`       | Sơn của landing biển hiệu                                                                                            | `Giá trị` | 6                                                     | `--wall`, `--ink`, `--sky-enamel`, … trong `.sign-wall`                                   | Landing, `PlaqueButton`, `StatusPlate`, tiêu đề trang       |
| `scale`      | Spacing, radius, độ dày viền                                                                                         | `Giá trị` |                                                       | spacing của Tailwind (4px), `--radius-*`                                                  | Component, auto-layout                                      |

Không có mode Dark: app chỉ sáng (#263). `.dark-mode` trong `theme.css` giữ nguyên, không chép sang Figma.

Quy ước tên biến Figma: bỏ tiền tố `--color-`, nhóm bằng `/`. `--color-bg-brand-solid_hover` → `bg/brand-solid_hover`. Code syntax WEB `var(--color-bg-brand-solid_hover)`. Mô tả biến ghi chỗ dùng và mã hex.

## 2. primitives

Thương hiệu là thang sky (BR logo trong `public/brand/`, brand guide `docs/assets/brand/brand-guide-v2.pdf`). Giá trị bậc 500 và 700 trùng ở landing và app.

| Bậc               | 25      | 50      | 100     | 200     | 300     | 400     | 500         | 600     | 700         | 800     | 900     | 950     |
| ----------------- | ------- | ------- | ------- | ------- | ------- | ------- | ----------- | ------- | ----------- | ------- | ------- | ------- |
| `--color-brand-*` | #F8FCFF | #F0F9FF | #E0F2FE | #BAE6FD | #7DD3FC | #38BDF8 | **#0EA5E9** | #0284C7 | **#0369A1** | #075985 | #0C4A6E | #082F49 |

Thang `neutral`, `red`, `green`, `yellow`, `blue`, `orange`, `purple`, … lấy nguyên giá trị mặc định của Tailwind v4. `--color-alpha-white`, `--color-alpha-black` là trắng và đen dùng cho lớp trong suốt.

## 3. semantic (mode `Light`)

Chọn theo vai trò, không theo màu. Những biến hay dùng:

| Biến code                      | Trỏ tới      | Hex     | Dùng cho                       |
| ------------------------------ | ------------ | ------- | ------------------------------ |
| `--color-bg-primary`           | white        | #FFFFFF | Thẻ, bảng, drawer              |
| `--color-bg-secondary`         | riêng (Mist) | #F5FBFF | Nền app                        |
| `--color-bg-brand-solid`       | brand 700    | #0369A1 | Nút chính                      |
| `--color-bg-brand-solid_hover` | brand 800    | #075985 | Nút chính khi hover            |
| `--color-bg-brand-primary`     | brand 50     | #F0F9FF | Nền nhấn nhẹ                   |
| `--color-bg-error-solid`       | red 600      |         | Nút xoá                        |
| `--color-bg-overlay`           | neutral 950  |         | Lớp phủ dưới hộp thoại, drawer |
| `--color-text-primary`         | riêng        | #15344B | Chữ chính                      |
| `--color-text-secondary`       | neutral 700  |         | Chữ phụ                        |
| `--color-text-tertiary`        | neutral 600  |         | Chú thích                      |
| `--color-text-placeholder`     | neutral 500  |         | Placeholder                    |
| `--color-text-brand-secondary` | brand 700    | #0369A1 | Link, chữ thương hiệu          |
| `--color-text-error-primary`   | red 600      |         | Lỗi                            |
| `--color-text-success-primary` | green 600    |         | Thành công                     |
| `--color-text-warning-primary` | yellow 600   |         | Cảnh báo                       |
| `--color-border-primary`       | neutral 300  |         | Viền ô nhập                    |
| `--color-border-secondary`     | neutral 200  |         | Viền thẻ, đường kẻ bảng        |
| `--color-border-brand`         | brand 500    | #0EA5E9 | Viền khi chọn                  |
| `--color-fg-brand-primary`     | brand 700    | #0369A1 | Biểu tượng thương hiệu         |
| `--color-fg-quaternary`        | neutral 400  |         | Biểu tượng mờ                  |
| `--color-focus-ring`           | brand 600    | #0284C7 | Vòng focus                     |

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

`--enamel`, `--letter`, `--line` là biến cục bộ của từng bảng, đặt theo kiểu bảng, không chép sang Figma thành biến riêng: dùng biến của `sign` trực tiếp trong variant.

## 5. scale

| Nhóm    | Giá trị                                                                            | Ứng với code                       |
| ------- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| Spacing | 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96                              | spacing của Tailwind, 4px × n      |
| Radius  | `none` 0, `xs` 2, `sm` 4, `md` 6, `lg` 8, `xl` 12, `2xl` 16, `3xl` 24, `full` 9999 | `--radius-xs` … `--radius-full`    |
| Viền    | 1, 2                                                                               | `ring-1`, `ring-2` của Untitled UI |

## 6. Typography

Font app Inter (`--font-body`, `--font-display`, subset latin và vietnamese), mono `--font-mono`. Text style Figma đặt tên theo Untitled UI: `<cỡ>/<độ đậm>`, ví dụ `Text sm/Medium`, `Display xs/Semibold`.

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

- Biến màu dựng bằng script: trỏ alias tới `primitives` thay vì ghi hex, để đổi thang là đổi cả hệ.
- Scope: màu nền `FRAME_FILL`, `SHAPE_FILL`; chữ `TEXT_FILL`; viền `STROKE_COLOR`; spacing `GAP`; radius `CORNER_RADIUS`.
- Gradient gắn biến qua `boundVariables` của từng stop. Landing không có gradient.

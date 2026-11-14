# How About Me: design tokens

Nguồn giá trị là code: `apps/web/src/styles/theme.css` (Untitled UI, Tailwind v4 `@theme`) cho app, và khối `.sign-wall` trong `apps/web/src/styles/globals.css` cùng `apps/web/DESIGN.md` cho landing biển hiệu. Figma chép lại đúng tên và giá trị, không tự đặt giá trị mới. Đổi token: sửa CSS, file này và biến Figma trong cùng một PR ([WORKFLOW.md](../WORKFLOW.md) mục 4).

`pnpm design:check` kiểm mọi token dạng `--tên` trong file này có thật trong hai file CSS trên.

## 1. Cấu trúc

Định nghĩa lại ngày 14/11/2026 (#447, #449) theo short-videos (`short-videos-docs/design/figma/tokens/TOKENS.md`, Figma `qBEUqJxD6EaiOX04F1ilpG` page `01 Foundations`): bốn tầng **brand → alias → mapped → responsive**, cộng `sign` cho biển hiệu, cùng cách đặt tên (`text/text-color-*`, `surface/surface-color-*`, `spacing/spacing-400`, `radius/radius-sm`). Khác short-videos: chỉ mode Light, không có nhóm Glass, và `utility/*` giữ tên Untitled.

| Collection   | Chứa gì                                                                                                                                    | Mode                | Số biến | Id                              | Ai dùng                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `brand`      | Thang màu (`brand` sky + thang Tailwind), `white`, `black`, `custom/*` (Mist, chữ chính, sơn biển hiệu), `fonts/*`, thang số `scale/<px>`  | `Giá trị`           | 182     | `VariableCollectionId:2:6`      | Chỉ alias trỏ tới. Ẩn khỏi danh sách chọn (scope rỗng)                        |
| `alias`      | Vai trò màu `Primary`, `Neutral`, `Error`, `Warning`, `Success`, `Information`, `Foundations`; `spacing`, `radius`, `border-width`, `font` | `How About Me`      | 92      | `VariableCollectionId:2:361`    | Vai trò màu ẩn, mapped trỏ tới. Spacing, radius, viền, font hiện cho designer |
| `mapped`     | Màu gắn vào component: `text/*`, `icon/*`, `surface/*`, `action/*`, `border/*`, `utility/<màu>-<bậc>`                                      | `Light`             | 215     | `VariableCollectionId:2:138`    | Component và màn                                                              |
| `sign`       | Sơn biển hiệu: `wall`, `ink`, `sky-enamel`, `red-enamel`, `green-enamel`, `enamel-white`                                                   | `Giá trị`           | 6       | `VariableCollectionId:2:354`    | Landing, khung app, `PlaqueButton`, `StatusPlate`, tiêu đề trang              |
| `responsive` | Cỡ chữ, line height (`typography/*`), layout (`layout/*`)                                                                                  | `Desktop`, `Mobile` | 42      | `VariableCollectionId:57:21636` | Text style, khung màn. Màn điện thoại (J17) đặt `Mobile` ở frame              |

Trước 14/11/2026 ba collection đầu tên `primitives`, `scale`, `semantic`; đổi tên không làm mất chỗ gắn. Không có mode Dark: app chỉ sáng (#263). `.dark-mode` trong `theme.css` giữ nguyên, không chép sang Figma.

Quy ước:

- Tên biến designer dùng giống code, dạng `nhóm/tên-code`, code syntax WEB `var(--tên-code)`: `surface/surface-color-card` ↔ `var(--surface-color-card)`. Bảng đối chiếu với biến Untitled ở §3.
- Mỗi biến có code syntax WEB và mô tả. Mô tả màu ghi chỗ dùng, biến trỏ tới và mã hex, ví dụ `text/text-color-tertiary`: "→ Neutral/600 · #525252 · Untitled text-tertiary".
- Không biến nào `ALL_SCOPES`. Nền `FRAME_FILL`, `SHAPE_FILL`; chữ `TEXT_FILL`; viền `STROKE_COLOR`; spacing `GAP`; radius `CORNER_RADIUS`; font `FONT_FAMILY`, `FONT_STYLE`; cỡ chữ `FONT_SIZE`; line height `LINE_HEIGHT`; layout `GAP` hoặc `WIDTH_HEIGHT`. `sign` dùng được cho nền, chữ và viền.
- Chuỗi trỏ: `mapped` → `alias` (vai trò) → `brand` (thang). `utility/*` trỏ thẳng thang ở `brand` vì là màu theo tên (badge, biểu đồ). `sign` trỏ thẳng `brand`.

## 2. brand

Thương hiệu là thang sky (BR logo trong `public/brand/`, brand guide `docs/assets/brand/brand-guide-v2.pdf`). Giá trị bậc 500 và 700 trùng ở landing và app.

| Bậc (`sky-brand/*`) | 25      | 50      | 100     | 200     | 300     | 400     | 500         | 600     | 700         | 800     | 900     | 950     |
| ------------------- | ------- | ------- | ------- | ------- | ------- | ------- | ----------- | ------- | ----------- | ------- | ------- | ------- |
| `--color-brand-*`   | #F8FCFF | #F0F9FF | #E0F2FE | #BAE6FD | #7DD3FC | #38BDF8 | **#0EA5E9** | #0284C7 | **#0369A1** | #075985 | #0C4A6E | #082F49 |

Thang `neutral`, `red`, `green`, `yellow`, `blue`, `orange`, `purple`, … lấy nguyên giá trị mặc định của Tailwind v4. Thang thương hiệu tên `sky-brand` trong Figma (như `orange-brand` của short), code `--color-brand-*`. `foundations/white`, `foundations/black`; `alpha/black/10` (viền mờ). `custom/*` là giá trị Untitled UI chỉnh riêng: `custom/text-primary` #15344B, `custom/bg-secondary` (Mist) #F5FBFF, và bốn sơn biển hiệu `custom/wall`, `custom/enamel-white`, `custom/red-enamel`, `custom/green-enamel`.

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

| Nhóm           | Biến                                                                                                                                                                                                                 | Scope                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `spacing/<px>` | 0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 64, 80, 96 (trỏ `scale/<px>`)                                                                                                                                     | `GAP`                       |
| `radius/*`     | `none` 0, `xs` 2, `sm` 4 (biển, plaque), `md` 6, `lg` 8 (nút, ô nhập, thẻ), `xl` 12, `2xl` 16 (hộp thoại), `3xl` 24, `full` 9999                                                                                     | `CORNER_RADIUS`             |
| `border-width` | 1 (`ring-1`), 2 (keyline biển hiệu, `ring-2`)                                                                                                                                                                        | `STROKE_FLOAT`              |
| `font/*`       | `font-family-primary` Inter, `font-family-sign` Bungee, `font-family-figure` Saira ExtraCondensed; `font-weight-regular`, `-medium`, `-semibold`, `-bold`; code `--font-family-primary`, `--font-weight-semibold`, … | `FONT_FAMILY`, `FONT_STYLE` |

## 3. mapped (mode `Light`)

Đổi tên ngày 14/11/2026 (#449) theo khuôn short-videos: tên Figma `nhóm/tên-code`, code syntax `var(--tên-code)`. Mỗi `--tên-code` khai báo trong khối "short-videos scheme" của `apps/web/src/styles/globals.css` và trỏ về biến Untitled UI cùng màu, nên class Untitled (`bg-primary`, `text-tertiary`, …) và biến mới luôn ra một màu. Không đặt giá trị màu ở khối đó; đổi màu ở `theme.css` hoặc ở tầng `alias`.

Code mới nên dùng tên mới (`var(--surface-color-card)`); component Untitled vendored giữ class của nó.

### Chữ (scope TEXT_FILL)

| Token (Figma `text/…`)             | Code                                 | Untitled UI                          | Trỏ tới             | Hex     |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------- | ------- |
| `text-color-primary`               | `--text-color-primary`               | `--color-text-primary`               | custom/text-primary | #15344B |
| `text-color-secondary`             | `--text-color-secondary`             | `--color-text-secondary`             | Neutral/700         | #404040 |
| `text-color-secondary-hover`       | `--text-color-secondary-hover`       | `--color-text-secondary_hover`       | Neutral/800         | #262626 |
| `text-color-tertiary`              | `--text-color-tertiary`              | `--color-text-tertiary`              | Neutral/600         | #525252 |
| `text-color-tertiary-hover`        | `--text-color-tertiary-hover`        | `--color-text-tertiary_hover`        | Neutral/700         | #404040 |
| `text-color-quaternary`            | `--text-color-quaternary`            | `--color-text-quaternary`            | Neutral/500         | #737373 |
| `text-color-placeholder`           | `--text-color-placeholder`           | `--color-text-placeholder`           | Neutral/500         | #737373 |
| `text-color-white`                 | `--text-color-white`                 | `--color-text-white`                 | Foundations/white   | #FFFFFF |
| `text-color-brand`                 | `--text-color-brand`                 | `--color-text-brand-secondary`       | Primary/700         | #0369A1 |
| `text-color-brand-hover`           | `--text-color-brand-hover`           | `--color-text-brand-secondary_hover` | Primary/800         | #075985 |
| `text-color-brand-strong`          | `--text-color-brand-strong`          | `--color-text-brand-primary`         | Primary/900         | #0C4A6E |
| `text-color-brand-tertiary`        | `--text-color-brand-tertiary`        | `--color-text-brand-tertiary`        | Primary/700         | #0369A1 |
| `text-color-brand-tertiary-alt`    | `--text-color-brand-tertiary-alt`    | `--color-text-brand-tertiary_alt`    | Primary/600         | #0284C7 |
| `text-color-error`                 | `--text-color-error`                 | `--color-text-error-primary`         | Error/600           | #E7000B |
| `text-color-error-hover`           | `--text-color-error-hover`           | `--color-text-error-primary_hover`   | Error/700           | #C10007 |
| `text-color-warning`               | `--text-color-warning`               | `--color-text-warning-primary`       | Warning/600         | #D08700 |
| `text-color-success`               | `--text-color-success`               | `--color-text-success-primary`       | Success/600         | #00A63E |
| `text-color-on-primary`            | `--text-color-on-primary`            | `--color-text-primary_on-brand`      | Foundations/white   | #FFFFFF |
| `text-color-on-primary-secondary`  | `--text-color-on-primary-secondary`  | `--color-text-secondary_on-brand`    | Primary/200         | #BAE6FD |
| `text-color-on-primary-tertiary`   | `--text-color-on-primary-tertiary`   | `--color-text-tertiary_on-brand`     | Primary/200         | #BAE6FD |
| `text-color-on-primary-quaternary` | `--text-color-on-primary-quaternary` | `--color-text-quaternary_on-brand`   | Primary/300         | #7DD3FC |
| `text-color-editor-icon`           | `--text-color-editor-icon`           | `--color-text-editor-icon-fg`        | Neutral/400         | #A1A1A1 |
| `text-color-editor-icon-active`    | `--text-color-editor-icon-active`    | `--color-text-editor-icon-fg_active` | Neutral/500         | #737373 |

### Icon (scope SHAPE_FILL, STROKE_COLOR)

| Token (Figma `icon/…`)             | Code                                 | Untitled UI                        | Trỏ tới           | Hex     |
| ---------------------------------- | ------------------------------------ | ---------------------------------- | ----------------- | ------- |
| `icon-color-primary`               | `--icon-color-primary`               | `--color-fg-primary`               | Neutral/900       | #171717 |
| `icon-color-secondary`             | `--icon-color-secondary`             | `--color-fg-secondary`             | Neutral/700       | #404040 |
| `icon-color-secondary-hover`       | `--icon-color-secondary-hover`       | `--color-fg-secondary_hover`       | Neutral/800       | #262626 |
| `icon-color-tertiary`              | `--icon-color-tertiary`              | `--color-fg-tertiary`              | Neutral/600       | #525252 |
| `icon-color-tertiary-hover`        | `--icon-color-tertiary-hover`        | `--color-fg-tertiary_hover`        | Neutral/700       | #404040 |
| `icon-color-quaternary`            | `--icon-color-quaternary`            | `--color-fg-quaternary`            | Neutral/400       | #A1A1A1 |
| `icon-color-quaternary-hover`      | `--icon-color-quaternary-hover`      | `--color-fg-quaternary_hover`      | Neutral/500       | #737373 |
| `icon-color-white`                 | `--icon-color-white`                 | `--color-fg-white`                 | Foundations/white | #FFFFFF |
| `icon-color-brand`                 | `--icon-color-brand`                 | `--color-fg-brand-primary`         | Primary/700       | #0369A1 |
| `icon-color-brand-alt`             | `--icon-color-brand-alt`             | `--color-fg-brand-primary_alt`     | Primary/700       | #0369A1 |
| `icon-color-brand-secondary`       | `--icon-color-brand-secondary`       | `--color-fg-brand-secondary`       | Primary/500       | #0EA5E9 |
| `icon-color-brand-secondary-alt`   | `--icon-color-brand-secondary-alt`   | `--color-fg-brand-secondary_alt`   | Primary/500       | #0EA5E9 |
| `icon-color-brand-secondary-hover` | `--icon-color-brand-secondary-hover` | `--color-fg-brand-secondary_hover` | Primary/600       | #0284C7 |
| `icon-color-error`                 | `--icon-color-error`                 | `--color-fg-error-primary`         | Error/600         | #E7000B |
| `icon-color-error-secondary`       | `--icon-color-error-secondary`       | `--color-fg-error-secondary`       | Error/500         | #FB2C36 |
| `icon-color-warning`               | `--icon-color-warning`               | `--color-fg-warning-primary`       | Warning/600       | #D08700 |
| `icon-color-warning-secondary`     | `--icon-color-warning-secondary`     | `--color-fg-warning-secondary`     | Warning/500       | #F0B100 |
| `icon-color-success`               | `--icon-color-success`               | `--color-fg-success-primary`       | Success/600       | #00A63E |
| `icon-color-success-secondary`     | `--icon-color-success-secondary`     | `--color-fg-success-secondary`     | Success/500       | #00C950 |

### Surface (scope FRAME_FILL, SHAPE_FILL)

| Token (Figma `surface/…`)            | Code                                   | Untitled UI                       | Trỏ tới             | Hex     |
| ------------------------------------ | -------------------------------------- | --------------------------------- | ------------------- | ------- |
| `surface-color-page`                 | `--surface-color-page`                 | `--color-bg-secondary`            | custom/bg-secondary | #F5FBFF |
| `surface-color-page-hover`           | `--surface-color-page-hover`           | `--color-bg-secondary_hover`      | Neutral/100         | #F5F5F5 |
| `surface-color-grouped`              | `--surface-color-grouped`              | `--color-bg-secondary_alt`        | Neutral/50          | #FAFAFA |
| `surface-color-card`                 | `--surface-color-card`                 | `--color-bg-primary`              | Foundations/white   | #FFFFFF |
| `surface-color-card-alt`             | `--surface-color-card-alt`             | `--color-bg-primary_alt`          | Foundations/white   | #FFFFFF |
| `surface-color-hover`                | `--surface-color-hover`                | `--color-bg-primary_hover`        | Neutral/50          | #FAFAFA |
| `surface-color-sunken`               | `--surface-color-sunken`               | `--color-bg-tertiary`             | Neutral/100         | #F5F5F5 |
| `surface-color-muted`                | `--surface-color-muted`                | `--color-bg-quaternary`           | Neutral/200         | #E5E5E5 |
| `surface-color-selected`             | `--surface-color-selected`             | `--color-bg-active`               | Neutral/50          | #FAFAFA |
| `surface-color-inverse`              | `--surface-color-inverse`              | `--color-bg-primary-solid`        | Neutral/950         | #0A0A0A |
| `surface-color-overlay`              | `--surface-color-overlay`              | `--color-bg-overlay`              | Neutral/950         | #0A0A0A |
| `surface-color-brand-subtle`         | `--surface-color-brand-subtle`         | `--color-bg-brand-primary`        | Primary/50          | #F0F9FF |
| `surface-color-brand-subtle-alt`     | `--surface-color-brand-subtle-alt`     | `--color-bg-brand-primary_alt`    | Primary/50          | #F0F9FF |
| `surface-color-brand-muted`          | `--surface-color-brand-muted`          | `--color-bg-brand-secondary`      | Primary/100         | #E0F2FE |
| `surface-color-brand-section`        | `--surface-color-brand-section`        | `--color-bg-brand-section`        | Primary/800         | #075985 |
| `surface-color-brand-section-subtle` | `--surface-color-brand-section-subtle` | `--color-bg-brand-section_subtle` | Primary/700         | #0369A1 |
| `surface-color-error-subtle`         | `--surface-color-error-subtle`         | `--color-bg-error-primary`        | Error/50            | #FEF2F2 |
| `surface-color-error-muted`          | `--surface-color-error-muted`          | `--color-bg-error-secondary`      | Error/100           | #FFE2E2 |
| `surface-color-warning-subtle`       | `--surface-color-warning-subtle`       | `--color-bg-warning-primary`      | Warning/50          | #FEFCE8 |
| `surface-color-warning-muted`        | `--surface-color-warning-muted`        | `--color-bg-warning-secondary`    | Warning/100         | #FEF9C2 |
| `surface-color-success-subtle`       | `--surface-color-success-subtle`       | `--color-bg-success-primary`      | Success/50          | #F0FDF4 |
| `surface-color-success-muted`        | `--surface-color-success-muted`        | `--color-bg-success-secondary`    | Success/100         | #DCFCE7 |

### Action (scope FRAME_FILL, SHAPE_FILL)

| Token (Figma `action/…`)     | Code                           | Untitled UI                    | Trỏ tới     | Hex     |
| ---------------------------- | ------------------------------ | ------------------------------ | ----------- | ------- |
| `action-color-primary`       | `--action-color-primary`       | `--color-bg-brand-solid`       | Primary/700 | #0369A1 |
| `action-color-primary-hover` | `--action-color-primary-hover` | `--color-bg-brand-solid_hover` | Primary/800 | #075985 |
| `action-color-neutral`       | `--action-color-neutral`       | `--color-bg-secondary-solid`   | Neutral/600 | #525252 |
| `action-color-danger`        | `--action-color-danger`        | `--color-bg-error-solid`       | Error/600   | #E7000B |
| `action-color-danger-hover`  | `--action-color-danger-hover`  | `--color-bg-error-solid_hover` | Error/700   | #C10007 |
| `action-color-warning`       | `--action-color-warning`       | `--color-bg-warning-solid`     | Warning/600 | #D08700 |
| `action-color-success`       | `--action-color-success`       | `--color-bg-success-solid`     | Success/600 | #00A63E |

### Border (scope STROKE_COLOR)

| Token (Figma `border/…`)    | Code                          | Untitled UI                    | Trỏ tới        | Hex         |
| --------------------------- | ----------------------------- | ------------------------------ | -------------- | ----------- |
| `border-color-strong`       | `--border-color-strong`       | `--color-border-primary`       | Neutral/300    | #D4D4D4     |
| `border-color-default`      | `--border-color-default`      | `--color-border-secondary`     | Neutral/200    | #E5E5E5     |
| `border-color-default-alt`  | `--border-color-default-alt`  | `--color-border-secondary_alt` | alpha/black/10 | #000000 10% |
| `border-color-subtle`       | `--border-color-subtle`       | `--color-border-tertiary`      | Neutral/100    | #F5F5F5     |
| `border-color-error`        | `--border-color-error`        | `--color-border-error`         | Error/500      | #FB2C36     |
| `border-color-error-subtle` | `--border-color-error-subtle` | `--color-border-error_subtle`  | Error/300      | #FFA2A2     |
| `border-color-selected`     | `--border-color-selected`     | `--color-border-brand`         | Primary/500    | #0EA5E9     |
| `border-color-brand`        | `--border-color-brand`        | `--color-border-brand_alt`     | Primary/600    | #0284C7     |
| `border-color-focus`        | `--border-color-focus`        | `--color-focus-ring`           | Primary/600    | #0284C7     |
| `border-color-focus-error`  | `--border-color-focus-error`  | `--color-focus-ring-error`     | Error/500      | #FB2C36     |

`utility/<màu>-<bậc>` (15 màu × 50–700, 134 biến) giữ tên Untitled `--color-utility-*`, dùng cho badge và biểu đồ; luôn kèm biểu tượng và chữ (NFR-030).

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

Từ 14/11/2026 cả 45 text style gắn biến: cỡ chữ và line height ở `responsive`, họ font ở `alias/font/font-family-*` (`font-family-primary` cho Inter), độ đậm ở `alias/font/font-weight-*`. Sửa cỡ chữ: sửa biến, không sửa style.

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

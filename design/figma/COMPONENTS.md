# How About Me: components

Nguồn là code. Mỗi component màn dùng có một component trên page `02 Components` của Figma, cùng tên, cùng variant với props trong code. Mọi màu, bo góc, khoảng cách gắn token ở [tokens/TOKENS.md](tokens/TOKENS.md). File Figma: https://www.figma.com/design/jczRPmHz0rLbbGrK1uxqK5, page `02 Components` (`2:3`). Node id và key ghi vào bảng khi dựng (cột trống = chưa dựng). Import từ file khác sau khi publish: `figma.importComponentSetByKeyAsync(key)`; trong file này: `getNodeByIdAsync(id)`.

`pnpm design:check` kiểm mọi đường dẫn `components/…`, `features/…` trong file này có thật dưới `apps/web/src/`.

Quy ước chung:

- Tên Figma theo tên component trong code: `Button`, `Badge`, `SemanticBadge`. Nhóm bằng `/`: `Base/Button`, `App/SemanticBadge`, `Sign/PlaqueButton`.
- Variant lấy đúng giá trị prop (`size = sm | md | lg | xl`, `color = primary | secondary | …`). Thêm `State` (Default, Hover, Focus, Disabled, Loading) cho component bấm được.
- Text property chỉ dùng cho chữ giống nhau mọi variant; chữ riêng của từng màn sửa trực tiếp trên instance.
- Component dùng auto-layout. Chữ do người dùng hoặc hệ thống đặt (nội dung bài, tên truy vấn) xuống tối đa 2 dòng rồi cắt, trừ nơi UX spec cho hiện đủ.
- Component Untitled UI chép từ thư viện Untitled UI Figma nếu có, đổi màu theo biến của repo; không có thì dựng lại theo code.
- Thêm component trong code (`npx untitledui@latest add <tên> --dir apps/web` hoặc tự viết trong `features/`) thì thêm dòng ở đây trong cùng PR.

## Node id theo nhóm

| Nhóm                                 | Section id                                                                           | Page           |
| ------------------------------------ | ------------------------------------------------------------------------------------ | -------------- |
| Base (Untitled UI)                   | Button `5:74`, Badge `5:87`                                                          | 02 Components  |
| Application (Untitled UI)            |                                                                                      | 02 Components  |
| App dùng chung (`features/shared`)   | SemanticBadge `5:114`, StatusPlate `5:132`, PlaqueButton `5:147`, PageBanner `5:195` | 02 Components  |
| Biển hiệu (`Sign/*`)                 | Sign/Board `5:174`                                                                   | 02 Components  |
| Biểu đồ                              |                                                                                      | 02 Components  |
| Foundations: màu, chữ, spacing, bóng | `5:202`                                                                              | 01 Foundations |

## Base (Untitled UI)

| Component       | Code                                              | Variant / trạng thái                                                                                                                                                                                                                | Node id | Key                                        |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| `Button`        | `components/base/buttons/button.tsx`              | Hierarchy: primary, secondary, tertiary, link-color, primary-destructive, secondary-destructive · Size: sm, md · State: Default, Hover, Disabled (36 variant). Label là text property. lg, xl chưa dựng (cùng màu, padding lớn hơn) | `5:74`  | `65f83d9ceb6de06565126ed5369ff554fd2f14fe` |
| `ButtonUtility` | `components/base/buttons/button-utility.tsx`      | Nút chỉ biểu tượng, có tooltip                                                                                                                                                                                                      |         |                                            |
| `ButtonGroup`   | `components/base/button-group/button-group.tsx`   | Nhóm nút chọn                                                                                                                                                                                                                       |         |                                            |
| `Badge`         | `components/base/badges/badges.tsx`               | Color: gray, brand, error, warning, success (pill-color, size sm). Label là text property                                                                                                                                           | `5:87`  | `fc938adfe31bda849bb90b07a32b7b1cf8f4b8d3` |
| `Input`         | `components/base/input/input.tsx`                 | size: sm, md · State: Default, Focus, Filled, Error, Disabled                                                                                                                                                                       |         |                                            |
| `InputTags`     | `components/base/input/input-tags.tsx`            | Nhập nhiều cụm từ                                                                                                                                                                                                                   |         |                                            |
| `Textarea`      | `components/base/textarea/textarea.tsx`           | State như Input                                                                                                                                                                                                                     |         |                                            |
| `Select`        | `components/base/select/select.tsx`               | Có `SelectNative`, `ComboBox`, `MultiSelect` cùng thư mục                                                                                                                                                                           |         |                                            |
| `Checkbox`      | `components/base/checkbox/checkbox.tsx`           | Checked: Off, On, Mixed · State: Default, Disabled                                                                                                                                                                                  |         |                                            |
| `RadioButtons`  | `components/base/radio-buttons/radio-buttons.tsx` | Selected: Off, On                                                                                                                                                                                                                   |         |                                            |
| `Toggle`        | `components/base/toggle/toggle.tsx`               | On: True, False · State: Default, Disabled                                                                                                                                                                                          |         |                                            |
| `Tooltip`       | `components/base/tooltip/tooltip.tsx`             | Định nghĩa chỉ số (UX §2.4)                                                                                                                                                                                                         |         |                                            |
| `Tags`          | `components/base/tags/tags.tsx`                   | Chip bộ lọc                                                                                                                                                                                                                         |         |                                            |
| `Dropdown`      | `components/base/dropdown/dropdown.tsx`           | Menu thao tác                                                                                                                                                                                                                       |         |                                            |

## Application (Untitled UI)

| Component           | Code                                                                          | Ghi chú                                 | Node id | Key |
| ------------------- | ----------------------------------------------------------------------------- | --------------------------------------- | ------- | --- |
| `Table`             | `components/application/table/table.tsx`                                      | Bảng; hàng có Default, Hover, Selected  |         |     |
| `Modal`             | `components/application/modals/modal.tsx`                                     | Hộp thoại: nút phụ trái, nút chính phải |         |     |
| `SlideoutMenu`      | `components/application/slideout-menus/slideout-menu.tsx`                     | Drawer mở từ phải                       |         |     |
| `Tabs`              | `components/application/tabs/tabs.tsx`                                        | Tab trong trang                         |         |     |
| `DateRangePicker`   | `components/application/date-picker/date-range-picker.tsx`                    | Bộ lọc thời gian                        |         |     |
| `Pagination`        | `components/application/pagination`                                           | Phân trang                              |         |     |
| `EmptyState`        | `components/application/empty-state`                                          | Trống, lỗi                              |         |     |
| `LoadingIndicator`  | `components/application/loading-indicator`                                    | Đang tải                                |         |     |
| `SidebarNavigation` | `components/application/app-navigation/sidebar-navigation/sidebar-simple.tsx` | Khung app, đi cùng `AppSidebar`         |         |     |
| `Chart`             | `components/application/charts/charts-base.tsx`                               | Trục, chú thích, tooltip biểu đồ        |         |     |

## App dùng chung (`features/shared`)

| Component           | Code                                     | Ghi chú                                                                                                                                                                                         | Node id | Key                                        |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| `AppSidebar`        | `features/shared/app-sidebar.tsx`        | Điều hướng chính, chọn project                                                                                                                                                                  |         |                                            |
| `ProjectSwitcher`   | `features/shared/project-switcher.tsx`   |                                                                                                                                                                                                 |         |                                            |
| `PageHeader`        | `features/shared/page-header.tsx`        | Tiêu đề trang dạng biển hiệu                                                                                                                                                                    |         |                                            |
| `PageFrame`         | `features/shared/page-frame.tsx`         | Khung nội dung trang                                                                                                                                                                            |         |                                            |
| `PageBanner`        | `features/shared/page-banner.tsx`        | Tone: warning, info, error; vạch trái 2px, biểu tượng + tiêu đề (UX §2.3). Sửa chữ lớp Title, Description                                                                                       | `5:195` | `66224e755d96bed81cdaa64bf6c4b41b98d36760` |
| `SectionTabs`       | `features/shared/section-tabs.tsx`       | Tab theo URL                                                                                                                                                                                    |         |                                            |
| `SemanticBadge`     | `features/shared/semantic-badge.tsx`     | Dimension × Value: Cảm xúc (Tích cực, Trung tính, Tiêu cực), An toàn (An toàn, Nhạy cảm, Nghiêm trọng đặc), Liên quan (Liên quan, Chưa chắc). Biểu tượng + chữ (NFR-030); lớp Icon đang giữ chỗ | `5:114` | `30ec981b599f35f8bb29daea832e952b11b0f56f` |
| `StatusPlate`       | `features/shared/status-plate.tsx`       | Tone: success, error (men đặc), warning, progress, neutral. Chữ sửa trên instance                                                                                                               | `5:132` | `c9afbdc108399fcc7594f6ad60bcbf09220d1808` |
| `PlaqueButton`      | `features/shared/plaque-button.tsx`      | Size: xs, sm, md · State: Default, Hover. Label là text property, style `Sign/Label`                                                                                                            | `5:147` | `8310bd7231d040a6feb93fd546b0fdba9ec56784` |
| `QueryState`        | `features/shared/query-state.tsx`        | Đang tải, trống, lỗi, cũ, một phần (UX §2.3)                                                                                                                                                    |         |                                            |
| `StateIllustration` | `features/shared/state-illustration.tsx` | Hình cho trạng thái trống, lỗi                                                                                                                                                                  |         |                                            |
| `DetailSlideout`    | `features/shared/detail-slideout.tsx`    | Drawer chi tiết bài, lượt đồng bộ                                                                                                                                                               |         |                                            |
| `HealthStrip`       | `features/shared/health-strip.tsx`       | Dải tình trạng thu thập                                                                                                                                                                         |         |                                            |
| `CopyLinkButton`    | `features/shared/copy-link-button.tsx`   |                                                                                                                                                                                                 |         |                                            |
| `AppToaster`        | `features/shared/app-toaster.tsx`        | Toast                                                                                                                                                                                           |         |                                            |
| `SettingsDialog`    | `features/shared/settings-dialog.tsx`    |                                                                                                                                                                                                 |         |                                            |

## Biển hiệu (`Sign/*`, landing)

Đặc tả đủ ở frontmatter `components` của `apps/web/DESIGN.md`.

| Component       | Code                                     | Variant                                                                                                              | Node id | Key                                        |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| `Sign/Board`    | `features/landing/landing-board.tsx`     | Tone: neutral, negative-solid, positive-solid, negative-mixed, positive-mixed, blank. Sửa chữ lớp Phrase, Share line | `5:174` | `08e30cdb0bb56a9de10c0a80cbc54679d33f8ac5` |
| `Sign/MainSign` | `features/landing/landing-main-sign.tsx` | Biển chính, biển cửa                                                                                                 |         |                                            |

## Theo màn

Component chỉ một màn dùng vẫn có trên Figma khi màn đó được dựng; ghi vào nhóm của màn.

| Màn                        | Thư mục code                 | Component chính                                                             |
| -------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Tổng quan, Cụm từ          | `features/analytics`         | `FilterBar`, `KpiCard`, biểu đồ trong `charts/`, `TermHero`                 |
| Bài nhắc tới, Chi tiết bài | `features/mentions`          | `MentionRow`, `MentionsToolbar`, `MentionDetail`, `OverrideForm`            |
| Rà soát                    | `features/reviews`           | `ReviewTable`, `ReviewCard`, `SelectionBar`                                 |
| Truy vấn theo dõi          | `features/listening-queries` | `QueriesTable`, `QueryFormDrawer`, `BackfillDialog`                         |
| Trạng thái hệ thống        | `features/system-status`     | `OverviewCards`, `SyncJobsTable`, `SyncJobDrawer`, `AuditLogTable`          |
| Cài đặt                    | `features/settings`          | `SettingsTabs`, `MembersTable`, `ThreadsIntegrationCard`, `SettingsSaveBar` |
| Đăng nhập                  | `features/auth`              | `LoginForm`                                                                 |
| Landing                    | `features/landing`           | `LandingView`                                                               |

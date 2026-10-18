# Onboarding stakeholder — v0.1.0

Buổi 30 phút để giới thiệu How About Me v0.1.0. Đọc trước: [release notes](07-release-notes-v0.1.0.md), [glossary](../01-product/06-business-rules-glossary.md#2-glossary).

## 1. Agenda (30 phút)

| Thời lượng | Nội dung                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| 5'         | Bối cảnh: mục tiêu social listening, dự án `1Zone / Eventista`                    |
| 15'        | Demo: Overview → Mentions (lọc, chi tiết, override) → Reviews → Listening Queries |
| 5'         | Glossary (Mention, Key phrase, Relevance, Review queue…), known limitations       |
| 5'         | Q&A, ghi feedback                                                                 |

## 2. Checklist trước buổi

- [ ] Chốt ngày giờ và danh sách người tham dự.
- [ ] Mỗi người có tài khoản với đúng role (Admin / Analyst / Viewer).
- [ ] Môi trường demo đã có dữ liệu. Demo seed (`pnpm db:seed`, #296) **chỉ dùng cho local**, không chạy trên production.
- [ ] Trên GitHub đã có label `feedback` và milestone `M6`.
- [ ] Gửi link release notes và glossary trước buổi.

## 3. Template ghi feedback

| #   | Người nói | Màn hình | Mô tả | Mức độ (cao / trung bình / thấp) | Issue |
| --- | --------- | -------- | ----- | -------------------------------- | ----- |
| 1   |           |          |       |                                  |       |

Sau buổi, mỗi dòng thành một issue:

```bash
gh issue create --milestone M6 --label feedback --title "[feedback] <tóm tắt>" --body "<mô tả, màn hình, mức độ>"
```

Không ghi token, mật khẩu hay nội dung bài Threads thật vào issue.

## 4. Kết quả buổi

_Điền sau buổi: ngày, người tham dự, danh sách issue đã tạo._

"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { LinkExternal01 } from "@untitledui/icons";
import { Badge } from "@/components/base/badges/badges";
import { mediaTypeLabel } from "@/lib/semantics/labels";
import { formatDateTime, formatRelativeOrAbsolute, tzLabel } from "@/lib/time/format";
import { safePermalink } from "../mention-row";
import { Disclosure } from "./disclosure";
import { linkify } from "./linkify";

function ExternalLink({ href, children }: { href: string; children: string }) {
  // FR-157: external links always open in a new tab without opener/referrer.
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 break-all text-brand-secondary underline"
    >
      {children}
      <LinkExternal01 className="size-3 shrink-0" aria-hidden />
    </a>
  );
}

function When({ iso, tz }: { iso: string; tz: string }) {
  return (
    <time dateTime={iso} title={`${formatDateTime(iso, tz)} (${tzLabel(tz)})`}>
      {formatRelativeOrAbsolute(iso, new Date(), tz)}
    </time>
  );
}

/** FR-158: post text is rendered as plain text; only http(s) URLs become links. */
export function PlainText({ text }: { text: string }) {
  return (
    <p className="text-md whitespace-pre-wrap break-words text-primary" data-testid="mention-text">
      {linkify(text).map((p, i) => {
        // Only https URLs become links (same rule as the permalink); anything else stays text.
        const href = p.kind === "link" ? safePermalink(p.value) : null;
        return href ? (
          <ExternalLink key={i} href={href}>
            {p.value}
          </ExternalLink>
        ) : (
          <span key={i}>{p.value}</span>
        );
      })}
    </p>
  );
}

/** Left column of the mention detail — UX §3.4 "Original". */
export function OriginalPanel({ mention: m, tz }: { mention: MentionDetail; tz: string }) {
  const attachment = safePermalink(m.linkAttachmentUrl);
  const thumb = safePermalink(m.thumbnailUrl ?? m.mediaUrl);
  return (
    <section aria-label="Bài gốc" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-primary">{m.username ? `@${m.username}` : "—"}</span>
        <span className="text-tertiary">
          <When iso={m.publishedAt} tz={tz} />
        </span>
        {m.isQuotePost || m.quotedPostId ? (
          <Badge type="modern" color="gray" size="sm">
            Trích dẫn
          </Badge>
        ) : null}
        {m.repostedPostId ? (
          <Badge type="modern" color="gray" size="sm">
            Đăng lại
          </Badge>
        ) : null}
      </div>
      {m.text ? <PlainText text={m.text} /> : <p className="text-sm text-quaternary">Không có nội dung</p>}
      {/* #338: never show the raw enum; a plain text post has no media line at all. */}
      {m.mediaType && m.mediaType !== "TEXT_POST" ? (
        <div className="flex flex-col gap-2 text-sm text-tertiary">
          <span>Phương tiện: {mediaTypeLabel(m.mediaType)}</span>
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Threads CDN, not optimisable
            <img
              src={thumb}
              alt={m.altText ?? "Ảnh/video trong bài"}
              className="max-h-64 w-fit rounded-lg object-contain"
            />
          ) : null}
          {m.altText ? <span>Mô tả ảnh: {m.altText}</span> : null}
        </div>
      ) : null}
      {attachment ? (
        <div className="text-sm">
          Liên kết: <ExternalLink href={attachment}>{attachment}</ExternalLink>
        </div>
      ) : null}
      {m.matchedQueries.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-tertiary">Truy vấn khớp</span>
          <div className="flex flex-wrap gap-1.5">
            {m.matchedQueries.map((q) => (
              // FR-059 / TC-MEN-021: queries whose exclude terms matched are shown here, labelled "excluded".
              <Badge key={q.id} type="pill-color" color={q.excludedByTerms ? "gray" : "brand"} size="sm">
                {q.excludedByTerms ? `${q.displayName} (đã loại trừ)` : q.displayName}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      {/* #338: technical post metadata is folded away by default. */}
      <Disclosure label="Thông tin bài">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-tertiary">
          <dt>Loại bài</dt>
          <dd>{m.mediaType ? mediaTypeLabel(m.mediaType) : "—"}</dd>
          <dt>ID bài</dt>
          <dd className="font-mono">{m.platformPostId}</dd>
          <dt>Thấy lần đầu</dt>
          <dd>
            <When iso={m.firstSeenAt} tz={tz} />
          </dd>
          <dt>Thấy lần cuối</dt>
          <dd>
            <When iso={m.lastSeenAt} tz={tz} />
          </dd>
          <dt>Bản sửa</dt>
          <dd>{m.revision}</dd>
        </dl>
      </Disclosure>
    </section>
  );
}

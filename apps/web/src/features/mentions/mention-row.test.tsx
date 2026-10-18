import { fireEvent, render, screen } from "@testing-library/react";
import { seriousViolations } from "@/test/axe";
import { describe, expect, it, vi } from "vitest";
import { mentionFixture, uuid } from "./fixtures.test-utils";
import { MentionRow, safePermalink } from "./mention-row";

const TZ = "Asia/Ho_Chi_Minh";
const lab = <T extends string>(label: T) => ({ label, confidence: 0.7 });

describe("MentionRow (UX §3.3)", () => {
  it("TC-MEN-002: shows user, time, text, badges; caps intents/topics at 2; status only when not completed", () => {
    const item = mentionFixture({
      analysis: {
        intents: [lab("complaint"), lab("question"), lab("boycott")],
        topics: [lab("price"), lab("ticket")],
        safety: { level: "sensitive" },
      },
    });
    const { container } = render(<MentionRow item={item} tz={TZ} href="/mentions/x" onOpen={() => {}} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(item.publishedAt);
    expect(screen.getByText("Giá vé concert quá cao")).toBeInTheDocument();
    expect(screen.getByText("Phàn nàn")).toBeInTheDocument();
    expect(screen.getByText("Câu hỏi")).toBeInTheDocument();
    expect(screen.queryByText("Tẩy chay")).toBeNull();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("Giá")).toBeInTheDocument();
    expect(screen.queryByText(/^Completed$/i)).toBeNull();
  });

  it("TC-MEN-002 / #338: failed analysis shows a Vietnamese error label (code in title) and Lần trước:", () => {
    const item = mentionFixture({ analysis: { status: "failed", errorCode: "LLM_TIMEOUT" } });
    render(<MentionRow item={item} tz={TZ} href="/mentions/x" onOpen={() => {}} />);
    expect(screen.getByText("Bộ phân tích phản hồi quá lâu")).toHaveAttribute("title", "LLM_TIMEOUT");
    expect(screen.queryByText("LLM_TIMEOUT")).toBeNull();
    expect(screen.getByText("Lần trước:")).toBeInTheDocument();
  });

  it("TC-MEN-015: external link opens a new tab safely and does not open detail", () => {
    const onOpen = vi.fn();
    render(<MentionRow item={mentionFixture()} tz={TZ} href="/mentions/x" onOpen={onOpen} />);
    const a = screen.getByRole("link", { name: "Mở trên Threads" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(a);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("FR-157: non-https permalinks are not rendered", () => {
    expect(safePermalink("javascript:alert(1)")).toBeNull();
    expect(safePermalink("not a url")).toBeNull();
    render(
      <MentionRow
        item={mentionFixture({ permalink: "javascript:alert(1)" })}
        tz={TZ}
        href="/mentions/x"
        onOpen={() => {}}
      />,
    );
    expect(screen.queryByRole("link", { name: "Mở trên Threads" })).toBeNull();
  });

  it("TC-MEN-016: HTML in post text renders as text, never as markup", () => {
    const evil = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <MentionRow item={mentionFixture({ text: evil })} query="img" tz={TZ} href="/mentions/x" onOpen={() => {}} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("mark")?.textContent).toBe("img");
    expect(container.textContent).toContain('src=x onerror="alert(1)">');
  });

  it("TC-MEN-021: queries excluded by terms are not shown as chips", () => {
    const item = mentionFixture({
      matchedQueries: [
        { id: uuid(901), displayName: "Brand A", queryType: "keyword", excludedByTerms: false },
        { id: uuid(902), displayName: "Brand B", queryType: "keyword", excludedByTerms: true },
      ],
    });
    render(<MentionRow item={item} tz={TZ} href="/mentions/x" onOpen={() => {}} />);
    expect(screen.getByText("Brand A")).toBeInTheDocument();
    expect(screen.queryByText("Brand B")).toBeNull();
  });
});

describe("MentionRow — real link (#326)", () => {
  const rowLink = () => screen.getByRole("link", { name: /Bài nhắc của/ });

  it("renders one row link with the full-page href and no nested anchors", () => {
    const { container } = render(<MentionRow item={mentionFixture()} tz={TZ} href="/mentions/abc?preset=7d" />);
    expect(rowLink()).toHaveAttribute("href", "/mentions/abc?preset=7d");
    expect(container.querySelector("a a")).toBeNull();
  });

  it("plain left-click calls onOpen and prevents navigation", () => {
    const onOpen = vi.fn();
    const item = mentionFixture();
    render(<MentionRow item={item} tz={TZ} href="/mentions/x" onOpen={onOpen} />);
    expect(fireEvent.click(rowLink())).toBe(false);
    expect(onOpen).toHaveBeenCalledWith(item.id);
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }])(
    "modifier/middle click %o lets the browser open the link",
    (init) => {
      const onOpen = vi.fn();
      render(<MentionRow item={mentionFixture()} tz={TZ} href="/mentions/x" onOpen={onOpen} />);
      expect(fireEvent.click(rowLink(), init)).toBe(true);
      expect(onOpen).not.toHaveBeenCalled();
    },
  );

  it("without onOpen the click navigates normally", () => {
    render(<MentionRow item={mentionFixture()} tz={TZ} href="/mentions/x" />);
    expect(fireEvent.click(rowLink())).toBe(true);
  });
});

describe("MentionRow — axe (#95, NFR-031)", () => {
  it("has no serious/critical axe violations", async () => {
    const { container } = render(
      <main>
        <MentionRow item={mentionFixture()} tz={TZ} href="/mentions/x" onOpen={() => {}} />
      </main>,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});

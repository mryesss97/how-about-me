import { fireEvent, render, screen } from "@testing-library/react";
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
    const { container } = render(<MentionRow item={item} tz={TZ} onOpen={() => {}} />);
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

  it("TC-MEN-002: failed analysis shows status badge and error code", () => {
    const item = mentionFixture({ analysis: { status: "failed", errorCode: "AI_TIMEOUT", sentiment: null } });
    render(<MentionRow item={item} tz={TZ} onOpen={() => {}} />);
    expect(screen.getByText("AI_TIMEOUT")).toBeInTheDocument();
  });

  it("TC-MEN-015: external link opens a new tab safely and does not open detail", () => {
    const onOpen = vi.fn();
    render(<MentionRow item={mentionFixture()} tz={TZ} onOpen={onOpen} />);
    const a = screen.getByRole("link", { name: "Mở trên Threads" });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(a);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("FR-157: non-https permalinks are not rendered", () => {
    expect(safePermalink("javascript:alert(1)")).toBeNull();
    expect(safePermalink("not a url")).toBeNull();
    render(<MentionRow item={mentionFixture({ permalink: "javascript:alert(1)" })} tz={TZ} onOpen={() => {}} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("TC-MEN-016: HTML in post text renders as text, never as markup", () => {
    const evil = '<img src=x onerror="alert(1)">';
    const { container } = render(
      <MentionRow item={mentionFixture({ text: evil })} query="img" tz={TZ} onOpen={() => {}} />,
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
    render(<MentionRow item={item} tz={TZ} onOpen={() => {}} />);
    expect(screen.getByText("Brand A")).toBeInTheDocument();
    expect(screen.queryByText("Brand B")).toBeNull();
  });
});

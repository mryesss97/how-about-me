import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seriousViolations } from "@/test/axe";
import { reviewFixture } from "./fixtures.test-utils";
import { ReviewCard } from "./review-card";

function setup(over: Parameters<typeof reviewFixture>[0] = {}, selectable = true) {
  const item = reviewFixture(over);
  const r = render(
    <ul>
      <li>
        <ReviewCard
          item={item}
          tz="Asia/Ho_Chi_Minh"
          selectable={selectable}
          selected={false}
          disabled={false}
          showReviewed={false}
          onToggle={vi.fn()}
          onOpen={vi.fn()}
          onKeyDown={vi.fn()}
        />
      </li>
    </ul>,
  );
  return { ...r, item, card: screen.getByTestId("review-card") };
}

// #339 (UX §3.8 Mobile): review card below md.
describe("ReviewCard (#339)", () => {
  it("shows reasons, verdicts and confidence with band (BR-020); labels carry meaning, not colour (UX §2.2)", () => {
    const { card } = setup({ reasons: ["uncertain", "low_confidence"], analysis: { relevance: "relevant" } });
    expect(within(card).getByText("Chưa chắc")).toBeInTheDocument();
    expect(within(card).getByText("Độ tin cậy thấp")).toBeInTheDocument();
    expect(within(card).getByText("42,0%")).toBeInTheDocument();
    expect(within(card).getByText("Thấp")).toBeInTheDocument();
  });

  it("failed: Vietnamese error label with the code in title, Lần trước:", () => {
    const { card } = setup({ reasons: ["failed"], analysis: { status: "failed", errorCode: "LLM_TIMEOUT" } });
    expect(within(card).getByText("Bộ phân tích phản hồi quá lâu")).toHaveAttribute("title", "LLM_TIMEOUT");
    expect(within(card).getByText("Lần trước:")).toBeInTheDocument();
  });

  it("checkbox has a 44px hit area; no checkbox for viewers (FR-015)", () => {
    const { card, item, unmount } = setup();
    const box = within(card).getByLabelText(`Chọn mục của @${item.username}`);
    expect(box.closest(".size-11")).not.toBeNull();
    unmount();
    setup({}, false);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("has no serious axe violations", async () => {
    const { container } = setup();
    expect(await seriousViolations(container)).toEqual([]);
  });
});

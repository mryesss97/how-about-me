import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewNote } from "./review-note";

const ID = "00000000-0000-4000-8000-000000000001";

// #339 (UX §3.4, FR-195, BR-040): pending review note on mention detail.
describe("ReviewNote (#339)", () => {
  it("unreviewed → reasons + link to the queue item", () => {
    render(
      <ReviewNote
        mentionId={ID}
        review={{ reasons: ["uncertain", "low_confidence"], status: "unreviewed", reviewedAt: null }}
      />,
    );
    expect(screen.getByText("Đang chờ xem lại · Chưa chắc, Độ tin cậy thấp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở trong Cần xem lại" })).toHaveAttribute(
      "href",
      `/reviews?reason=uncertain&item=${ID}`, // #390: first reason narrows the queue
    );
  });

  it("reviewed / null / absent → nothing", () => {
    const { container, rerender } = render(
      <ReviewNote
        mentionId={ID}
        review={{ reasons: ["failed"], status: "reviewed", reviewedAt: "2026-10-13T03:00:00.000Z" }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<ReviewNote mentionId={ID} review={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ReviewNote mentionId={ID} review={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

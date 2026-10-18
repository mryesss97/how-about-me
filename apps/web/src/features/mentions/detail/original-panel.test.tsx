import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { detailFixture, uuid } from "./fixtures.test-utils";
import { linkify } from "./linkify";
import { OriginalPanel } from "./original-panel";

const TZ = "Asia/Ho_Chi_Minh";

describe("linkify", () => {
  it("splits URLs and strips trailing punctuation", () => {
    expect(linkify("see https://a.b/c. ok")).toEqual([
      { kind: "text", value: "see " },
      { kind: "link", value: "https://a.b/c" },
      { kind: "text", value: ". ok" },
    ]);
  });
});

describe("OriginalPanel", () => {
  it("renders HTML in post text verbatim, never as markup (FR-158)", () => {
    const { container } = render(
      <OriginalPanel mention={detailFixture({ text: "<script>alert(1)</script><b>x</b>" })} tz={TZ} />,
    );
    expect(screen.getByTestId("mention-text")).toHaveTextContent("<script>alert(1)</script><b>x</b>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("opens https links in a new tab with noopener noreferrer (FR-157); other schemes stay text", () => {
    render(<OriginalPanel mention={detailFixture({ text: "a https://x.com/p b javascript:alert(1)" })} tz={TZ} />);
    const link = screen.getByRole("link", { name: /https:\/\/x.com\/p/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows quote/repost indicators", () => {
    render(<OriginalPanel mention={detailFixture({ isQuotePost: true, repostedPostId: "r1" })} tz={TZ} />);
    expect(screen.getByText("Trích dẫn")).toBeInTheDocument();
    expect(screen.getByText("Đăng lại")).toBeInTheDocument();
  });

  it("shows queries matched only via exclude terms, labelled excluded (FR-059, TC-MEN-021)", () => {
    const mq = [
      { id: uuid(901), displayName: "Concert", queryType: "keyword" as const, excludedByTerms: false },
      { id: uuid(902), displayName: "Ticket", queryType: "keyword" as const, excludedByTerms: true },
    ];
    render(<OriginalPanel mention={detailFixture({ matchedQueries: mq })} tz={TZ} />);
    expect(screen.getByText("Concert")).toBeInTheDocument();
    expect(screen.getByText("Ticket (đã loại trừ)")).toBeInTheDocument();
  });

  it("#338: media type is Vietnamese, never the raw enum; TEXT_POST has no media line", () => {
    const { container, unmount } = render(<OriginalPanel mention={detailFixture({ mediaType: "IMAGE" })} tz={TZ} />);
    expect(screen.getByText("Phương tiện: Ảnh")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("IMAGE");
    unmount();
    const r = render(<OriginalPanel mention={detailFixture({ mediaType: "TEXT_POST" })} tz={TZ} />);
    expect(screen.queryByText(/Phương tiện/)).toBeNull();
    expect(r.container).not.toHaveTextContent("TEXT_POST");
  });

  it("#338: Thông tin bài is folded by default and shows post metadata when opened", () => {
    render(<OriginalPanel mention={detailFixture({ platformPostId: "post-77", mediaType: "TEXT_POST" })} tz={TZ} />);
    const toggle = screen.getByRole("button", { name: "Thông tin bài" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("post-77")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("post-77")).toBeInTheDocument();
    expect(screen.getByText("Bản sửa")).toBeInTheDocument();
    expect(screen.getByText("Văn bản")).toBeInTheDocument();
  });
});

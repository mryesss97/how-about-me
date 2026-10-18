import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queryFixture } from "./fixtures.test-utils";
import { QueriesListMobile } from "./queries-list-mobile";

const NOW = new Date("2026-10-13T03:05:00.000Z");
const renderCards = (items = [queryFixture()], isAdmin = false) =>
  render(<QueriesListMobile items={items} tz="Asia/Ho_Chi_Minh" isAdmin={isAdmin} now={NOW} onToggle={() => {}} />);

describe("QueriesListMobile (#340 ops-2)", () => {
  it("card shows name, status text (BR-017), Bài khớp mới counts + link and a 44px menu trigger", () => {
    const q = queryFixture();
    renderCards([q]);
    const card = within(screen.getByTestId(`query-card-${q.id}`));
    expect(card.getByText(q.displayName)).toBeInTheDocument();
    expect(card.getByText("Thành công")).toBeInTheDocument();
    expect(card.getByText("Bài khớp mới")).toBeInTheDocument();
    // #391 / BR-016: counts are not links; the separate link spans every relevance label.
    expect(card.getByRole("button", { name: /^12: .*không liên quan/ })).toBeInTheDocument();
    const link = card.getByRole("link", { name: `Xem bài nhắc của ${q.displayName}` });
    expect(link).toHaveAttribute(
      "href",
      `/mentions?queryIds=${q.id}&preset=30d&relevance=relevant,uncertain,irrelevant`,
    );
    expect(link).toHaveClass("min-h-11");
    expect(card.getByRole("button", { name: `Thao tác cho ${q.displayName}` })).toHaveClass("size-11");
  });

  it("BR-033: admin gets a labelled toggle; viewer reads Bật/Tắt text", () => {
    const q = queryFixture();
    const { unmount } = renderCards([q], true);
    expect(screen.getByRole("switch", { name: `Bật ${q.displayName}` })).toBeInTheDocument();
    unmount();
    renderCards([q], false);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(within(screen.getByTestId(`query-card-${q.id}`)).getByText("Bật")).toBeInTheDocument();
  });
});

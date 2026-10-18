import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseMentionItem, useMentionItem, withoutItem } from "./use-mention-item";

const ID = "22222222-2222-4222-8222-222222222222";
const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
let searchState = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back }),
  useSearchParams: () => new URLSearchParams(searchState),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  back.mockReset();
  searchState = "preset=7d&sentiment=negative";
});

describe("useMentionItem (#326, UX §3.4)", () => {
  it("parses only UUID items", () => {
    expect(parseMentionItem(new URLSearchParams(`item=${ID}`))).toBe(ID);
    expect(parseMentionItem(new URLSearchParams("item=abc"))).toBeNull();
    expect(parseMentionItem(null)).toBeNull();
    expect(withoutItem(`a=1&item=${ID}`)).toBe("a=1");
  });

  it("openItem pushes `item` keeping filters and scroll", () => {
    const { result } = renderHook(() => useMentionItem());
    act(() => result.current.openItem(ID));
    expect(push).toHaveBeenCalledWith(`/mentions?preset=7d&sentiment=negative&item=${ID}`, { scroll: false });
  });

  it("closeItem goes back after this view pushed the entry", () => {
    const { result } = renderHook(() => useMentionItem());
    act(() => result.current.openItem(ID));
    act(() => result.current.closeItem());
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("closeItem on a deep link replaces without `item`", () => {
    searchState = `preset=7d&item=${ID}`;
    const { result } = renderHook(() => useMentionItem());
    expect(result.current.item).toBe(ID);
    act(() => result.current.closeItem());
    expect(replace).toHaveBeenCalledWith("/mentions?preset=7d", { scroll: false });
  });

  it("detailHref drops `item`", () => {
    searchState = `preset=7d&item=${ID}`;
    const { result } = renderHook(() => useMentionItem());
    expect(result.current.detailHref(ID)).toBe(`/mentions/${ID}?preset=7d`);
  });
});

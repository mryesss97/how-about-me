import { describe, expect, it } from "vitest";
import { carryFilterQuery } from "./carry";

// #331: sidebar carries shared filter keys
describe("carryFilterQuery", () => {
  it("keeps only the six shared keys verbatim", () => {
    const sp = new URLSearchParams(
      "preset=custom&from=a&to=b&tz=UTC&queryIds=q1,q2&relevance=relevant&sentiment=negative&q=x&sort=new&term=vé&phrase=p&compare=true&item=1",
    );
    expect(carryFilterQuery(sp)).toBe("?preset=custom&from=a&to=b&tz=UTC&queryIds=q1%2Cq2&relevance=relevant");
  });
  it("returns empty string when nothing is shared", () => {
    expect(carryFilterQuery(new URLSearchParams("sentiment=negative"))).toBe("");
    expect(carryFilterQuery(null)).toBe("");
  });
});

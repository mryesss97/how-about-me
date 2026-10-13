import { QueryType, SearchMode } from "@prisma/client";
import { normalizeQuery } from "./normalize-query";

describe("normalizeQuery", () => {
  it("BR-004: strips leading '#'", () => {
    expect(normalizeQuery({ queryValue: "#1zone", queryType: QueryType.topic_tag }).queryValue).toBe("1zone");
    expect(normalizeQuery({ queryValue: "##x", queryType: QueryType.topic_tag }).queryValue).toBe("x");
  });
  it("BR-004: trims surrounding whitespace", () => {
    expect(normalizeQuery({ queryValue: "  #eventista  ", queryType: QueryType.keyword }).queryValue).toBe("eventista");
  });
  it("BR-005: keyword → KEYWORD, topic_tag → TAG", () => {
    expect(normalizeQuery({ queryValue: "a", queryType: QueryType.keyword }).searchMode).toBe(SearchMode.KEYWORD);
    expect(normalizeQuery({ queryValue: "a", queryType: QueryType.topic_tag }).searchMode).toBe(SearchMode.TAG);
  });
});

import { checkMetricsToken, extractMetricsToken } from "./metrics-token";

/** FR-174 / TC-SYS-010: scrape token check. */
describe("metrics token", () => {
  it("extracts Bearer and x-metrics-token", () => {
    expect(extractMetricsToken("Bearer abc", undefined)).toBe("abc");
    expect(extractMetricsToken(undefined, "xyz")).toBe("xyz");
    expect(extractMetricsToken("Basic foo", undefined)).toBeUndefined();
    expect(extractMetricsToken(undefined, undefined)).toBeUndefined();
  });

  it("missing / invalid / ok; differing lengths do not throw", () => {
    expect(checkMetricsToken(undefined, "secret")).toBe("missing");
    expect(checkMetricsToken("nope!!", "secret")).toBe("invalid");
    expect(checkMetricsToken("x", "secret")).toBe("invalid");
    expect(checkMetricsToken("secret", "secret")).toBe("ok");
  });
});

import { AppError } from "../../common/errors/app.error";
import { RejectImmutableFieldsPipe } from "./reject-immutable-fields.pipe";

describe("RejectImmutableFieldsPipe (BR-009, FR-054)", () => {
  const pipe = new RejectImmutableFieldsPipe();
  const caught = (v: unknown): AppError => {
    try {
      pipe.transform(v);
    } catch (e) {
      if (e instanceof AppError) return e;
    }
    throw new Error("expected AppError");
  };

  it("BR-009: rejects queryValue with QUERY_IMMUTABLE_FIELD", () => {
    const e = caught({ queryValue: "x" });
    expect(e.code).toBe("QUERY_IMMUTABLE_FIELD");
    expect(e.status).toBe(400);
    expect(e.details).toEqual({ fields: ["queryValue"] });
  });
  it("BR-009: lists both fields, even when null", () => {
    expect(caught({ queryValue: null, queryType: "keyword", displayName: "y" }).details).toEqual({
      fields: ["queryValue", "queryType"],
    });
  });
  it("passes mutable-only bodies and non-objects through untouched", () => {
    const body = { displayName: "y" };
    expect(pipe.transform(body)).toBe(body);
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform("str")).toBe("str");
    expect(pipe.transform([1])).toEqual([1]);
  });
});

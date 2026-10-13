import { OverrideSchema } from "@how-about-me/contracts";
import { toOverrideDto, unwrapValue } from "./overrides.mapper";

const U = "00000000-0000-7000-8000-000000000003";
const R = "00000000-0000-7000-8000-000000000006";

/** T-142 — FR-193 history projection. */
describe("toOverrideDto", () => {
  it("unwraps { value }, ISO UTC timestamps, user refs (missing profile → null)", () => {
    const dto = toOverrideDto({
      row: {
        id: "00000000-0000-7000-8000-000000000005",
        postId: "00000000-0000-7000-8000-000000000002",
        field: "intents",
        previousValue: { value: ["praise"] },
        overrideValue: { value: ["complaint"] },
        reason: "r",
        reviewedBy: U,
        createdAt: new Date("2026-10-13T01:02:03Z"),
        revokedAt: new Date("2026-10-13T02:00:00Z"),
        revokedBy: R,
      },
      users: new Map([[U, { id: U, displayName: null, email: "a@x.io" }]]),
    });
    expect(OverrideSchema.parse(dto)).toEqual(dto);
    expect(dto).toMatchObject({
      previousValue: ["praise"],
      value: ["complaint"],
      reviewedBy: { id: U, displayName: null, email: "a@x.io" },
      revokedBy: null,
      createdAt: "2026-10-13T01:02:03.000Z",
      revokedAt: "2026-10-13T02:00:00.000Z",
    });
  });

  it("null / malformed jsonb → null", () => {
    expect(unwrapValue(null)).toBeNull();
    expect(unwrapValue("x")).toBeNull();
  });
});

import { z, ZodError } from "zod";
import { zod } from "./zod-validation.pipe";

describe("ZodValidationPipe (NFR-015)", () => {
  const schema = z.object({ limit: z.coerce.number().int().max(100), items: z.array(z.object({ name: z.string() })) });

  it("returns parsed + coerced data", () => {
    const out = zod(schema).transform({ limit: "10", items: [{ name: "a" }] });
    expect(out).toEqual({ limit: 10, items: [{ name: "a" }] });
  });

  it("throws ZodError with field paths", () => {
    try {
      zod(schema).transform({ limit: "500", items: [{}] });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ZodError);
      const paths = (e as ZodError).issues.map((i) => i.path.join("."));
      expect(paths).toEqual(expect.arrayContaining(["limit", "items.0.name"]));
    }
  });
});

import { EvalArgsError, parseEvalArgs } from "./eval-classifier";

describe("parseEvalArgs (T-079)", () => {
  it("parses flags with defaults", () => {
    expect(parseEvalArgs(["--", "--dataset", "d.jsonl", "--limit", "5", "--fail-on-gate"])).toEqual({
      dataset: "d.jsonl",
      limit: 5,
      concurrency: 2,
      failOnGate: true,
    });
  });

  it("requires --dataset and rejects unknown flags / bad numbers", () => {
    expect(() => parseEvalArgs([])).toThrow(EvalArgsError);
    expect(() => parseEvalArgs(["--dataset", "d", "--nope"])).toThrow(EvalArgsError);
    expect(() => parseEvalArgs(["--dataset", "d", "--concurrency", "0"])).toThrow(EvalArgsError);
  });
});

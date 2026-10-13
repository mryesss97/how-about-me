import { parsePurgeArgs, PurgeArgsError } from "./purge";

const PID = "0192a5e4-0000-7000-8000-000000000001";

/** T-126 (NFR-054, NFR-072): purge CLI argument parsing. */
describe("parsePurgeArgs (T-126)", () => {
  it("defaults to dry run, batch 1000, platform threads", () => {
    expect(parsePurgeArgs(["--", "--post", "tp-1"])).toEqual({
      target: { scope: "post", platform: "threads", platformPostId: "tp-1" },
      apply: false,
      batchSize: 1000,
      actorUserId: null,
    });
  });

  it("project scope parses --before as UTC midnight (exclusive bound)", () => {
    const a = parsePurgeArgs(["--project", PID, "--before", "2025-09-01", "--apply", "--batch-size", "2"]);
    expect(a.target).toEqual({ scope: "project", projectId: PID, before: new Date("2025-09-01T00:00:00.000Z") });
    expect(a.apply).toBe(true);
    expect(a.batchSize).toBe(2);
  });

  it("sync-jobs scope with optional --project and --actor", () => {
    const a = parsePurgeArgs(["--sync-jobs", "--before", "2026-03-01", "--project", PID, "--actor", PID]);
    expect(a.target).toEqual({ scope: "sync-jobs", projectId: PID, before: new Date("2026-03-01T00:00:00Z") });
    expect(a.actorUserId).toBe(PID);
  });

  it.each([
    ["--project without --before", ["--project", PID]],
    ["--sync-jobs without --before", ["--sync-jobs"]],
    ["several scopes", ["--post", "x", "--sync-jobs", "--before", "2026-01-01"]],
    ["--post with --project", ["--post", "x", "--project", PID]],
    ["bad date format", ["--project", PID, "--before", "01/09/2025"]],
    ["impossible date", ["--project", PID, "--before", "2025-02-30"]],
    ["batch size too large", ["--post", "x", "--batch-size", "5001"]],
    ["batch size zero", ["--post", "x", "--batch-size", "0"]],
    ["non-uuid project", ["--project", "abc", "--before", "2025-01-01"]],
    ["no scope", ["--apply"]],
    ["unknown flag", ["--post", "x", "--force"]],
    ["missing value", ["--post"]],
  ])("rejects %s", (_name, argv) => {
    expect(() => parsePurgeArgs(argv)).toThrow(PurgeArgsError);
  });
});

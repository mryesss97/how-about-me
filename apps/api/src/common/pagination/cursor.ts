import { AppError } from "../errors/app.error";

/** Opaque keyset cursor: base64url(JSON.stringify([sortKey, id])). Tamper → 400 VALIDATION_ERROR. */
export type Cursor = { key: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.key, c.id]), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" || typeof parsed[1] !== "string")
      throw new Error("shape");
    return { key: parsed[0], id: parsed[1] };
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
  }
}

/** Multi-key keyset cursor bound to a sort (T-095): base64url(JSON {v:1, s, k, id}). */
export type SortCursor = { sort: string; keys: (string | number)[]; id: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeSortCursor(c: SortCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, s: c.sort, k: c.keys, id: c.id }), "utf8").toString("base64url");
}

/** Tampered, wrong-shape or other-sort cursor → 400 VALIDATION_ERROR. */
export function decodeSortCursor(
  raw: string | undefined | null,
  expected: { sort: string; arity: number },
): SortCursor | null {
  if (!raw) return null;
  const invalid = () => new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  if (typeof parsed !== "object" || parsed === null) throw invalid();
  const o = parsed as Record<string, unknown>;
  const keys = o.k;
  if (o.v !== 1 || o.s !== expected.sort || typeof o.id !== "string" || !UUID_RE.test(o.id)) throw invalid();
  if (!Array.isArray(keys) || keys.length !== expected.arity) throw invalid();
  const typed: (string | number)[] = [];
  for (const k of keys as unknown[]) {
    if (typeof k === "string" || (typeof k === "number" && Number.isFinite(k))) typed.push(k);
    else throw invalid();
  }
  return { sort: expected.sort, keys: typed, id: o.id };
}

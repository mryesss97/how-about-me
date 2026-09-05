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

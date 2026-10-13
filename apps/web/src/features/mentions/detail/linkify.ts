/** Splits plain text into text and http(s) URL parts; callers render only `https:` parts as links (safePermalink). Never produces HTML (FR-158). */
export type TextPart = { kind: "text"; value: string } | { kind: "link"; value: string };

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TRAILING = /[.,;:!?)\]]+$/;

export function linkify(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const url = raw.replace(TRAILING, "");
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", value: text.slice(last, start) });
    out.push({ kind: "link", value: url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

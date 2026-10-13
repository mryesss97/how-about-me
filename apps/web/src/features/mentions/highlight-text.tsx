import { highlightSegments } from "./highlight";

/** FR-158 / TC-MEN-016: React text nodes only — post text is untrusted, never `dangerouslySetInnerHTML`. */
export function HighlightText({ text, query }: { text: string; query?: string | null }) {
  return (
    <>
      {highlightSegments(text, query).map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-sm bg-warning-secondary text-primary">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

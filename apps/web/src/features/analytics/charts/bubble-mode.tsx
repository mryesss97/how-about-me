"use client";

import type { PhraseSentimentResponse } from "@how-about-me/contracts";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { bubbleMapCopy as copy } from "../copy";
import type { BubbleDatum } from "./bubble-layout";

/** #243: what one bubble stands for. Local state of the overview, never in the URL. */
export type BubbleMode = "topics" | "phrases";

const MODES: readonly BubbleMode[] = ["topics", "phrases"];

type EmptyCopy = { title: string; description?: string } | null;

/** #243 empty states: 0 mentions (BR-032), no phrases extracted yet, or none reaching `minMentions`. */
export function emptyState(
  mode: BubbleMode,
  all: readonly BubbleDatum[],
  phraseData?: PhraseSentimentResponse,
): EmptyCopy {
  if (all.length > 0) return null;
  if (mode === "phrases" && phraseData && phraseData.sentimentAnalyzed > 0) {
    return phraseData.phraseAnalyzed === 0
      ? { title: copy.emptyPhrases, description: copy.emptyPhrasesDescription }
      : {
          title: copy.emptyPhrasesThreshold(phraseData.minMentions),
          description: copy.emptyPhrasesThresholdDescription,
        };
  }
  return { title: copy.empty };
}

/** Topics | Phrases segmented control — same ButtonGroup as Bubbles | Table (#243). */
export function BubbleModeToggle({ mode, onChange }: { mode: BubbleMode; onChange: (mode: BubbleMode) => void }) {
  return (
    <ButtonGroup
      size="sm"
      aria-label={copy.modeLabel}
      disallowEmptySelection
      selectedKeys={[mode]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next === "topics" || next === "phrases") onChange(next);
      }}
    >
      {MODES.map((m) => (
        <ButtonGroupItem key={m} id={m} className="max-md:min-h-11">
          {m === "topics" ? copy.modeTopics : copy.modePhrases}
        </ButtonGroupItem>
      ))}
    </ButtonGroup>
  );
}

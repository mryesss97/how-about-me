"use client";

import {
  CreateOverrideBodySchema,
  IntentLabelSchema,
  OVERRIDE_FIELDS,
  OverrideFieldSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
  type CreateOverrideBody,
  type MentionDetail,
  type OverrideField,
} from "@how-about-me/contracts";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { humanize } from "./format";
import { activeOverrides, FIELD_LABELS } from "./overrides";

export const REASON_MAX = 500;
const MULTI_MAX = 20;

const OPTIONS: Record<OverrideField, readonly string[]> = {
  relevance: RelevanceLabelSchema.options,
  sentiment: SentimentLabelSchema.options,
  safety_level: SafetyLevelSchema.options,
  intents: IntentLabelSchema.options,
  topics: TopicLabelSchema.options,
};

const isMulti = (f: OverrideField) => f === "intents" || f === "topics";

/** Current effective value of a field (BR-025: the detail `analysis` is already effective). */
export function effectiveValue(m: MentionDetail, f: OverrideField): string[] {
  const a = m.analysis;
  switch (f) {
    case "relevance":
      return a.relevance ? [a.relevance.label] : [];
    case "sentiment":
      return a.sentiment ? [a.sentiment.label] : [];
    case "safety_level":
      return a.safety ? [a.safety.level] : [];
    case "intents":
      return a.intents.map((i) => i.label);
    case "topics":
      return a.topics.map((t) => t.label);
  }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

type Props = {
  mention: MentionDetail;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (body: CreateOverrideBody) => void;
  isPending: boolean;
};

/**
 * Analyst override form — FR-191 (field, value, reason), BR-025 (the override becomes the effective value).
 * Reason is required in the UI (FR-191 "with reason") although the contract keeps it optional.
 * State is local and only seeded on open, so the 5 s detail polling never resets what the user typed.
 */
export function OverrideDialog({ mention, isOpen, onClose, onSubmit, isPending }: Props) {
  return (
    <SettingsDialog isOpen={isOpen} onClose={onClose} title="Override analysis">
      {isOpen ? <OverrideForm mention={mention} onClose={onClose} onSubmit={onSubmit} isPending={isPending} /> : null}
    </SettingsDialog>
  );
}

function OverrideForm({ mention, onClose, onSubmit, isPending }: Omit<Props, "isOpen">) {
  const [field, setField] = useState<OverrideField>("sentiment");
  const [values, setValues] = useState<string[]>(() => effectiveValue(mention, "sentiment"));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const multi = isMulti(field);
  const replaces = !!activeOverrides(mention.overrides)[field];
  const unchanged = sameSet(values, effectiveValue(mention, field));
  const trimmed = reason.trim();
  const reasonOk = trimmed.length > 0 && trimmed.length <= REASON_MAX;

  const changeField = (f: OverrideField) => {
    setField(f);
    setValues(effectiveValue(mention, f));
    setError(null);
  };
  const toggle = (v: string, on: boolean) =>
    setValues((cur) => (on ? (cur.length >= MULTI_MAX ? cur : [...cur, v]) : cur.filter((x) => x !== v)));

  const submit = () => {
    const parsed = CreateOverrideBodySchema.safeParse({ field, value: multi ? values : values[0], reason: trimmed });
    if (!parsed.success) {
      setError(multi ? `Choose up to ${MULTI_MAX} labels.` : "Choose a value.");
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <NativeSelect
        label="Field"
        size="sm"
        value={field}
        onChange={(e) => changeField(OverrideFieldSchema.parse(e.target.value))}
        options={OVERRIDE_FIELDS.map((f) => ({ value: f, label: FIELD_LABELS[f] }))}
      />
      {multi ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-secondary">Value</legend>
          <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
            {OPTIONS[field].map((o) => (
              <Checkbox key={o} label={humanize(o)} isSelected={values.includes(o)} onChange={(on) => toggle(o, on)} />
            ))}
          </div>
        </fieldset>
      ) : (
        <NativeSelect
          label="Value"
          size="sm"
          value={values[0] ?? ""}
          onChange={(e) => setValues(e.target.value ? [e.target.value] : [])}
          options={[
            { value: "", label: "Choose a value", disabled: true },
            ...OPTIONS[field].map((o) => ({ value: o, label: humanize(o) })),
          ]}
        />
      )}
      <TextArea
        label="Reason"
        isRequired
        rows={3}
        value={reason}
        onChange={setReason}
        maxLength={REASON_MAX}
        hint={`${trimmed.length}/${REASON_MAX}`}
      />
      {replaces ? <p className="text-sm text-tertiary">Saving replaces the current analyst override.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-error-primary">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" isDisabled={!reasonOk || unchanged || isPending} isLoading={isPending}>
          Save override
        </Button>
      </div>
    </form>
  );
}

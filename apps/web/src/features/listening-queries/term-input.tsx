"use client";

import { XClose } from "@untitledui/icons";
import { useId, useState, type KeyboardEvent } from "react";
import { cx } from "@/utils/cx";

/** Add a raw term: trim, skip empty and case-insensitive duplicates. */
export function addTerm(terms: readonly string[], raw: string): string[] {
  const t = raw.trim();
  if (!t || terms.some((x) => x.toLowerCase() === t.toLowerCase())) return [...terms];
  return [...terms, t];
}

type Props = {
  label: string;
  value: string[];
  onChange: (terms: string[]) => void;
  hint?: string;
  isInvalid?: boolean;
  isDisabled?: boolean;
  onBlur?: () => void;
};

/** Tag input for include/exclude terms (FR-052). Enter or comma adds a term; each chip has a named remove button. */
export function TermInput({ label, value, onChange, hint, isInvalid, isDisabled, onBlur }: Props) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const commit = (raw: string) => {
    const parts = raw.split(",");
    let next = value;
    for (const p of parts) next = addTerm(next, p);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-secondary">
        {label}
      </label>
      <div
        className={cx(
          "flex flex-wrap items-center gap-1.5 rounded-lg bg-primary px-3 py-2 shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand",
          isInvalid && "ring-error_subtle focus-within:ring-error",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        {value.length > 0 ? (
          <ul aria-label={label} className="contents">
            {value.map((t) => (
              <li
                key={t}
                className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-primary ring-inset"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Xoá ${t}`}
                  disabled={isDisabled}
                  onClick={() => onChange(value.filter((x) => x !== t))}
                  className="cursor-pointer rounded text-fg-quaternary hover:text-fg-quaternary_hover disabled:cursor-not-allowed"
                >
                  <XClose aria-hidden className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={isDisabled}
          aria-invalid={isInvalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          placeholder={value.length === 0 ? "Nhập rồi nhấn Enter" : undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) commit(v);
            else setDraft(v);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
            onBlur?.();
          }}
          className="min-w-24 flex-1 bg-transparent text-md text-primary outline-hidden placeholder:text-placeholder"
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className={cx("text-sm", isInvalid ? "text-error-primary" : "text-tertiary")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

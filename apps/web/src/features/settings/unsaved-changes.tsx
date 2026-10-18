"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { SettingsDialog } from "@/features/shared/settings-dialog";

type Ctx = {
  anyDirty: boolean;
  setDirty: (id: string, dirty: boolean) => void;
  confirmLeave: (href: string) => void;
};

const UnsavedChangesContext = createContext<Ctx | null>(null);

/**
 * Tracks which settings boards hold unsaved edits (#347). Guards Settings tab changes with a dialog and reload / tab
 * close with `beforeunload` (browsers show their own text). Sidebar / back navigation is not intercepted.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const anyDirty = dirtyIds.size > 0;

  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((prev) => {
      if (prev.has(id) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!anyDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [anyDirty]);

  const confirmLeave = useCallback((href: string) => setPendingHref(href), []);
  const value = useMemo(() => ({ anyDirty, setDirty, confirmLeave }), [anyDirty, setDirty, confirmLeave]);

  const discard = () => {
    const href = pendingHref;
    setPendingHref(null);
    setDirtyIds(new Set());
    if (href) router.push(href);
  };

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <SettingsDialog isOpen={pendingHref !== null} onClose={() => setPendingHref(null)} title="Bỏ thay đổi chưa lưu?">
        <p className="text-sm text-tertiary">Các thay đổi trong mục này sẽ mất.</p>
        <div className="flex justify-end gap-3">
          <Button color="secondary" onClick={() => setPendingHref(null)}>
            Huỷ
          </Button>
          <Button color="primary-destructive" onClick={discard}>
            Bỏ thay đổi
          </Button>
        </div>
      </SettingsDialog>
    </UnsavedChangesContext.Provider>
  );
}

/** `anyDirty` is false and `confirmLeave` is unused outside a provider (forms rendered standalone in tests). */
export function useUnsavedChanges(): Pick<Ctx, "anyDirty" | "confirmLeave"> {
  const ctx = useContext(UnsavedChangesContext);
  return ctx ?? { anyDirty: false, confirmLeave: () => undefined };
}

/** Registers one board's dirty state; removed on unmount so a key-remount after Save never leaves it stuck. */
export function useRegisterDirty(id: string, dirty: boolean) {
  const setDirty = useContext(UnsavedChangesContext)?.setDirty;
  useEffect(() => {
    if (!setDirty) return;
    setDirty(id, dirty);
    return () => setDirty(id, false);
  }, [id, dirty, setDirty]);
}

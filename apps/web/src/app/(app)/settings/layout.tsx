import { SettingsReadOnlyNote } from "@/features/settings/settings-read-only-note";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { UnsavedChangesProvider } from "@/features/settings/unsaved-changes";
import { PageHeader } from "@/features/shared/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <PageHeader title="Cài đặt" />
      {/* #347: unsaved-changes registry wraps tabs (guard) and the page forms. */}
      <UnsavedChangesProvider>
        <SettingsTabs />
        <SettingsReadOnlyNote />
        <div className="mt-6">{children}</div>
      </UnsavedChangesProvider>
    </div>
  );
}

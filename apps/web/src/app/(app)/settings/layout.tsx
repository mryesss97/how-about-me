import { SettingsReadOnlyNote } from "@/features/settings/settings-read-only-note";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { UnsavedChangesProvider } from "@/features/settings/unsaved-changes";
import { PageFrame } from "@/features/shared/page-frame";
import { PageHeader } from "@/features/shared/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  // #348: same frame (max-w-7xl, 24 px rhythm) as every other working screen.
  return (
    <PageFrame>
      <PageHeader title="Cài đặt" />
      {/* #347: unsaved-changes registry wraps tabs (guard) and the page forms. */}
      <UnsavedChangesProvider>
        <SettingsTabs />
        <SettingsReadOnlyNote />
        <div>{children}</div>
      </UnsavedChangesProvider>
    </PageFrame>
  );
}

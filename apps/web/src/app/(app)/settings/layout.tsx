import { SettingsTabs } from "@/features/settings/settings-tabs";
import { PageHeader } from "@/features/shared/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <PageHeader title="Cài đặt" />
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}

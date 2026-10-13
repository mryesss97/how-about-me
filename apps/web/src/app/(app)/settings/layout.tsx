import { SettingsTabs } from "@/features/settings/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <h1 className="text-display-xs font-semibold text-primary">Settings</h1>
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}

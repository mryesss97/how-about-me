import Link from "next/link";

const tabs = [
  { href: "/settings/project", label: "Project" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/integrations", label: "Integrations" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <h1 className="text-display-xs font-semibold text-primary">Settings</h1>
      <nav aria-label="Settings sections" className="mt-4 flex gap-2 border-b border-secondary">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="px-3 py-2 text-sm font-semibold text-tertiary hover:text-primary">
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}

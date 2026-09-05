import { AppSidebar } from "@/features/shared/app-sidebar";

/** Authenticated shell. Session guard + redirect to /login is added in T-032 (server-side Supabase cookie check). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppSidebar />
      <main className="min-w-0 flex-1 bg-primary">{children}</main>
    </div>
  );
}

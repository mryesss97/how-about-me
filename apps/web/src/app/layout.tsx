import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { QueryProvider } from "@/lib/query/provider";
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";
import "@/styles/globals.css";
import { cx } from "@/utils/cx";

const inter = Inter({ subsets: ["latin", "vietnamese"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "How About Me", template: "%s · How About Me" },
  description: "How About Me — Threads social listening. Listen. Understand.",
};

export const viewport: Viewport = {
  // Brand v2 (#221): Mist in light, app dark surface in dark.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5FBFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0E12" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cx(inter.variable, "bg-primary antialiased")}>
        <RouteProvider>
          <Theme>
            <NuqsAdapter>
              <QueryProvider>{children}</QueryProvider>
              <Toaster position="bottom-right" richColors />
            </NuqsAdapter>
          </Theme>
        </RouteProvider>
      </body>
    </html>
  );
}

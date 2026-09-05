import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "@/lib/query/provider";
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";
import "@/styles/globals.css";
import { cx } from "@/utils/cx";

const inter = Inter({ subsets: ["latin", "vietnamese"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "How About Me", template: "%s · How About Me" },
  description: "Threads social listening & content intelligence",
};

export const viewport: Viewport = { themeColor: "#7f56d9", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cx(inter.variable, "bg-primary antialiased")}>
        <RouteProvider>
          <Theme>
            <NuqsAdapter>
              <QueryProvider>{children}</QueryProvider>
            </NuqsAdapter>
          </Theme>
        </RouteProvider>
      </body>
    </html>
  );
}

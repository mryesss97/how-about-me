import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { figureFont, signFont } from "@/lib/fonts/sign";
import { QueryProvider } from "@/lib/query/provider";
import { RouteProvider } from "@/providers/router-provider";
import "@/styles/globals.css";
import { cx } from "@/utils/cx";

const inter = Inter({ subsets: ["latin", "vietnamese"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "How About Me", template: "%s · How About Me" },
  description: "How About Me — Threads social listening. Listen. Understand.",
};

export const viewport: Viewport = {
  // Light only (owner decision 2026-10-14, #260): Mist chrome, native controls stay light.
  themeColor: "#F5FBFF",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={cx(inter.variable, signFont.variable, figureFont.variable, "bg-primary antialiased")}>
        <RouteProvider>
          <NuqsAdapter>
            <QueryProvider>{children}</QueryProvider>
            <Toaster position="bottom-right" richColors />
          </NuqsAdapter>
        </RouteProvider>
      </body>
    </html>
  );
}

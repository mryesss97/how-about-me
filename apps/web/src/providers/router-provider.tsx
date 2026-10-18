"use client";

import type { PropsWithChildren } from "react";
import { useRouter } from "next/navigation";
import { I18nProvider, RouterProvider } from "react-aria-components";

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NonNullable<Parameters<ReturnType<typeof useRouter>["push"]>[1]>;
  }
}

export const RouteProvider = ({ children }: PropsWithChildren) => {
  const router = useRouter();

  // React Aria formats dates/calendars from this locale (not the browser's), so pickers read in Vietnamese
  // like the rest of the app (#112).
  return (
    <I18nProvider locale="vi-VN">
      <RouterProvider navigate={router.push}>{children}</RouterProvider>
    </I18nProvider>
  );
};

"use client";

import { createContext, useContext, useState, type MouseEvent, type PropsWithChildren } from "react";
import { X as CloseIcon, Menu02 } from "@untitledui/icons";
import {
    Button as AriaButton,
    Dialog as AriaDialog,
    DialogTrigger as AriaDialogTrigger,
    Modal as AriaModal,
    ModalOverlay as AriaModalOverlay,
} from "react-aria-components";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/features/shared/brand-logo";
import { cx } from "@/utils/cx";

/** #325: lets drawer content (e.g. sign-out) close the mobile menu. `null` outside the drawer. */
const MobileNavContext = createContext<{ close: () => void } | null>(null);
export const useMobileNav = () => useContext(MobileNavContext);

export const MobileNavigationHeader = ({ children }: PropsWithChildren) => {
    const [isOpen, setOpen] = useState(false);
    const pathname = usePathname();
    // #325: close the drawer whenever the route changes ("store previous value" pattern, no effect).
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (prevPathname !== pathname) {
        setPrevPathname(pathname);
        setOpen(false);
    }
    // #325: tapping any link (including the current page or the logo) closes the drawer.
    const closeOnLink = (e: MouseEvent<HTMLElement>) => {
        if (e.target instanceof Element && e.target.closest("a[href]")) setOpen(false);
    };

    return (
        <AriaDialogTrigger isOpen={isOpen} onOpenChange={setOpen}>
            {/* #325: sticky 56 px header so the menu stays reachable after scrolling. */}
            <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[var(--sky-enamel)] py-1.5 pr-1.5 pl-3 lg:hidden">
                {/* Brand guide v2: horizontal logo >= 180 px wide (#221). */}
                {/* #262: logo links to the landing page. */}
                <Link href="/" aria-label="How About Me — trang chủ" className="shell-logo-plate outline-white focus-visible:outline-2 focus-visible:outline-offset-2">
                    <BrandLogo variant="horizontal" className="h-auto w-[150px]" />
                </Link>

                <AriaButton
                    aria-label="Mở menu điều hướng"
                    className="flex size-11 items-center justify-center rounded-[2px] text-white outline-white hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <Menu02 aria-hidden className="size-6" />
                </AriaButton>
            </header>

            {/* #325: flat ink scrim (Flat Enamel Rule — no blur). */}
            <AriaModalOverlay
                isDismissable
                className={({ isEntering, isExiting }) =>
                    cx(
                        "fixed inset-0 z-50 cursor-pointer bg-[var(--ink)]/60 pr-16 lg:hidden",
                        isEntering && "duration-300 ease-in-out animate-in fade-in",
                        isExiting && "duration-200 ease-in-out animate-out fade-out",
                    )
                }
            >
                <AriaModal className="w-full max-w-74 cursor-auto">
                    <AriaDialog aria-label="Menu điều hướng" className="h-dvh outline-hidden focus:outline-hidden">
                        {/* #325: the only close control; inside the dialog so it stays in the a11y tree. */}
                        <AriaButton
                            aria-label="Đóng menu điều hướng"
                            onPress={() => setOpen(false)}
                            className="fixed top-1.5 right-3 flex size-11 cursor-pointer items-center justify-center rounded-[2px] text-white outline-white hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <CloseIcon aria-hidden className="size-6" />
                        </AriaButton>
                        <div className="h-full" onClickCapture={closeOnLink}>
                            <MobileNavContext.Provider value={{ close: () => setOpen(false) }}>{children}</MobileNavContext.Provider>
                        </div>
                    </AriaDialog>
                </AriaModal>
            </AriaModalOverlay>
        </AriaDialogTrigger>
    );
};

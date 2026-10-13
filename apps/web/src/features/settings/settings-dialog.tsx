"use client";

import type { ReactNode } from "react";
import { Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";

/** Controlled modal shell shared by the Members dialogs. */
export function SettingsDialog({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(o) => !o && onClose()} isDismissable>
      <Modal className="max-w-md">
        <Dialog aria-label={title}>
          <div className="flex w-full flex-col gap-4 rounded-xl bg-primary p-6 shadow-xl">
            <AriaHeading slot="title" className="text-lg font-semibold text-primary">
              {title}
            </AriaHeading>
            {children}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

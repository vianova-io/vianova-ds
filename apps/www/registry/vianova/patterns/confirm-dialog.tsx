"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/registry/vianova/ui/alert-dialog";
import { Spinner } from "@/registry/vianova/ui/spinner";

/**
 * "Are you sure?" as one component instead of nine.
 *
 * `onConfirm` may return a promise; the dialog stays open and shows a pending
 * state until it settles, and stays open on rejection. Closing optimistically
 * is the standard bug here -- the row vanishes from the UI and then the delete
 * fails, with the error surfacing in a toast nobody connects to the action.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  open,
  onOpenChange,
  children,
}: {
  /** A ReactElement, not a node: AlertDialogTrigger renders into it. */
  trigger?: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<unknown>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const isOpen = open ?? internalOpen;

  const setOpen = (next: boolean) => {
    // Ignore dismissals while the action is in flight, including Escape.
    if (pending && !next) return;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const confirm = async (event: React.MouseEvent) => {
    event.preventDefault();
    try {
      setPending(true);
      await onConfirm?.();
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogContent data-slot="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          {/* base-nova's destructive is a tinted variant, not a solid red fill.
              Using it keeps this consistent with every other destructive
              control instead of inventing a one-off treatment here. */}
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={confirm}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

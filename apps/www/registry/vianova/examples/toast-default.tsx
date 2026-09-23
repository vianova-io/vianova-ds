"use client";

import { Button } from "@/registry/vianova/ui/button";
import {
  Toaster,
  ToastProvider,
  useToastManager,
} from "@/registry/vianova/ui/toast";

// useToastManager reads from <ToastProvider> and throws without it, and
// <Toaster /> is what actually renders the queue. Both are required — this is
// a runtime contract the types do not express.
function AddToastButton() {
  const manager = useToastManager();
  return (
    <Button
      variant="outline"
      onClick={() =>
        manager.add({ title: "View saved", description: "Le Havre — weekday AM" })
      }
    >
      Add toast
    </Button>
  );
}

export default function ToastDefault() {
  return (
    <ToastProvider>
      <AddToastButton />
      <Toaster />
    </ToastProvider>
  );
}

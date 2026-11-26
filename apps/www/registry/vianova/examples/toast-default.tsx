"use client";

import { Button } from "@/registry/vianova/ui/button";
import { Toaster, useToastManager } from "@/registry/vianova/ui/toast";

// useToastManager reads from the provider <Toaster /> builds, and <Toaster />
// is what renders the queue. Both are required — a runtime contract the types
// do not express.
//
// Which is why the trigger is a CHILD of <Toaster /> rather than a sibling.
// This example used to wrap both in its own <ToastProvider>, and <Toaster />
// builds a second provider inside that one around its own manager: the click
// added to the outer store, `ToastList` rendered from the inner one, and no
// toast ever appeared. It failed silently -- no error, and a visual baseline of
// an empty frame that looked like a toast simply waiting to be triggered.
function AddToastButton() {
  const manager = useToastManager();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() =>
          manager.add({ title: "View saved", description: "Le Havre — weekday AM" })
        }
      >
        Add toast
      </Button>
      {/*
        The same toast without a title. Base UI names the dialog it wraps each
        toast in from `Toast.Title`, which renders nothing when there is no
        title, so this shape used to produce a dialog with no accessible name
        at all. It now takes its name from the description. Here as the second
        button because it is a real calling shape, and the only way to see the
        difference is to fire one.
      */}
      <Button
        variant="outline"
        onClick={() => manager.add({ description: "Export started — we will email you" })}
      >
        Add one with no title
      </Button>
    </div>
  );
}

export default function ToastDefault() {
  return (
    <Toaster>
      <AddToastButton />
    </Toaster>
  );
}

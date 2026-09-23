"use client";

import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/registry/vianova/ui/message-scroller";

const turns = [
  "Which districts grew most last month?",
  "Port district +21%, City centre +14%.",
  "Break that down by vehicle type.",
  "Bikes drove most of it; scooters were flat.",
];

// MessageScrollerProvider is required: the scroller reads its state through
// context, and useMessageScroller throws without it. This is a runtime
// contract, not a typed one.
export default function MessageScrollerDefault() {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="h-40 w-full rounded-lg border border-border">
        <MessageScrollerViewport>
          <MessageScrollerContent className="p-3">
            {turns.map((t, i) => (
              <MessageScrollerItem key={i} className="py-1.5 text-sm">
                {t}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

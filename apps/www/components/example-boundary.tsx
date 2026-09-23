"use client";

import * as React from "react";

/**
 * Isolates one example so a single failure cannot blank the page.
 *
 * The showcase renders every example at once, so an uncaught throw in any of
 * them takes down all 76 — which is how a misuse of one menu component hid the
 * entire wall behind an error overlay. Failing per card keeps the rest usable
 * and points at the culprit by name.
 */
export class ExampleBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Still surface it: a silently swallowed example is a broken example
    // nobody notices.
    console.error(`[example: ${this.props.name}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs font-medium text-destructive">
            {this.props.name} failed to render
          </p>
          <p className="mt-1 font-mono text-[11px] break-words text-muted-foreground">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

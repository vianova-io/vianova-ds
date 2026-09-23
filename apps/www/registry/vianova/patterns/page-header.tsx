import * as React from "react";

import { cn } from "@/registry/vianova/lib/utils";

/**
 * The band at the top of a page: what you are looking at, and what you can do
 * to it.
 *
 * Actions sit in a slot rather than as children so they stay on the title's
 * baseline row at every width while the description wraps beneath both. Laying
 * this out ad hoc per page is how heading levels drift apart across a product.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  headingLevel = 1,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  /** Drop to 2 when the shell already renders an h1 above the page. */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 border-b pb-4", className)}
      {...props}
    >
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <Heading className="truncate text-2xl font-semibold tracking-tight">
            {title}
          </Heading>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
